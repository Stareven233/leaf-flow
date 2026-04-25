package execution

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"scheduler/utils"

	mmap "github.com/edsrzf/mmap-go"
)

var (
	tempFilePath string
	tempFileOnce sync.Once
	tempMmap     mmap.MMap
	tempFile     *os.File
	tempMu       sync.Mutex
)

func init() {
	config := utils.GetConfig(false)
	tempDir := filepath.Join(config.YamlDir, "..", "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		panic("failed to create temp directory for mmap file")
	}
	absPath, err := filepath.Abs(filepath.Join(tempDir, "temp.leaf.mmap"))
	if err != nil {
		panic("failed to get absolute path for mmap file")
	}
	tempFilePath = filepath.ToSlash(absPath)
}

func GetMmapPath() string {
	return tempFilePath
}

func ReplaceMmapMarker(commands []string) []string {
	if tempFilePath == "" {
		return commands
	}
	result := make([]string, len(commands))
	config := utils.GetConfig(false)
	for i, cmd := range commands {
		result[i] = strings.ReplaceAll(cmd, config.MmapMarker, tempFilePath)
	}
	return result
}

func InitMmap() error {
	var initErr error
	tempFileOnce.Do(func() {
		initErr = remapMmap()
	})
	return initErr
}

func remapMmap() error {
	if tempMmap != nil {
		_ = tempMmap.Unmap()
		tempMmap = nil
	}
	if tempFile != nil {
		_ = tempFile.Close()
		tempFile = nil
	}

	f, err := os.OpenFile(tempFilePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to open temp file: %w", err)
	}
	if err = f.Truncate(int64(utils.GetConfig(false).MmapSize) * 1024 * 1024); err != nil {
		_ = f.Close()
		return fmt.Errorf("failed to truncate temp file: %w", err)
	}
	m, err := mmap.Map(f, mmap.RDWR, 0)
	if err != nil {
		_ = f.Close()
		return fmt.Errorf("failed to mmap temp file: %w", err)
	}
	tempFile = f
	tempMmap = m
	return nil
}

func ResetMmap() {
	tempMu.Lock()
	defer tempMu.Unlock()

	if tempMmap != nil {
		for i := range tempMmap {
			tempMmap[i] = 0
		}
		_ = tempMmap.Flush()
		return
	}

	f, err := os.OpenFile(tempFilePath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	_ = f.Truncate(int64(utils.GetConfig(false).MmapSize) * 1024 * 1024)
}

func CloseMmap() {
	tempMu.Lock()
	defer tempMu.Unlock()
	if tempMmap != nil {
		_ = tempMmap.Flush()
		_ = tempMmap.Unmap()
		tempMmap = nil
	}
	if tempFile != nil {
		_ = tempFile.Close()
		tempFile = nil
	}
}
