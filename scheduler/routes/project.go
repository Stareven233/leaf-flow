package routes

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v3"
)

type newYamlReq struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func listYamls(root string) ([]string, error) {
	var yamls []string = []string{}
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".yaml" && ext != ".yml" {
			return nil
		}
		raw, e := os.ReadFile(path)
		if e != nil {
			return nil
		}
		yamls = append(yamls, string(raw))
		return nil
	})
	return yamls, err
}

func findYaml(dir, name string) (string, error) {
	path := filepath.Join(dir, name+".yaml")
	if raw, err := os.ReadFile(path); err == nil {
		return string(raw), nil
	}
	path = filepath.Join(dir, name+".yml")
	if raw, err := os.ReadFile(path); err == nil {
		return string(raw), nil
	}
	return "", os.ErrNotExist
}

func projectsGet(c fiber.Ctx) error {
	root := c.Query("root", gconfig.YamlDir)
	base := c.Query("base", "leaf")
	name := c.Query("name")

	if name == "" {
		yamls, err := listYamls(root)
		if err != nil {
			return JSONResponse(c.Status(400), false, err.Error())
		}
		return JSONResponse(c, true, "", yamls)
	}
	var result []string

	if strings.Contains(name, "|") {
		names := strings.SplitSeq(name, "|")
		for n := range names {
			content, err := findYaml(filepath.Join(root, base), n)
			if err != nil {
				return JSONResponse(c.Status(404), false, fmt.Sprintf("Project '%s' not found in base", n))
			}
			result = append(result, content)
		}
		return JSONResponse(c, true, "", result)
	}

	baseContent, err := findYaml(filepath.Join(root, base), name)
	if err != nil {
		return JSONResponse(c.Status(404), false, fmt.Sprintf("Project '%s' not found in '%s'", name, base))
	}
	result = append(result, baseContent)

	patchesStr := c.Query("patches")
	if patchesStr != "" {
		patches := strings.SplitSeq(patchesStr, "|")
		for p := range patches {
			patchContent, err := findYaml(filepath.Join(root, p), name)
			if err == nil {
				result = append(result, patchContent)
			}
		}
	}

	return JSONResponse(c, true, "", result)
}

func projectsPostfunc(c fiber.Ctx) error {
	var req newYamlReq
	if err := c.Bind().JSON(&req); err != nil {
		return JSONResponse(c.Status(400), false, "Error: (invalid json) "+err.Error())
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || strings.ContainsAny(req.Name, `/\`) {
		return JSONResponse(c.Status(400), false, "Invalid file name")
	}

	// 自动补 .yaml 后缀（可选）
	if !strings.HasSuffix(req.Name, ".yaml") && !strings.HasSuffix(req.Name, ".yml") {
		req.Name += ".yaml"
	}

	fullPath := filepath.Join(gconfig.YamlDir, req.Name)
	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		return JSONResponse(c.Status(500), false, fmt.Sprintf("write failed: %v", err))
	}

	return JSONResponse(c, true, fmt.Sprintf("saved config to %v", fullPath))
}

func configGet(c fiber.Ctx) error {
	return JSONResponse(c, true, "", gconfig)
}

// getProjectRoutes 返回项目相关的路由列表
func getProjectRoutes() []NRoute {
	return []NRoute{
		{"/projects", "GET", projectsGet},
		{"/projects", "POST", projectsPostfunc},
		{"/config", "GET", configGet},
	}
}
