package execution

import (
	"context"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	gpty "github.com/aymanbagabas/go-pty"
)

type Viewport struct {
	cols int
	rows int
}

func NewViewport(cols, rows int) Viewport {
	return Viewport{cols: cols, rows: rows}
}

func (t Viewport) Write(cols, rows int) {
	t.cols = cols
	t.rows = rows
}

func (t Viewport) Read() (cols, rows int) {
	return t.cols, t.rows
}

var consoleViewport = NewViewport(0, 0)

var uiViewport = NewViewport(0, 0)

const windowsColsSafetyMargin = 10

const broadcastFrequency = 10

type PtyExecutor struct {
	*SharedExecutor
	cmd      *gpty.Cmd
	pty      gpty.Pty
	shell    string
	commands []string
	size     Viewport
	mu       sync.RWMutex
}

func newPtyExecutor(ctx context.Context, cancel context.CancelFunc, shellType string) (*PtyExecutor, error) {
	name, _ := ptyShellMeta(shellType)

	shared := &SharedExecutor{
		ctx:    ctx,
		cancel: cancel,
		active: true,
	}

	return &PtyExecutor{
		SharedExecutor: shared,
		shell:          name,
		commands:       make([]string, 0, 4),
		size:           uiViewport,
	}, nil
}

type ptyReadResult struct {
	chunk []byte
	err   error
}

func ptyShellMeta(shell string) (bin string, args []string) {
	cleanShell := strings.ToLower(strings.TrimSpace(shell))
	if cleanShell == "no" {
		return "no", nil
	}

	name, args := shellMeta(cleanShell)
	switch name {
	case "powershell", "pwsh":
		return name, []string{"-NoLogo", "-NoProfile"}
	case "cmd":
		return name, []string{"/d", "/q", "/k"}
	case "bash", "sh":
		return name, []string{"-s"}
	default:
		return name, args
	}
}

func readPtyChunks(r io.Reader, readCh chan<- ptyReadResult) {
	defer close(readCh)

	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if n > 0 || err != nil {
			result := ptyReadResult{err: err}
			if n > 0 {
				result.chunk = append([]byte(nil), buf[:n]...)
			}
			readCh <- result
		}
		if err != nil {
			return
		}
	}
}

func newPtyFlushTicker() (*time.Ticker, <-chan time.Time) {
	if broadcastFrequency < 0 {
		return nil, nil
	}

	freq := broadcastFrequency
	if freq == 0 {
		freq = 1
	}

	ticker := time.NewTicker(time.Second / time.Duration(freq))
	return ticker, ticker.C
}

func logPtyStream(r io.Reader) {
	readCh := make(chan ptyReadResult, 1)
	go readPtyChunks(r, readCh)

	var (
		pending   []byte
		sentFirst bool
	)
	flushTicker, flushChannel := newPtyFlushTicker()
	if flushTicker != nil {
		defer flushTicker.Stop()
	}

	flushPending := func() {
		if len(pending) == 0 {
			return
		}
		GetLogManager().Broadcast(LogTypeStdout, pending)
		pending = pending[:0]
	}

	for {
		select {
		case result, ok := <-readCh:
			if !ok {
				flushPending()
				return
			}
			if len(result.chunk) > 0 {
				_, _ = os.Stdout.Write(result.chunk)
				if broadcastFrequency < 0 {
					GetLogManager().Broadcast(LogTypeStdout, result.chunk)
				} else {
					pending = append(pending, result.chunk...)
					if !sentFirst {
						flushPending()
						sentFirst = true
					}
				}
			}

			if result.err != nil {
				flushPending()
				if result.err == io.EOF || isBenignStreamReadError(result.err) {
					return
				}
				fmt.Fprintf(os.Stderr, "lx> %s read error: %v\n", LogTypeStdout, result.err)
				return
			}
		case <-flushChannel:
			flushPending()
		}
	}
}

func normalizePtySize(cols int, rows int) (int, int) {
	if cols <= 0 || rows <= 0 || runtime.GOOS != "windows" {
		return cols, rows
	}

	consoleCols, consoleRows := consoleViewport.Read()
	if consoleCols > 0 && consoleCols < cols {
		cols = consoleCols
	}
	if consoleRows > 0 && consoleRows < rows {
		rows = consoleRows
	}

	if consoleCols <= 0 || consoleCols >= cols || cols > windowsColsSafetyMargin {
		cols -= windowsColsSafetyMargin
	}
	cols = max(cols, 20)
	return cols, rows
}

func (e *PtyExecutor) Resize(cols int, rows int) error {
	if cols <= 0 || rows <= 0 {
		return nil
	}
	cols, rows = normalizePtySize(cols, rows)

	e.mu.Lock()
	defer e.mu.Unlock()
	e.size.Write(cols, rows)
	if !e.active {
		return shellClosedError
	}
	if e.pty == nil {
		return nil
	}
	return e.pty.Resize(cols, rows)
}

func (e *PtyExecutor) Input(input string) error {
	if input == "" {
		return nil
	}

	e.mu.RLock()
	pty := e.pty
	active := e.active
	e.mu.RUnlock()
	if !active || pty == nil {
		return shellClosedError
	}

	_, err := io.WriteString(pty, input)
	return err
}

func (e *PtyExecutor) Add(command string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !e.active {
		return shellClosedError
	}
	e.commands = append(e.commands, command)
	return nil
}

func (e *PtyExecutor) openSession(cols int, rows int) (gpty.Pty, error) {
	term, err := gpty.New()
	if err != nil {
		e.SharedExecutor.failed = true
		return nil, err
	}
	if cols > 0 && rows > 0 {
		if err := term.Resize(cols, rows); err != nil {
			_ = term.Close()
			e.SharedExecutor.failed = true
			return nil, err
		}
	}

	e.mu.Lock()
	if !e.active {
		e.mu.Unlock()
		_ = term.Close()
		return nil, shellClosedError
	}
	e.pty = term
	e.mu.Unlock()

	e.SharedExecutor.wg.Go(func() {
		logPtyStream(term)
	})
	return term, nil
}

func (e *PtyExecutor) startCommand(term gpty.Pty, commandName string, commandArgs []string) (*gpty.Cmd, error) {
	cmd := term.Command(commandName, commandArgs...)
	if err := cmd.Start(); err != nil {
		if e.SharedExecutor.ctx.Err() == nil {
			e.SharedExecutor.failed = true
		}
		return nil, err
	}

	e.mu.Lock()
	if !e.active {
		e.mu.Unlock()
		if cmd.Process != nil {
			cmd.Process.Kill()
			cmd.Process.Wait()
		}
		return nil, shellClosedError
	}
	e.cmd = cmd
	e.mu.Unlock()
	return cmd, nil
}

func (e *PtyExecutor) closeSession() {
	e.mu.Lock()
	if e.pty != nil {
		_ = e.pty.Close()
		e.pty = nil
	}
	e.cmd = nil
	e.active = false
	e.mu.Unlock()
	e.SharedExecutor.wg.Wait()
}

func (e *PtyExecutor) runDirectCommands(commands []string, cols int, rows int) error {
	term, err := e.openSession(cols, rows)
	if err != nil {
		return err
	}
	defer e.closeSession()

	hasUserCommand := false
	for _, command := range commands {
		if strings.TrimSpace(command) == "" {
			continue
		}

		fields, err := parseCommandArgs(command)
		if err != nil {
			if e.SharedExecutor.ctx.Err() == nil {
				e.SharedExecutor.failed = true
			}
			return err
		}
		if len(fields) == 0 {
			continue
		}
		hasUserCommand = true

		cmd, err := e.startCommand(term, fields[0], fields[1:])
		if err != nil {
			return err
		}

		err = cmd.Wait()

		e.mu.Lock()
		if e.cmd == cmd {
			e.cmd = nil
		}
		e.mu.Unlock()

		if err != nil {
			if e.SharedExecutor.ctx.Err() == nil {
				e.SharedExecutor.failed = true
			}
			return err
		}
	}

	if !hasUserCommand {
		return nil
	}
	return nil
}

func (e *PtyExecutor) runShellCommands(shell string, commands []string, cols int, rows int) error {
	name, args := ptyShellMeta(shell)

	commandBatch := make([]string, 0, len(commands)+2)
	lineEnding := "\n"
	switch name {
	case "powershell", "pwsh":
		lineEnding = "\r\n"
		commandBatch = append(commandBatch, "[Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8")
	case "cmd":
		lineEnding = "\r\n"
	}

	hasUserCommand := false
	for _, command := range commands {
		if strings.TrimSpace(command) == "" {
			continue
		}
		hasUserCommand = true
		commandBatch = append(commandBatch, command)
	}
	if !hasUserCommand {
		e.mu.Lock()
		e.active = false
		e.mu.Unlock()
		return nil
	}
	commandBatch = append(commandBatch, "exit")

	term, err := e.openSession(cols, rows)
	if err != nil {
		return err
	}
	defer e.closeSession()

	cmd, err := e.startCommand(term, name, args)
	if err != nil {
		return err
	}

	for _, command := range commandBatch {
		if _, err := io.WriteString(term, command+lineEnding); err != nil {
			if cmd.Process != nil {
				cmd.Process.Kill()
				cmd.Process.Wait()
			}
			if e.SharedExecutor.ctx.Err() == nil {
				e.SharedExecutor.failed = true
			}
			return err
		}
	}

	err = cmd.Wait()
	if err != nil && e.SharedExecutor.ctx.Err() == nil {
		e.SharedExecutor.failed = true
	}
	return err
}

func (e *PtyExecutor) Run() error {
	e.mu.RLock()
	if !e.active {
		e.mu.RUnlock()
		return shellClosedError
	}
	shell := e.shell
	cols, rows := normalizePtySize(e.size.Read())
	e.mu.RUnlock()

	if len(e.commands) == 0 {
		e.mu.Lock()
		e.active = false
		e.mu.Unlock()
		return nil
	}

	if shell == "no" {
		return e.runDirectCommands(e.commands, cols, rows)
	}
	return e.runShellCommands(shell, e.commands, cols, rows)
}

func (e *PtyExecutor) Exit() {
	e.mu.Lock()
	if !e.active {
		e.mu.Unlock()
		return
	}
	e.active = false
	pty := e.pty
	cmd := e.cmd
	e.pty = nil
	e.cmd = nil
	e.mu.Unlock()

	if pty != nil {
		_ = pty.Close()
	}
	e.SharedExecutor.cancel()
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}
	e.SharedExecutor.wg.Wait()
	<-e.SharedExecutor.ctx.Done()
}
