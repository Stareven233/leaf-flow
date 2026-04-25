package routes

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v3"
)

var execDir = func() string {
	execPath, err := os.Executable()
	if err != nil {
		return ""
	}

	realPath, err := filepath.EvalSymlinks(execPath)
	if err != nil {
		return ""
	}

	dir := filepath.Dir(realPath)
	return dir
}()

type entry struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"mtime"`
	IsDir   bool   `json:"isDir"`
}

func dirGet(c fiber.Ctx) error {
	dir := c.Query("path", ".")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("os.ReadDir failed: %v", err))
	}
	list := make([]entry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, entry{
			Name:    e.Name(),
			IsDir:   e.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Unix(),
		})
	}
	return JSONResponse(c, true, "", list)
}

func fileGet(c fiber.Ctx) error {
	path := c.Query("path", "")
	if path == "" {
		return JSONResponse(c.Status(400), false, "path is required")
	}
	return c.SendFile(path)
}

type dirPostReq struct {
	Path        string `json:"path"`
	Content     string `json:"content"`
	Overwritten bool   `json:"overwritten"`
	IsDir       bool   `json:"isDir"`
}

func dirPost(c fiber.Ctx) error {
	var req dirPostReq
	if err := c.Bind().JSON(&req); err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("invalid json: %v", err))
	}

	if req.Path == "" {
		return JSONResponse(c.Status(400), false, "path is required")
	}

	_, err := os.Stat(req.Path)
	if err == nil && !req.Overwritten {
		return JSONResponse(c.Status(400), false, "already exists")
	} else if err != nil && !os.IsNotExist(err) {
		return JSONResponse(c.Status(500), false, fmt.Sprintf("stat failed: %v", err))
	}

	if req.IsDir {
		if err := os.MkdirAll(req.Path, 0755); err != nil {
			return JSONResponse(c.Status(500), false, fmt.Sprintf("mkdir failed: %v", err))
		}
		return JSONResponse(c, true, "directory created")
	}

	if err := os.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		return JSONResponse(c.Status(500), false, fmt.Sprintf("write failed: %v", err))
	}

	return JSONResponse(c, true, "file saved")
}

func pathAbsolute(c fiber.Ctx) error {
	path := c.Query("path", "")
	if path == "" {
		return JSONResponse(c.Status(400), false, "path is required")
	}

	if execDir == "" {
		return JSONResponse(c.Status(500), false, "failed to detect project root")
	}
	absPath := filepath.Clean(path)
	if !filepath.IsAbs(absPath) {
		absPath = filepath.Join(execDir, absPath)
	}
	absPath = filepath.Clean(absPath)

	absPath = filepath.ToSlash(absPath)
	return JSONResponse(c, true, "", absPath)
}

func pathType(c fiber.Ctx) error {
	path := c.Query("path", "")
	if path == "" {
		return JSONResponse(c.Status(400), false, "path is required")
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return JSONResponse(c, true, "", nil)
		}
		return JSONResponse(c.Status(500), false, fmt.Sprintf("stat failed: %v", err))
	}

	pType := "file"
	if info.IsDir() {
		pType = "directory"
	}

	return JSONResponse(c, true, "", pType)
}

func getFileRoutes() []NRoute {
	return []NRoute{
		{"/file", "GET", fileGet},
		{"/directory", "GET", dirGet},
		{"/directory", "POST", dirPost},
		{"/path-absolute", "GET", pathAbsolute},
		{"/path-type", "GET", pathType},
	}
}
