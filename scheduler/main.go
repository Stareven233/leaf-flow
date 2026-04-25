package main

import (
	"fmt"
	"log"
	"path/filepath"
	nexec "scheduler/execution"
	"scheduler/routes"
	"scheduler/utils"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/static"
)

var exitCh = make(chan struct{})
var exitOnce sync.Once

func signalExit() {
	exitOnce.Do(func() {
		close(exitCh)
	})
}

func main() {
	config := utils.GetConfig(false)
	config.PrintStartMessage()
	stopConsoleBridge := nexec.StartConsoleInputBridge()
	defer stopConsoleBridge()

	app := fiber.New(fiber.Config{
		AppName: "Leaf",
	})
	fiberConfig := fiber.ListenConfig{DisableStartupMessage: true}

	app.Use(logger.New())
	app.Use(cors.New())

	routes.Register(app.Group("/api"), config)

	app.Use("/", static.New(config.UIDir))

	app.Get("*", func(c fiber.Ctx) error {
		if c.Path() == "/api" || strings.HasPrefix(c.Path(), "/api/") {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return c.SendFile(filepath.Join(config.UIDir, "index.html"))
	})

	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	url := fmt.Sprintf("http://%s", addr)
	fmt.Println("Server started on:", utils.Color(url, utils.Colors.LightOrange))
	go func() {
		if err := app.Listen(addr, fiberConfig); err != nil {
			log.Printf("Server Listen error: %v", err)
		}
	}()

	if !config.IsDev && config.OpenBrowser {
		time.Sleep(500 * time.Millisecond)
		<-time.After(200 * time.Millisecond)
		go nexec.OpenBrowser(url)
	}

	go nexec.GracefulExit(app, signalExit)
	<-exitCh
}
