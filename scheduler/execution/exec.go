package execution

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"time"
)

func removeQuotes(s string) string {
	if len(s) >= 2 && (s[0] == '\'' || s[0] == '"') && s[0] == s[len(s)-1] {
		s = s[1 : len(s)-1]
	}
	return s
}

func splitWithQuotes(s string) []string {
	var result []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	escapeNext := false

	for i, ch := range s {
		if escapeNext {
			current.WriteRune(ch)
			escapeNext = false
			continue
		}

		switch ch {
		case '\\':
			if i+1 < len(s) {
				escapeNext = true
			} else {
				current.WriteRune(ch)
			}

		case '\'':
			if !inDoubleQuote {
				inSingleQuote = !inSingleQuote
			}
			current.WriteRune(ch)

		case '"':
			if !inSingleQuote {
				inDoubleQuote = !inDoubleQuote
			}
			current.WriteRune(ch)

		case ' ':
			if inSingleQuote || inDoubleQuote {
				current.WriteRune(ch)
			} else {
				if current.Len() > 0 {
					result = append(result, removeQuotes(current.String()))
					current.Reset()
				}
			}

		default:
			current.WriteRune(ch)
		}
	}

	if current.Len() > 0 {
		result = append(result, removeQuotes(current.String()))
	}

	return result
}

type Executor struct {
	*SharedExecutor
	commands []string
}

func newExecutor(ctx context.Context, cancel context.CancelFunc) (*Executor, error) {

	e := &SharedExecutor{
		ctx:    ctx,
		cancel: cancel,
		active: true,
	}

	return &Executor{
		SharedExecutor: e,
		commands:       []string{},
	}, nil
}

func InitExecutor(shell string) (IExecutor, error) {
	ctx, cancel := context.WithCancel(context.Background())
	cleanShell := strings.TrimSpace(shell)
	if strings.HasPrefix(strings.ToLower(cleanShell), "pty:") {
		ptyShell := strings.TrimSpace(cleanShell[len("pty:"):])
		return newPtyExecutor(ctx, cancel, ptyShell)
	}
	if strings.EqualFold(cleanShell, "no") {
		return newExecutor(ctx, cancel)
	}
	return newSharedExecutor(ctx, cancel, cleanShell)
}

func (e *Executor) Add(command string) error {
	e.commands = append(e.commands, command)
	return nil
}

func (e *Executor) Input(_ string) error {
	return errors.New("interactive input is not supported when shell=no")
}

func (e *Executor) Run() error {
	if !e.Active() {
		return errors.New("executor already closed")
	}
	defer e.Exit()

	for _, cmdStr := range e.commands {

		select {
		case <-e.ctx.Done():
			return e.ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}

		fields, err := parseCommandArgs(cmdStr)
		if err != nil {
			if e.ctx.Err() == nil {
				e.failed = true
			}
			return err
		}
		if len(fields) == 0 {
			continue
		}

		name := fields[0]
		args := fields[1:]
		cmd := exec.CommandContext(e.ctx, name, args...)
		e.cmd = cmd

		configureProcessGroup(cmd)

		e.stdin, err = cmd.StdinPipe()
		if err != nil {
			return err
		}
		e.stdout, err = cmd.StdoutPipe()
		if err != nil {
			return err
		}
		e.stderr, err = cmd.StderrPipe()
		if err != nil {
			return err
		}

		if err = cmd.Start(); err != nil {
			if e.ctx.Err() == nil {
				e.failed = true
			}
			return err
		}

		e.wg.Go(e.logStdout)
		e.wg.Go(e.logStderr)

		e.wg.Wait()

		if err = cmd.Wait(); err != nil {
			if e.ctx.Err() == nil {
				e.failed = true
			}
			return err
		}
	}

	return nil
}
