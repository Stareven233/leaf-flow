//go:build !windows

package execution

import (
	"os"
	"os/exec"
	"strings"
	"syscall"
)

func configureProcessGroup(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
		Pgid:    0,
	}
}

func (e *SharedExecutor) exit() error {
	var err error
	pgid := -e.cmd.Process.Pid

	if err = e.cmd.Process.Signal(os.Interrupt); err == nil {
		return nil
	}

	if err = syscall.Kill(pgid, syscall.SIGTERM); err == nil {
		return nil
	}

	if err = syscall.Kill(pgid, syscall.SIGKILL); err == nil {
		return nil
	}
	return err
}

func StartConsoleInputBridge() func() {
	return func() {}
}

func parseCommandArgs(command string) ([]string, error) {
	command = strings.TrimSpace(command)
	if command == "" {
		return nil, nil
	}
	return splitWithQuotes(command), nil
}
