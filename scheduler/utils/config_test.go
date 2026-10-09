package utils

import (
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	tests := []struct {
		input    string
		expected time.Duration
		hasErr   bool
	}{
		{"", 0, false},
		{"   ", 0, false},
		{"24h", 24 * time.Hour, false},
		{"7d", 7 * 24 * time.Hour, false},
		{"1.5d", 36 * time.Hour, false},
		{"30m", 30 * time.Minute, false},
		{"invalid", 0, true},
		{"xd", 0, true},
	}

	for _, tt := range tests {
		dur, err := ParseDuration(tt.input)
		if (err != nil) != tt.hasErr {
			t.Errorf("ParseDuration(%q) error = %v, wantErr %v", tt.input, err, tt.hasErr)
			continue
		}
		if dur != tt.expected {
			t.Errorf("ParseDuration(%q) = %v, want %v", tt.input, dur, tt.expected)
		}
	}
}

func TestGetUploadTTLDuration(t *testing.T) {
	c1 := Config{UploadTTL: "24h"}
	if c1.GetUploadTTLDuration() != 24*time.Hour {
		t.Fatalf("expected 24h, got %v", c1.GetUploadTTLDuration())
	}

	c2 := Config{UploadTTL: ""}
	if c2.GetUploadTTLDuration() != 0 {
		t.Fatalf("expected 0 for empty TTL, got %v", c2.GetUploadTTLDuration())
	}

	c3 := Config{UploadTTL: "invalid"}
	if c3.GetUploadTTLDuration() != 0 {
		t.Fatalf("expected 0 for invalid TTL, got %v", c3.GetUploadTTLDuration())
	}
}
