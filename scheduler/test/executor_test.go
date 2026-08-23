package test

import (
	"testing"

	"scheduler/execution"
)

func TestNewWindowExecutor(t *testing.T) {
	executor, err := execution.InitExecutor("  NeW:Ps  ")
	if err != nil {
		t.Fatalf("InitExecutor() error = %v", err)
	}
	defer executor.Exit()

	if _, ok := executor.(*execution.NewWindowExecutor); !ok {
		t.Fatalf("InitExecutor() type = %T, want *execution.NewWindowExecutor", executor)
	}
	for _, command := range []string{"Write-Host 'first'", "Write-Host 'second'"} {
		if err := executor.Add(command); err != nil {
			t.Fatalf("Add(%q) error = %v", command, err)
		}
	}
}

func TestNewWindowExecutorDefaultsToPowerShell(t *testing.T) {
	executor, err := execution.InitExecutor("new:")
	if err != nil {
		t.Fatalf("InitExecutor() error = %v", err)
	}
	defer executor.Exit()

	if _, ok := executor.(*execution.NewWindowExecutor); !ok {
		t.Fatalf("InitExecutor() type = %T, want *execution.NewWindowExecutor", executor)
	}
}
