//go:build !windows

package execution

import "errors"

func (e *NewWindowExecutor) startNewWindow(_ []string) error {
	return errors.New("new: is only supported on Windows")
}
