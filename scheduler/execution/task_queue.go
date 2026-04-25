package execution

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"
)

type Task struct {
	ID        int       `json:"id"`
	Commands  []string  `json:"commands"`
	Shell     string    `json:"shell"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	StartedAt time.Time `json:"startedAt"`
	EndedAt   time.Time `json:"endedAt"`
	Error     string    `json:"error"`
}

type TaskStatusEvent struct {
	Event string `json:"event"`
	Task  Task   `json:"task"`
	Total int    `json:"total"`
}

type TaskQueue struct {
	tasks        []*Task
	currentIndex int
	executor     IExecutor
	mutex        sync.Mutex
	execMutex    sync.Mutex
	isRunning    bool
}

var queueInited = false

var GetTaskQueue = sync.OnceValue(func() *TaskQueue {
	queueInited = true
	return &TaskQueue{
		tasks:        make([]*Task, 0),
		currentIndex: -1,
		executor:     nil,
		isRunning:    false,
	}
})

func (q *TaskQueue) AddTask(commands []string, Shell string) *Task {
	q.mutex.Lock()

	task := &Task{
		ID:        len(q.tasks),
		Commands:  commands,
		Shell:     Shell,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	q.tasks = append(q.tasks, task)
	shouldStart := !q.isRunning

	if shouldStart {
		q.isRunning = true
	}
	q.mutex.Unlock()

	q.broadcastTaskStatus(task.ID)
	if shouldStart {
		go q.process()
	}

	return task
}

func (q *TaskQueue) process() {
	q.mutex.Lock()
	q.isRunning = true
	q.mutex.Unlock()

	for {
		q.mutex.Lock()
		i := q.currentIndex + 1
		for ; i < len(q.tasks); i++ {
			if q.tasks[i].Status == "pending" {
				break
			}
		}
		if i == len(q.tasks) {
			q.isRunning = false
			q.mutex.Unlock()
			break
		}
		q.currentIndex = i
		task := q.tasks[i]
		q.mutex.Unlock()

		var executor IExecutor
		var err error
		executor, err = InitExecutor(task.Shell)
		if err != nil {
			fmt.Fprintln(os.Stderr, "Executor create error:", err)
			task.Status = "failed"
			task.Error = err.Error()
			task.EndedAt = time.Now()
			q.mutex.Lock()
			q.isRunning = false
			q.mutex.Unlock()
			q.broadcastTaskStatus(task.ID)
			break
		}

		q.mutex.Lock()
		q.executor = executor
		q.mutex.Unlock()

		q.execMutex.Lock()
		q.executeTask(task)
		q.execMutex.Unlock()
	}

	if len(q.tasks) > 0 {
		failedTask := q.tasks[q.currentIndex]
		for _, task := range q.tasks[q.currentIndex+1:] {
			task.Status = failedTask.Status
			task.Error = failedTask.Error
			task.EndedAt = failedTask.EndedAt
			q.broadcastTaskStatus(task.ID)
		}
	}
	q.currentIndex = len(q.tasks) - 1
}

func (q *TaskQueue) handleFailedTask(task *Task, err error) {
	if q.executor == nil || !q.executor.Active() && !q.executor.Failed() {
		task.Status = "cancelled"
	} else {
		task.Status = "failed"
		fmt.Fprintln(os.Stderr, "Task Failed:", err)
	}
	task.Error = err.Error()
}

func (q *TaskQueue) executeTask(task *Task) {
	task.Status = "running"
	task.StartedAt = time.Now()
	q.broadcastTaskStatus(task.ID)
	ResetMmap()

	commands := ReplaceMmapMarker(task.Commands)
	isPtyExecutor := false
	if _, ok := q.executor.(*PtyExecutor); ok {
		isPtyExecutor = true
	}

	for _, cmd := range commands {
		if task.Status == "cancelled" {
			break
		}

		fmt.Printf("\n>>> [%d] %s\n", task.ID, cmd)
		if err := q.executor.Add(cmd); err != nil {
			q.handleFailedTask(task, err)
			break
		}
		if !isPtyExecutor {
			time.Sleep(600 * time.Millisecond)
		}
	}

	if err := q.executor.Run(); err != nil {
		q.handleFailedTask(task, err)
	}

	if task.Status != "cancelled" && task.Status != "failed" {
		task.Status = "completed"
	}
	task.EndedAt = time.Now()
	q.broadcastTaskStatus(task.ID)

	q.mutex.Lock()
	q.executor = nil
	q.mutex.Unlock()
}

func (q *TaskQueue) IsRunning() bool {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	return q.isRunning
}

func (q *TaskQueue) RunningTask() *Task {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if !q.isRunning {
		return nil
	}
	if q.currentIndex < 0 || q.currentIndex >= len(q.tasks) {
		return nil
	}
	return q.tasks[q.currentIndex]
}

func (q *TaskQueue) Input(input string) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if !q.isRunning || q.executor == nil {
		return errors.New("no running task")
	}

	return q.executor.Input(input)
}

func (q *TaskQueue) Resize(cols int, rows int) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if cols <= 0 || rows <= 0 {
		return nil
	}

	uiViewport.Write(cols, rows)

	if !q.isRunning || q.executor == nil {
		return nil
	}

	resizer, ok := q.executor.(interface {
		Resize(int, int) error
	})
	if !ok {
		return nil
	}

	return resizer.Resize(cols, rows)
}

func (q *TaskQueue) GetTask(id int) *Task {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if -1 < id && id < len(q.tasks) {
		return q.tasks[id]
	}

	return nil
}

func (q *TaskQueue) ListTasks() []*Task {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	result := make([]*Task, len(q.tasks))
	copy(result, q.tasks)
	return result
}

func (q *TaskQueue) CancelTask(id int) bool {
	q.mutex.Lock()
	if id < 0 || id >= len(q.tasks) {
		q.mutex.Unlock()
		return false
	}
	task := q.tasks[id]
	if task.Status == "completed" || task.Status == "failed" || task.Status == "cancelled" {
		q.mutex.Unlock()
		return false
	}

	if q.currentIndex == id {
		if q.executor != nil {
			q.executor.Exit()
		}
		q.isRunning = false
	}

	task.Status = "cancelled"
	task.EndedAt = time.Now()
	q.mutex.Unlock()

	q.broadcastTaskStatus(task.ID)
	return true
}

func (q *TaskQueue) createTaskStatusEvent(taskID int) (*TaskStatusEvent, bool) {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if taskID < 0 || taskID >= len(q.tasks) {
		return nil, false
	}

	taskSnapshot := *q.tasks[taskID]
	taskSnapshot.Commands = append([]string(nil), taskSnapshot.Commands...)
	total := len(q.tasks)

	return &TaskStatusEvent{
		Event: "task_status",
		Task:  taskSnapshot,
		Total: total,
	}, true
}

func (q *TaskQueue) broadcastTaskStatus(taskID int) {
	event, ok := q.createTaskStatusEvent(taskID)
	if !ok {
		return
	}

	jsonBytes, err := json.Marshal(event)
	if err != nil {
		return
	}
	GetLogManager().BroadcastTaskStatus(string(jsonBytes))
}

func (q *TaskQueue) Clear() {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	q.tasks = make([]*Task, 0)

	q.currentIndex = -1

	if q.executor != nil && q.executor.Active() {
		q.executor.Exit()
		q.executor = nil
	}
	q.isRunning = false
}

func Close() {
	if !queueInited {
		return
	}
	GetTaskQueue().Clear()
	GetLogManager().Close()
	CloseMmap()
}
