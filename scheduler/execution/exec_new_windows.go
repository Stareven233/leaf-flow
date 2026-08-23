//go:build windows

package execution

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"unicode/utf16"
)

func (e *NewWindowExecutor) startNewWindow(commands []string) error {
	filePath, err := newWindowShellPath(e.shell)
	if err != nil {
		return err
	}

	encodedCommand := encodePowerShellCommand(strings.Join(commands, "\r\n"))
	launcherScript := fmt.Sprintf(
		"Start-Process -FilePath '%s' -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', '%s')",
		filePath,
		encodedCommand,
	)

	launcher := exec.Command(
		"powershell.exe",
		"-NoLogo",
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		launcherScript,
	)
	if err := launcher.Start(); err != nil {
		return fmt.Errorf("start new %s window: %w", e.shell, err)
	}

	return launcher.Process.Release()
}

func newWindowShellPath(shell string) (string, error) {
	switch strings.ToLower(shell) {
	case "powershell", "powershell5", "ps", "ps5":
		return "powershell.exe", nil
	case "pwsh", "powershell7", "ps7":
		return "pwsh.exe", nil
	default:
		return "", errors.New("new: only supports PowerShell shells on Windows (ps, ps5, pwsh, ps7)")
	}
}

func encodePowerShellCommand(command string) string {
	codeUnits := utf16.Encode([]rune(command))
	bytes := make([]byte, len(codeUnits)*2)
	for i, codeUnit := range codeUnits {
		bytes[i*2] = byte(codeUnit)
		bytes[i*2+1] = byte(codeUnit >> 8)
	}
	return base64.StdEncoding.EncodeToString(bytes)
}
