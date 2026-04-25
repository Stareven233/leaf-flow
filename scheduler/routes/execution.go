package routes

import (
	"bufio"
	"fmt"
	"strconv"
	"strings"
	"time"

	nexecute "scheduler/execution"

	"github.com/gofiber/fiber/v3"
)

type execReq struct {
	Commands []string `json:"commands"`
	Shell    string   `json:"shell"`
}

type execInputReq struct {
	Input string `json:"input"`
}

type execResizeReq struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

func executionPost(c fiber.Ctx) error {
	var req execReq
	if err := c.Bind().JSON(&req); err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("无效json请求: '%s'", c.Body()))
	}
	if len(req.Commands) == 0 {
		return JSONResponse(c.Status(400), false, `不存在有效指令`)
	}

	taskQueue := nexecute.GetTaskQueue()
	if taskQueue == nil {
		return JSONResponse(c.Status(500), false, `任务队列初始化失败`)
	}

	shell := strings.ToLower(strings.TrimSpace(req.Shell))
	task := taskQueue.AddTask(req.Commands, shell)

	return JSONResponse(c, true, `任务已添加到队列`, map[string]any{
		"taskId":   task.ID,
		"status":   task.Status,
		"commands": task.Commands,
		"shell":    task.Shell,
	})
}

func executionGet(c fiber.Ctx) error {
	taskQueue := nexecute.GetTaskQueue()
	if taskQueue == nil {
		return JSONResponse(c, true, `任务队列为空`, map[string]any{
			"tasks":     []*nexecute.Task{},
			"total":     0,
			"completed": 0,
			"pending":   0,
		})
	}

	allTasks := taskQueue.ListTasks()
	total := len(allTasks)
	completed := 0
	pending := 0

	for _, task := range allTasks {
		switch task.Status {
		case "completed":
			completed++
		case "pending":
			pending++
		}
	}

	limit, err := strconv.Atoi(c.Query("limit", "20"))
	if err != nil {
		limit = 20
	}
	absLimit := limit
	if absLimit < 0 {
		absLimit = -absLimit
	}
	taskIdStr := c.Query("taskId")
	var startIndex, endIndex int
	tasks := []*nexecute.Task{}

	if taskIdStr == "" {
		startIndex = max(total-absLimit, 0)
		tasks = allTasks[startIndex:]
	} else {
		taskId, err := strconv.Atoi(taskIdStr)
		if err != nil {
			return JSONResponse(c.Status(400), false, fmt.Sprintf("无效的 taskId: '%s'", taskIdStr))
		}

		if limit > 0 {
			startIndex = max(taskId+1, 0)
			endIndex = min(startIndex+limit, total)
		} else {
			endIndex = min(taskId, total)
			startIndex = max(endIndex+limit, 0)
		}

		if startIndex < endIndex {
			tasks = allTasks[startIndex:endIndex]
		}
	}

	return JSONResponse(c, true, `任务队列信息`, map[string]any{
		"tasks":     tasks,
		"total":     total,
		"completed": completed,
		"pending":   pending,
	})
}

func executionDelete(c fiber.Ctx) error {
	id, err := strconv.Atoi(c.Query("taskId"))
	taskQueue := nexecute.GetTaskQueue()
	if err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("无效的 taskId: '%d'", id))
	}

	if taskQueue == nil {
		return JSONResponse(c.Status(404), false, "任务队列不存在")
	}

	success := taskQueue.CancelTask(id)
	if !success {
		return JSONResponse(c.Status(404), false, fmt.Sprintf("任务 %d 不存在", id))
	}

	return JSONResponse(c, true, fmt.Sprintf("任务 %d 已取消", id))
}

func executionInputPost(c fiber.Ctx) error {
	var req execInputReq
	if err := c.Bind().JSON(&req); err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("无效json请求: '%s'", c.Body()))
	}

	taskQueue := nexecute.GetTaskQueue()
	if taskQueue == nil {
		return JSONResponse(c.Status(500), false, "任务队列不存在")
	}

	if err := taskQueue.Input(req.Input); err != nil {
		return JSONResponse(c.Status(409), false, err.Error())
	}

	return JSONResponse(c, true, "输入已写入")
}

func executionResizePost(c fiber.Ctx) error {
	var req execResizeReq
	if err := c.Bind().JSON(&req); err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("无效json请求: '%s'", c.Body()))
	}
	if req.Cols <= 0 || req.Rows <= 0 {
		return JSONResponse(c.Status(400), false, "终端尺寸无效")
	}

	taskQueue := nexecute.GetTaskQueue()
	if taskQueue == nil {
		return JSONResponse(c, true, "任务队列不存在，忽略终端尺寸同步")
	}

	if err := taskQueue.Resize(req.Cols, req.Rows); err != nil {
		return JSONResponse(c.Status(500), false, err.Error())
	}

	return JSONResponse(c, true, "终端尺寸已同步")
}

func executionLogsEvent(c fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	lm := nexecute.GetLogManager()
	ch := lm.SubscribeStatus()

	return c.SendStreamWriter(func(w *bufio.Writer) {
		defer lm.UnsubscribeStatus(ch)
		fmt.Fprintf(w, ": heartbeat\n\n")
		w.Flush()
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case msg, ok := <-ch:
				if !ok {
					return
				}

				fmt.Fprintf(w, "data: %s\n\n", msg)
				if err := w.Flush(); err != nil {
					if !isExpectedSSEDisconnect(err) {
						fmt.Printf("SSE flush error: %v\n", err)
					}
					return
				}
			case <-ticker.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})
}

func executionLogsStream(c fiber.Ctx) error {
	c.Set("Content-Type", "application/octet-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	lm := nexecute.GetLogManager()
	ch := lm.SubscribeStream()

	return c.SendStreamWriter(func(w *bufio.Writer) {
		defer lm.UnsubscribeStream(ch)

		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case chunk, ok := <-ch:
				if !ok {
					return
				}
				if _, err := w.Write(chunk); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			case <-ticker.C:
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})
}

func isExpectedSSEDisconnect(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "connection closed") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "reset by peer") ||
		strings.Contains(msg, "closed network connection")
}

func getExecutionRoutes() []NRoute {
	return []NRoute{
		{"/execution", "POST", executionPost},
		{"/execution", "GET", executionGet},
		{"/execution", "DELETE", executionDelete},
		{"/execution/input", "POST", executionInputPost},
		{"/execution/resize", "POST", executionResizePost},
		{"/execution/logs-event", "GET", executionLogsEvent},
		{"/execution/logs-stream", "GET", executionLogsStream},
	}
}
