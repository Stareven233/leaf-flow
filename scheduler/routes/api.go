package routes

import (
	nconfig "scheduler/utils"

	"github.com/gofiber/fiber/v3"
)

type Response struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func JSONResponse(c fiber.Ctx, args ...any) error {
	resp := Response{Success: true}
	if len(args) > 0 {
		if flag, ok := args[0].(bool); ok {
			resp.Success = flag
		}
	}

	if len(args) > 1 {
		if msg, ok := args[1].(string); ok {
			resp.Message = msg
		}
	}

	if len(args) > 2 {
		resp.Data = args[2]
	}
	return c.JSON(resp)
}

type NRoute struct {
	Path    string
	Method  string
	Handler fiber.Handler
}

var gconfig nconfig.Config

func Register(router fiber.Router, config nconfig.Config) {
	gconfig = config

	router.Get("/ping", func(c fiber.Ctx) error {
		return JSONResponse(c, true, "pong")
	})

	var allRoutes []NRoute
	allRoutes = append(allRoutes, getProjectRoutes()...)
	allRoutes = append(allRoutes, getFileRoutes()...)
	allRoutes = append(allRoutes, getExecutionRoutes()...)

	for _, route := range allRoutes {
		switch route.Method {
		case "GET":
			router.Get(route.Path, route.Handler)
		case "POST":
			router.Post(route.Path, route.Handler)
		case "PUT":
			router.Put(route.Path, route.Handler)
		case "DELETE":
			router.Delete(route.Path, route.Handler)
		}
	}
}
