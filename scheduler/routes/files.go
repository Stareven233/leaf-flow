package routes

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

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

func getUploadRoot() string {
	if execDir != "" {
		return filepath.Join(execDir, "temp", "uploads")
	}
	return filepath.Join(".", "temp", "uploads")
}

func computeStreamSHA256Hex(r io.Reader, hexLen int) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, r); err != nil {
		return "", err
	}
	fullHex := hex.EncodeToString(hasher.Sum(nil))
	if hexLen > len(fullHex) {
		hexLen = len(fullHex)
	}
	return fullHex[:hexLen], nil
}

func cleanExpiredUploads(uploadRoot string, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	entries, err := os.ReadDir(uploadRoot)
	if err != nil {
		return
	}
	now := time.Now()
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) > ttl {
			filePath := filepath.Join(uploadRoot, e.Name())
			if err := os.Remove(filePath); err == nil {
				log.Printf("[Upload Clean] Removed expired upload: %s (modTime: %v)", e.Name(), info.ModTime())
			}
		}
	}
}

var (
	lastCleanTime time.Time
	cleanMutex    sync.Mutex
)

func maybeCleanExpiredUploads(uploadRoot string, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	cleanMutex.Lock()
	defer cleanMutex.Unlock()
	if time.Since(lastCleanTime) < 10*time.Minute {
		return
	}
	lastCleanTime = time.Now()
	go cleanExpiredUploads(uploadRoot, ttl)
}

func fileUpload(c fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return JSONResponse(c.Status(400), false, fmt.Sprintf("failed to parse multipart form: %v", err))
	}
	if form == nil || len(form.File) == 0 {
		return JSONResponse(c.Status(400), false, "no files uploaded")
	}

	var fileHeaders []*multipart.FileHeader
	if f, exists := form.File["files"]; exists {
		fileHeaders = append(fileHeaders, f...)
	}
	if f, exists := form.File["file"]; exists {
		fileHeaders = append(fileHeaders, f...)
	}
	if len(fileHeaders) == 0 {
		for _, fList := range form.File {
			fileHeaders = append(fileHeaders, fList...)
		}
	}

	if len(fileHeaders) == 0 {
		return JSONResponse(c.Status(400), false, "no files found in request")
	}

	uploadRoot := getUploadRoot()
	if ttl := gconfig.GetUploadTTLDuration(); ttl > 0 {
		maybeCleanExpiredUploads(uploadRoot, ttl)
	}

	var uploadedPaths []string

	for _, fileHeader := range fileHeaders {
		cleanedFilename := strings.ReplaceAll(fileHeader.Filename, "\\", "/")
		rawFilename := filepath.Base(cleanedFilename)
		if rawFilename == "." || rawFilename == "/" || rawFilename == "" {
			rawFilename = "upload"
		}
		ext := filepath.Ext(rawFilename)
		nameWithoutExt := strings.TrimSuffix(rawFilename, ext)
		if nameWithoutExt == "" {
			nameWithoutExt = "upload"
		}

		f, err := fileHeader.Open()
		if err != nil {
			return JSONResponse(c.Status(500), false, fmt.Sprintf("failed to open file %s: %v", rawFilename, err))
		}
		hash12, err := computeStreamSHA256Hex(f, 12)
		f.Close()
		if err != nil {
			return JSONResponse(c.Status(500), false, fmt.Sprintf("failed to compute hash for %s: %v", rawFilename, err))
		}

		targetFilename := fmt.Sprintf("%s_%s%s", nameWithoutExt, hash12, ext)
		targetPath := filepath.Join(uploadRoot, targetFilename)

		if info, err := os.Stat(targetPath); err == nil && info.Size() == fileHeader.Size {
			now := time.Now()
			_ = os.Chtimes(targetPath, now, now)
		} else {
			if err := os.MkdirAll(uploadRoot, 0755); err != nil {
				return JSONResponse(c.Status(500), false, fmt.Sprintf("failed to create upload directory: %v", err))
			}
			if err := c.SaveFile(fileHeader, targetPath); err != nil {
				return JSONResponse(c.Status(500), false, fmt.Sprintf("failed to save file: %v", err))
			}
		}

		absPath, err := filepath.Abs(targetPath)
		if err != nil {
			absPath = targetPath
		}
		uploadedPaths = append(uploadedPaths, filepath.ToSlash(filepath.Clean(absPath)))
	}

	return JSONResponse(c, true, "upload success", uploadedPaths)
}

func getFileRoutes() []NRoute {
	return []NRoute{
		{"/file", "GET", fileGet},
		{"/directory", "GET", dirGet},
		{"/directory", "POST", dirPost},
		{"/path-absolute", "GET", pathAbsolute},
		{"/path-type", "GET", pathType},
		{"/upload", "POST", fileUpload},
	}
}
