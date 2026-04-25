package execution

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"scheduler/utils"
	"strings"
	"sync"
	"time"
)

type IExecutor interface {
	Add(string) error
	Input(string) error
	Run() error
	Exit()
	Active() bool
	Failed() bool
}

type SharedExecutor struct {
	ctx    context.Context
	cancel context.CancelFunc

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser

	wg     sync.WaitGroup
	active bool
	failed bool
}

var (
	stdoutLogPrefix  = []byte{'l', 'o', '>', ' '}
	stderrLogPrefix  = []byte{'l', 'x', '>', ' '}
	carriageReturn   = []byte{'\r'}
	lineFeed         = []byte{'\n'}
	carriageLineFeed = []byte{'\r', '\n'}
)

var progressBroadcastInterval time.Duration

func init() {
	os.Setenv("PYTHONUTF8", "1")
	var interval = time.Duration(utils.GetConfig(false).ProgressSampleGap)
	progressBroadcastInterval = interval * time.Second
}

func shellMeta(shell string) (bin string, args []string) {
	switch strings.ToLower(shell) {
	case "cmd":
		return "cmd", []string{"/k"}
	case "powershell", "powershell5", "ps", "ps5":
		return "powershell", []string{"-Command", "-"}
	case "pwsh", "powershell7", "ps7":
		return "pwsh", []string{"-Command", "-"}
	case "bash":
		return "bash", []string{"-s"}
	case "sh":
		return "sh", []string{"-s"}
	default:
		if runtime.GOOS == "windows" {
			return "powershell", []string{"-Command", "-"}
		}
		return "bash", []string{"-s"}
	}
}

func newSharedExecutor(ctx context.Context, cancel context.CancelFunc, shellType string) (*SharedExecutor, error) {
	name, args := shellMeta(shellType)
	cmd := exec.CommandContext(ctx, name, args...)

	configureProcessGroup(cmd)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, err
	}

	e := &SharedExecutor{
		ctx:    ctx,
		cancel: cancel,
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
		stderr: stderr,
		active: true,
	}

	e.Add("[Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8")

	e.wg.Go(e.logStdout)
	e.wg.Go(e.logStderr)

	return e, nil
}

func (e *SharedExecutor) logStdout() {
	logStream(e.stdout, LogTypeStdout, true)
}

func (e *SharedExecutor) logStderr() {
	logStream(e.stderr, LogTypeStderr, true)
}

func printLine(line []byte, logType LogType, prefix, suffix []byte) {
	writer := os.Stdout
	logPrefix := stdoutLogPrefix
	if logType == LogTypeStderr {
		writer = os.Stderr
		logPrefix = stderrLogPrefix
	}

	payload := make([]byte, 0, len(prefix)+len(logPrefix)+len(line)+len(suffix))
	payload = append(payload, prefix...)
	payload = append(payload, logPrefix...)
	payload = append(payload, line...)
	payload = append(payload, suffix...)
	_, _ = writer.Write(payload)
}

func wrapLine(prefix, line, suffix []byte) []byte {
	payload := make([]byte, 0, len(prefix)+len(line)+len(suffix))
	payload = append(payload, prefix...)
	payload = append(payload, line...)
	payload = append(payload, suffix...)
	return payload
}

func terminalNewLine(rawBroadcast bool) []byte {
	if rawBroadcast {
		return carriageLineFeed
	}
	return lineFeed
}

func logStream(r io.Reader, logType LogType, rawBroadcast bool) {
	isErr := logType == LogTypeStderr
	reader := bufio.NewReader(r)
	var buf bytes.Buffer
	var inProgress bool
	var lastBroadcastTime time.Time

	flush := func(line []byte, progress bool) {
		lineEnding := terminalNewLine(rawBroadcast)
		if progress {
			printLine(line, logType, carriageReturn, lineFeed)
			if !rawBroadcast {
				GetLogManager().Broadcast(logType, wrapLine(carriageReturn, line, lineEnding))
			}
		} else {
			if isErr {
				time.Sleep(23 * time.Millisecond)
			}
			printLine(line, logType, nil, lineFeed)
			if !rawBroadcast {
				GetLogManager().Broadcast(logType, wrapLine(nil, line, lineEnding))
			}
		}
	}

	bcast := func(raw []byte) {
		if rawBroadcast {
			GetLogManager().Broadcast(logType, raw)
		}
	}

	takeLine := func() []byte {
		line := bytes.TrimRight(buf.Bytes(), " ")
		line = bytes.Clone(line)
		buf.Reset()
		return line
	}

	for {
		b, err := reader.ReadByte()
		if err != nil {
			if buf.Len() > 0 {
				remaining := takeLine()
				flush(remaining, inProgress)
				bcast(remaining)
			}
			if err == io.EOF || isBenignStreamReadError(err) {
				return
			}
			fmt.Fprintf(os.Stderr, "lx> %s read error: %v\n", logType, err)
			return
		}

		if b != '\r' && b != '\n' {
			buf.WriteByte(b)
			continue
		}

		line := takeLine()

		if b == '\r' {
			next, _ := reader.Peek(1)
			if len(next) > 0 && next[0] == '\n' {
				_, _ = reader.ReadByte()
				b = '\n'
			}
		}

		if b == '\r' {

			if !inProgress {
				printLine(line, logType, nil, nil)
				bcast(wrapLine(nil, line, carriageReturn))
				inProgress = true
				continue
			}

			printLine(line, logType, carriageReturn, nil)
			if rawBroadcast {
				bcast(wrapLine(carriageReturn, line, nil))
			} else if time.Since(lastBroadcastTime) >= progressBroadcastInterval {
				GetLogManager().Broadcast(logType, wrapLine(carriageReturn, line, nil))
				lastBroadcastTime = time.Now()
			}
			continue
		}

		flush(line, inProgress && len(line) > 0)
		if rawBroadcast {
			if inProgress {
				bcast(wrapLine(carriageReturn, line, terminalNewLine(true)))
			} else {
				bcast(wrapLine(nil, line, terminalNewLine(true)))
			}
		}
		inProgress = false
	}
}

var shellClosedError = errors.New("shell already closed")
var benignStreamErrSubstr = [...]string{
	"file already closed",
	"use of closed file",
	"broken pipe",
	"pipe has been ended",
	"operation on closed pipe",
}

func isBenignStreamReadError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, io.EOF) || errors.Is(err, os.ErrClosed) {
		return true
	}

	msg := strings.ToLower(err.Error())
	for _, sub := range benignStreamErrSubstr {
		if strings.Contains(msg, sub) {
			return true
		}
	}
	return false
}

func (e *SharedExecutor) Input(input string) error {
	if !e.Active() || e.stdin == nil {
		return shellClosedError
	}
	if input == "" {
		return nil
	}
	_, err := io.WriteString(e.stdin, input)
	return err
}

func (e *SharedExecutor) Add(command string) error {
	if !e.Active() || e.stdin == nil {
		return shellClosedError
	}
	_, err := fmt.Fprintln(e.stdin, command)
	return err
}

func (e *SharedExecutor) Run() error {
	if !e.Active() {
		return shellClosedError
	}
	defer e.wg.Wait()

	if e.stdin != nil {
		_ = e.stdin.Close()
	}
	err := e.cmd.Wait()
	return err
}

func (e *SharedExecutor) Exit() {
	if !e.Active() {
		return
	}
	e.active = false

	_ = e.exit()

	if e.stdin != nil {
		_ = e.stdin.Close()
	}
	if e.stdout != nil {
		_ = e.stdout.Close()
	}
	if e.stderr != nil {
		_ = e.stderr.Close()
	}

	e.cancel()

	e.wg.Wait()
	<-e.ctx.Done()
}

func (e *SharedExecutor) Active() bool {
	return e.active
}

func (e *SharedExecutor) Failed() bool {
	return e.failed
}
