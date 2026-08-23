package execution

import (
	"context"
	"errors"
	"strings"
	"sync"
)

type NewWindowExecutor struct {
	ctx    context.Context
	cancel context.CancelFunc
	shell  string

	mutex    sync.Mutex
	commands []string
	active   bool
	failed   bool
}

func newNewWindowExecutor(ctx context.Context, cancel context.CancelFunc, shell string) (*NewWindowExecutor, error) {
	shell = strings.ToLower(strings.TrimSpace(shell))
	if shell == "" {
		shell = "ps"
	}

	return &NewWindowExecutor{
		ctx:      ctx,
		cancel:   cancel,
		shell:    shell,
		commands: make([]string, 0),
		active:   true,
	}, nil
}

func (e *NewWindowExecutor) Add(command string) error {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	if !e.active {
		return errors.New("executor already closed")
	}
	e.commands = append(e.commands, command)
	return nil
}

func (e *NewWindowExecutor) Input(_ string) error {
	return errors.New("interactive input is not supported for a new window")
}

func (e *NewWindowExecutor) Run() error {
	e.mutex.Lock()
	if !e.active {
		e.mutex.Unlock()
		return errors.New("executor already closed")
	}
	if err := e.ctx.Err(); err != nil {
		e.active = false
		e.mutex.Unlock()
		e.cancel()
		return err
	}
	commands := append([]string(nil), e.commands...)
	e.mutex.Unlock()

	if err := e.startNewWindow(commands); err != nil {
		e.mutex.Lock()
		e.active = false
		e.failed = true
		e.mutex.Unlock()
		e.cancel()
		return err
	}

	e.mutex.Lock()
	e.active = false
	e.mutex.Unlock()
	e.cancel()
	return nil
}

func (e *NewWindowExecutor) Exit() {
	e.mutex.Lock()
	if !e.active {
		e.mutex.Unlock()
		return
	}
	e.active = false
	e.mutex.Unlock()
	e.cancel()
}

func (e *NewWindowExecutor) Active() bool {
	e.mutex.Lock()
	defer e.mutex.Unlock()
	return e.active
}

func (e *NewWindowExecutor) Failed() bool {
	e.mutex.Lock()
	defer e.mutex.Unlock()
	return e.failed
}
