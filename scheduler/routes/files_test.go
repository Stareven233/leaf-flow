package routes

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	nconfig "scheduler/utils"

	"github.com/gofiber/fiber/v3"
)

func TestComputeStreamSHA256Hex(t *testing.T) {
	emptyHash, err := computeStreamSHA256Hex(strings.NewReader(""), 12)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if emptyHash != "e3b0c44298fc" {
		t.Fatalf("expected e3b0c44298fc, got %s", emptyHash)
	}

	textHash, err := computeStreamSHA256Hex(strings.NewReader("hello leaf"), 12)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(textHash) != 12 {
		t.Fatalf("expected length 12, got %d (%s)", len(textHash), textHash)
	}
}

func TestCleanExpiredUploads(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "leaf_upload_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	freshFile := filepath.Join(tmpDir, "fresh_1234567890ab.txt")
	expiredFile := filepath.Join(tmpDir, "expired_1234567890ab.txt")

	if err := os.WriteFile(freshFile, []byte("fresh"), 0644); err != nil {
		t.Fatalf("failed to write fresh file: %v", err)
	}
	if err := os.WriteFile(expiredFile, []byte("expired"), 0644); err != nil {
		t.Fatalf("failed to write expired file: %v", err)
	}

	twoDaysAgo := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(expiredFile, twoDaysAgo, twoDaysAgo); err != nil {
		t.Fatalf("failed to chtimes: %v", err)
	}

	cleanExpiredUploads(tmpDir, 24*time.Hour)

	if _, err := os.Stat(expiredFile); !os.IsNotExist(err) {
		t.Errorf("expired file should be removed, but stat err = %v", err)
	}
	if _, err := os.Stat(freshFile); err != nil {
		t.Errorf("fresh file should be kept, but stat err = %v", err)
	}
}

func TestFileUploadRoute(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "leaf_exec_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	origExecDir := execDir
	execDir = tmpDir
	defer func() { execDir = origExecDir }()

	app := fiber.New(fiber.Config{
		BodyLimit: 100 * 1024 * 1024,
	})
	Register(app.Group("/api"), nconfig.Config{UploadTTL: ""})

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("files", "sample.txt")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	fileContent := []byte("hello upload test content")
	if _, err := io.Copy(part, bytes.NewReader(fileContent)); err != nil {
		t.Fatalf("failed to write part: %v", err)
	}
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool     `json:"success"`
		Message string   `json:"message"`
		Data    []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !res.Success || len(res.Data) != 1 {
		t.Fatalf("expected 1 uploaded path, got %+v", res)
	}

	savedPath := filepath.FromSlash(res.Data[0])
	info1, err := os.Stat(savedPath)
	if err != nil {
		t.Fatalf("uploaded file not found on disk: %v", err)
	}
	if info1.Size() != int64(len(fileContent)) {
		t.Fatalf("size mismatch: got %d, want %d", info1.Size(), len(fileContent))
	}

	time.Sleep(10 * time.Millisecond)
	oldModTime := info1.ModTime()

	body2 := &bytes.Buffer{}
	writer2 := multipart.NewWriter(body2)
	part2, _ := writer2.CreateFormFile("files", "sample.txt")
	_, _ = io.Copy(part2, bytes.NewReader(fileContent))
	writer2.Close()

	req2 := httptest.NewRequest(http.MethodPost, "/api/upload", body2)
	req2.Header.Set("Content-Type", writer2.FormDataContentType())

	resp2, err := app.Test(req2)
	if err != nil {
		t.Fatalf("second upload failed: %v", err)
	}
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("second upload status: %d", resp2.StatusCode)
	}

	info2, err := os.Stat(savedPath)
	if err != nil {
		t.Fatalf("second stat failed: %v", err)
	}
	if !info2.ModTime().After(oldModTime) && !info2.ModTime().Equal(oldModTime) {
		t.Errorf("expected modTime to be updated or equal, old=%v, new=%v", oldModTime, info2.ModTime())
	}
}

func TestFileUploadMultipleAndErrors(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "leaf_exec_multi_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	origExecDir := execDir
	execDir = tmpDir
	defer func() { execDir = origExecDir }()

	app := fiber.New()
	Register(app.Group("/api"), nconfig.Config{})

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	p1, _ := writer.CreateFormFile("files", "file1.txt")
	_, _ = p1.Write([]byte("content1"))
	p2, _ := writer.CreateFormFile("files", "file2.json")
	_, _ = p2.Write([]byte(`{"k":"v"}`))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test failed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var res struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if !res.Success || len(res.Data) != 2 {
		t.Fatalf("expected 2 files uploaded, got %+v", res)
	}

	reqEmpty := httptest.NewRequest(http.MethodPost, "/api/upload", strings.NewReader(""))
	respEmpty, err := app.Test(reqEmpty)
	if err != nil {
		t.Fatalf("empty request test failed: %v", err)
	}
	if respEmpty.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty body, got %d", respEmpty.StatusCode)
	}
}
