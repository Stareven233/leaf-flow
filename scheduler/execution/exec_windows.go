//go:build windows

package execution

import (
	"errors"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

func configureProcessGroup(cmd *exec.Cmd) {
}

var (
	kernel32                  = syscall.NewLazyDLL("kernel32.dll")
	procSetConsoleCtrlHandler = kernel32.NewProc("SetConsoleCtrlHandler")
)

func setConsoleCtrlIgnore(ignore bool) error {
	add := uintptr(0)
	if ignore {
		add = uintptr(1)
	}
	r1, _, e1 := procSetConsoleCtrlHandler.Call(uintptr(0), add)
	if r1 != 0 {
		return nil
	}
	if e1 != nil && e1 != syscall.Errno(0) {
		return e1
	}
	return syscall.EINVAL
}

func isProcessRunning(handle windows.Handle) (bool, error) {
	exitCode := uint32(0)
	err := windows.GetExitCodeProcess(handle, &exitCode)
	if err != nil {
		return false, err
	}
	return exitCode == 259, nil
}

func (e *SharedExecutor) isProcessAlive() bool {
	if e.cmd == nil || e.cmd.Process == nil {
		return false
	}

	processID := uint32(e.cmd.Process.Pid)
	handle, err := windows.OpenProcess(
		windows.PROCESS_QUERY_INFORMATION,
		false,
		processID)
	if err != nil {
		return false
	}
	defer windows.CloseHandle(handle)

	running, err := isProcessRunning(handle)
	if err != nil {
		return false
	}
	return running
}

func (e *SharedExecutor) terminateProcessGroup() error {
	processID := uint32(e.cmd.Process.Pid)

	handle, err := windows.OpenProcess(
		windows.PROCESS_TERMINATE|windows.PROCESS_QUERY_INFORMATION,
		false,
		processID)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)

	if running, err := isProcessRunning(handle); err == nil && !running {
		return nil
	}

	return windows.TerminateProcess(handle, 0)
}

func (e *SharedExecutor) terminateWithJobObject() error {
	if e.cmd == nil || e.cmd.Process == nil {
		return errors.New("no process to terminate")
	}

	jobHandle, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(jobHandle)

	var info windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	_, err = windows.SetInformationJobObject(jobHandle, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info)))
	if err != nil {
		return err
	}

	processHandle, err := windows.OpenProcess(
		windows.PROCESS_TERMINATE|windows.PROCESS_SET_QUOTA,
		false,
		uint32(e.cmd.Process.Pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(processHandle)

	if err := windows.AssignProcessToJobObject(jobHandle, processHandle); err != nil {
		if err != windows.ERROR_ACCESS_DENIED && err != windows.ERROR_NOT_SUPPORTED {
			return err
		}
	}

	return windows.TerminateJobObject(jobHandle, 0)
}

func (e *SharedExecutor) sendGracefulExitSignal() error {
	if e.cmd == nil || e.cmd.Process == nil {
		return nil
	}
	var err error

	if err = setConsoleCtrlIgnore(true); err == nil {
		defer setConsoleCtrlIgnore(false)
		if err = windows.GenerateConsoleCtrlEvent(windows.CTRL_C_EVENT, 0); err == nil {
			time.Sleep(200 * time.Millisecond)
			return nil
		}
	}

	if e.stdin != nil {
		_, err = e.stdin.Write([]byte{0x03})
		return err
	}
	if err == nil {
		return nil
	}

	err = windows.GenerateConsoleCtrlEvent(windows.CTRL_BREAK_EVENT, uint32(e.cmd.Process.Pid))
	return err
}

func (e *SharedExecutor) waitForExit(timeout time.Duration) bool {
	if e.cmd == nil || e.cmd.Process == nil {

		return true
	}

	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(e.cmd.Process.Pid))
	if err != nil {
		return false
	}
	defer windows.CloseHandle(handle)

	ms := uint32(timeout / time.Millisecond)
	status, err := windows.WaitForSingleObject(handle, ms)
	if err != nil {
		return false
	}
	return status == windows.WAIT_OBJECT_0
}

func (e *SharedExecutor) exit() error {
	var err error

	if err = e.sendGracefulExitSignal(); err == nil {
		if e.waitForExit(10 * time.Second) {
			return nil
		}
	}

	if err = e.terminateWithJobObject(); err == nil {
		return nil
	}

	if err = e.terminateProcessGroup(); err == nil {
		return nil
	}

	return err
}

func (e *SharedExecutor) TestGracefulTermination() {
	if e.cmd == nil || e.cmd.Process == nil {
		return
	}

	_ = e.Add("echo 'Testing graceful termination...'")
	_ = e.Run()

	time.Sleep(2 * time.Second)

	if err := e.exit(); err != nil {
	}
}

func findWt() string {
	localApps := filepath.Join(os.Getenv("LOCALAPPDATA"), `Microsoft\WindowsApps\wt.exe`)
	if _, err := os.Stat(localApps); err == nil {
		return localApps
	}
	if path, err := exec.LookPath("wt.exe"); err == nil {
		return path
	}
	return ""
}

func StartConsoleInputBridge() func() {
	stdin := os.Stdin
	stdout := os.Stdout
	console := windows.Handle(stdin.Fd())
	outConsole := windows.Handle(stdout.Fd())

	var initialMode uint32
	hasConsoleMode := windows.GetConsoleMode(console, &initialMode) == nil
	var outInitialMode uint32
	hasOutConsoleMode := windows.GetConsoleMode(outConsole, &outInitialMode) == nil

	stopCh := make(chan struct{})
	var relayEnabled atomic.Bool
	var modeMu sync.Mutex
	rawEnabled := false
	savedMode := initialMode
	outModeEnabled := false
	savedOutMode := outInitialMode

	setRawMode := func() error {
		if !hasConsoleMode {
			return nil
		}

		modeMu.Lock()
		defer modeMu.Unlock()
		if rawEnabled {
			return nil
		}

		var currentMode uint32
		if err := windows.GetConsoleMode(console, &currentMode); err != nil {
			return err
		}
		savedMode = currentMode

		baseMode := currentMode
		baseMode &^= windows.ENABLE_LINE_INPUT
		baseMode &^= windows.ENABLE_ECHO_INPUT
		baseMode &^= windows.ENABLE_PROCESSED_INPUT
		baseMode &^= windows.ENABLE_QUICK_EDIT_MODE
		baseMode |= windows.ENABLE_EXTENDED_FLAGS
		baseMode |= windows.ENABLE_WINDOW_INPUT

		vtMode := baseMode | windows.ENABLE_VIRTUAL_TERMINAL_INPUT
		if err := windows.SetConsoleMode(console, vtMode); err != nil {
			if fallbackErr := windows.SetConsoleMode(console, baseMode); fallbackErr != nil {
				return fallbackErr
			}
		}

		rawEnabled = true
		return nil
	}

	restoreMode := func() {
		if !hasConsoleMode {
			return
		}

		modeMu.Lock()
		defer modeMu.Unlock()
		if !rawEnabled {
			return
		}
		if err := windows.SetConsoleMode(console, savedMode); err != nil {
			log.Printf("restore console mode failed: %v", err)
		}
		rawEnabled = false
	}

	setOutMode := func() error {
		if !hasOutConsoleMode {
			return nil
		}

		modeMu.Lock()
		defer modeMu.Unlock()
		if outModeEnabled {
			return nil
		}

		var currentMode uint32
		if err := windows.GetConsoleMode(outConsole, &currentMode); err != nil {
			return err
		}
		savedOutMode = currentMode
		newMode := currentMode | windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING
		if err := windows.SetConsoleMode(outConsole, newMode); err != nil {
			return err
		}

		outModeEnabled = true
		return nil
	}

	restoreOutMode := func() {
		if !hasOutConsoleMode {
			return
		}

		modeMu.Lock()
		defer modeMu.Unlock()
		if !outModeEnabled {
			return
		}
		if err := windows.SetConsoleMode(outConsole, savedOutMode); err != nil {
			log.Printf("restore console output mode failed: %v", err)
		}
		outModeEnabled = false
	}

	isRunningPtyTask := func() bool {
		task := GetTaskQueue().RunningTask()
		return task != nil && strings.HasPrefix(task.Shell, "pty:")
	}

	syncConsoleSize := func() {
		if !hasOutConsoleMode {
			return
		}
		cols, rows, err := getConsoleViewportSize(outConsole)
		if err != nil || cols <= 0 || rows <= 0 {
			return
		}
		consoleViewport.Write(cols, rows)

		if GetLogManager().NumClients() > 0 {
			return
		}

		_ = GetTaskQueue().Resize(cols, rows)
	}

	go func() {
		ticker := time.NewTicker(200 * time.Millisecond)
		defer ticker.Stop()

		reportedModeErr := false
		relayWasEnabled := false
		for {
			select {
			case <-stopCh:
				relayEnabled.Store(false)
				restoreMode()
				restoreOutMode()
				return
			case <-ticker.C:
				if !isRunningPtyTask() {
					relayEnabled.Store(false)
					reportedModeErr = false
					relayWasEnabled = false
					restoreMode()
					restoreOutMode()
					continue
				}

				if err := setRawMode(); err != nil && !reportedModeErr {
					log.Printf("enable raw console mode failed (fallback to buffered stdin): %v", err)
					reportedModeErr = true
				}
				if err := setOutMode(); err != nil && !reportedModeErr {
					log.Printf("enable VT output mode failed: %v", err)
					reportedModeErr = true
				}

				if !relayWasEnabled && hasConsoleMode {
					_ = windows.FlushConsoleInputBuffer(console)
					relayWasEnabled = true
				}
				syncConsoleSize()
				relayEnabled.Store(true)
			}
		}
	}()

	go func() {
		buf := make([]byte, 256)
		for {
			select {
			case <-stopCh:
				return
			default:
			}

			if !relayEnabled.Load() {
				time.Sleep(50 * time.Millisecond)
				continue
			}

			n, err := stdin.Read(buf)
			if err != nil {
				select {
				case <-stopCh:
					return
				default:
				}
				if !errors.Is(err, io.EOF) {
					log.Printf("console input bridge read failed: %v", err)
				}
				return
			}
			if n == 0 {
				continue
			}

			input := normalizeConsoleInput(buf[:n])
			if len(input) == 0 || !relayEnabled.Load() {
				continue
			}

			_ = GetTaskQueue().Input(string(input))
		}
	}()

	var stopOnce sync.Once
	return func() {
		stopOnce.Do(func() {
			close(stopCh)
			relayEnabled.Store(false)
			restoreMode()
			restoreOutMode()
		})
	}
}

func getConsoleViewportSize(console windows.Handle) (cols int, rows int, err error) {
	var info windows.ConsoleScreenBufferInfo
	if err = windows.GetConsoleScreenBufferInfo(console, &info); err != nil {
		return 0, 0, err
	}
	cols = int(info.Window.Right-info.Window.Left) + 1
	rows = int(info.Window.Bottom-info.Window.Top) + 1
	return cols, rows, nil
}

func normalizeConsoleInput(input []byte) []byte {
	out := make([]byte, 0, len(input))
	for i := 0; i < len(input); i++ {
		b := input[i]

		if b == 0x00 || b == 0xE0 {
			if i+1 >= len(input) {
				continue
			}
			sc := input[i+1]
			i++
			switch sc {
			case 0x48:
				out = append(out, 0x1b, '[', 'A')
			case 0x50:
				out = append(out, 0x1b, '[', 'B')
			case 0x4d:
				out = append(out, 0x1b, '[', 'C')
			case 0x4b:
				out = append(out, 0x1b, '[', 'D')
			case 0x47:
				out = append(out, 0x1b, '[', 'H')
			case 0x4f:
				out = append(out, 0x1b, '[', 'F')
			case 0x49:
				out = append(out, 0x1b, '[', '5', '~')
			case 0x51:
				out = append(out, 0x1b, '[', '6', '~')
			case 0x53:
				out = append(out, 0x1b, '[', '3', '~')
			default:
			}
			continue
		}

		out = append(out, b)
	}
	return out
}

func parseCommandArgs(command string) ([]string, error) {
	command = strings.TrimSpace(command)
	if command == "" {
		return nil, nil
	}

	commandPtr, err := syscall.UTF16PtrFromString(command)
	if err != nil {
		return nil, err
	}

	var argc int32
	argv, err := syscall.CommandLineToArgv(commandPtr, &argc)
	if err != nil {
		return nil, err
	}
	defer syscall.LocalFree(syscall.Handle(uintptr(unsafe.Pointer(argv))))

	args := make([]string, 0, argc)
	for _, arg := range (*argv)[:argc:argc] {
		args = append(args, syscall.UTF16ToString((*arg)[:]))
	}
	return args, nil
}
