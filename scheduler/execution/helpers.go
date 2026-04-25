package execution

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"
)

func GracefulExit(app *fiber.App, callback func()) {
	signalChan := make(chan os.Signal, 1)
	signal.Notify(signalChan, syscall.SIGINT, syscall.SIGTERM)

	sig := <-signalChan
	log.Printf("Catch signal: %+v, try to clean and exit", sig)

	q := GetTaskQueue()
	runningTask := q.RunningTask()
	if runningTask != nil {
		log.Println("Cancelling current task...")
		if strings.HasPrefix(strings.ToLower(strings.TrimSpace(runningTask.Shell)), "pty:") {
			if ok := q.CancelTask(runningTask.ID); !ok {
				log.Printf("PTY task %d is not cancellable (already finished or not running)", runningTask.ID)
			}
		}

		for i := 0; q.IsRunning(); i++ {
			dots := strings.Repeat(".", i%4)
			fmt.Printf("\rWaiting queue finish%s (press Ctrl+C to force exit) ", dots)
			time.Sleep(500 * time.Millisecond)
		}
		runningTask.Status = "cancelled"
		log.Println("Task queue stopped, press Ctrl-C again to exit scheduler")
		go GracefulExit(app, callback)
		return
	}

	Close()
	log.Println("Server exit")

	shutdownDone := make(chan struct{})
	go func() {
		_ = app.Shutdown()
		close(shutdownDone)
	}()
	select {
	case <-shutdownDone:
	case <-time.After(3 * time.Second):
	}
	callback()
}

func OpenBrowser(url string) {
	var command string
	switch runtime.GOOS {
	case "windows":
		command = fmt.Sprintf("start %s", url)
	case "darwin":
		command = fmt.Sprintf("open %s", url)
	default:
		command = fmt.Sprintf("xdg-open %s", url)
	}

	taskQueue := GetTaskQueue()
	taskQueue.AddTask([]string{command}, "")
}
