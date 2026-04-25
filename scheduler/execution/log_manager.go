package execution

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"scheduler/utils"
)

type LogType string

const (
	LogTypeStdout     LogType = "out"
	LogTypeStderr     LogType = "err"
	LogTypeTaskStatus LogType = "task_status"
)

type LogManager struct {
	statusClients map[chan string]struct{}
	streamClients map[chan []byte]struct{}
	lock          sync.RWMutex
	logFile       *os.File
	logMutex      sync.Mutex
}

var (
	logManager     *LogManager
	logManagerOnce sync.Once
)

func GetLogManager() *LogManager {
	logManagerOnce.Do(func() {
		logManager = &LogManager{
			statusClients: make(map[chan string]struct{}),
			streamClients: make(map[chan []byte]struct{}),
		}
		logManager.initLocalFile()
	})
	return logManager
}

func (lm *LogManager) NumClients() int {
	lm.lock.RLock()
	defer lm.lock.RUnlock()
	return len(lm.statusClients) + len(lm.streamClients)
}

func (lm *LogManager) initLocalFile() {
	cfg := utils.GetConfig(false)
	if cfg.LogDir == "" {
		return
	}

	if err := os.MkdirAll(cfg.LogDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log dir: %v\n", err)
		return
	}

	filename := time.Now().Format("2006-01-02_15-04-05") + ".log"
	filePath := filepath.Join(cfg.LogDir, filename)

	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create log file: %v\n", err)
		return
	}
	lm.logFile = f
}

func (lm *LogManager) WriteLocalLog(content string) {
	lm.logMutex.Lock()
	if lm.logFile != nil {
		_, _ = lm.logFile.WriteString(content + "\n")
	}
	lm.logMutex.Unlock()
}

func (lm *LogManager) Close() {
	lm.lock.Lock()
	statusClients := lm.statusClients
	streamClients := lm.streamClients
	lm.statusClients = make(map[chan string]struct{})
	lm.streamClients = make(map[chan []byte]struct{})
	lm.lock.Unlock()

	for ch := range statusClients {
		close(ch)
	}
	for ch := range streamClients {
		close(ch)
	}

	lm.logMutex.Lock()
	if lm.logFile != nil {
		_ = lm.logFile.Close()
		lm.logFile = nil
	}
	lm.logMutex.Unlock()
}

func (lm *LogManager) SubscribeStatus() chan string {
	lm.lock.Lock()
	defer lm.lock.Unlock()
	ch := make(chan string, 100)
	lm.statusClients[ch] = struct{}{}
	return ch
}

func (lm *LogManager) UnsubscribeStatus(ch chan string) {
	lm.lock.Lock()
	defer lm.lock.Unlock()
	if _, ok := lm.statusClients[ch]; ok {
		delete(lm.statusClients, ch)
		close(ch)
	}
}

func (lm *LogManager) SubscribeStream() chan []byte {
	lm.lock.Lock()
	defer lm.lock.Unlock()
	ch := make(chan []byte, 100)
	lm.streamClients[ch] = struct{}{}
	return ch
}

func (lm *LogManager) UnsubscribeStream(ch chan []byte) {
	lm.lock.Lock()
	defer lm.lock.Unlock()
	if _, ok := lm.streamClients[ch]; ok {
		delete(lm.streamClients, ch)
		close(ch)
	}
}

func (lm *LogManager) Broadcast(logType LogType, content []byte) {
	if len(content) == 0 {
		return
	}

	lm.lock.RLock()
	if len(lm.streamClients) == 0 {
		lm.lock.RUnlock()
		lm.WriteLocalLog(fmt.Sprintf("%s [%s] %s", time.Now().Format(time.DateTime), logType, string(content)))
		return
	}

	payload := append([]byte(nil), content...)
	for ch := range lm.streamClients {
		select {
		case ch <- payload:
		default:
		}
	}
	lm.lock.RUnlock()
	lm.WriteLocalLog(fmt.Sprintf("%s [%s] %s", time.Now().Format(time.DateTime), logType, string(content)))
}

func (lm *LogManager) BroadcastTaskStatus(content string) {
	if content == "" {
		return
	}

	lm.lock.RLock()
	for ch := range lm.statusClients {
		select {
		case ch <- content:
		default:
		}
	}
	lm.lock.RUnlock()
	lm.WriteLocalLog(fmt.Sprintf("%s [%s] %s", time.Now().Format(time.DateTime), LogTypeTaskStatus, content))
}
