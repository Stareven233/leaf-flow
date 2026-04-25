package utils

import (
	"fmt"
	"strconv"
	"strings"
)

type RGB struct {
	R int
	G int
	B int
}

const resetCode = "\x1b[0m"

type colorDefinitions struct {
	Black       string
	Red         string
	Green       string
	ForestGreen string
	Yellow      string
	Blue        string
	Magenta     string
	Cyan        string
	White       string
	Orange      string
	LightOrange string
	Pink        string
	Purple      string
	Brown       string
}

var Colors = colorDefinitions{
	Black:       "\x1b[90m",
	Red:         "\x1b[91m",
	Green:       "\x1b[92m",
	ForestGreen: "rgb:111,194,118",
	Yellow:      "\x1b[93m",
	Blue:        "\x1b[94m",
	Magenta:     "\x1b[95m",
	Cyan:        "\x1b[96m",
	White:       "\x1b[97m",
	Orange:      "rgb:255,135,6",
	LightOrange: "rgb:253,170,72",
	Pink:        "rgb:255,183,206",
	Purple:      "rgb:128,0,128",
	Brown:       "rgb:165,42,42",
}

func ColorInRGB(s string, rgb RGB) string {
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm%s%s", rgb.R, rgb.G, rgb.B, s, resetCode)
}

func parseRGBColor(colorDef string) (RGB, bool) {
	def := strings.TrimSpace(colorDef)
	if !strings.HasPrefix(strings.ToLower(def), "rgb:") {
		return RGB{}, false
	}

	raw := strings.TrimSpace(def[len("rgb:"):])
	parts := strings.Split(raw, ",")
	if len(parts) != 3 {
		return RGB{}, false
	}

	values := [3]int{}
	for i, part := range parts {
		n, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || n < 0 || n > 255 {
			return RGB{}, false
		}
		values[i] = n
	}

	return RGB{R: values[0], G: values[1], B: values[2]}, true
}

func Color(s string, colorDef string) string {
	color := strings.TrimSpace(colorDef)
	if color == "" {
		return s
	}

	if strings.HasPrefix(color, "\x1b[") {
		return color + s + resetCode
	}

	if rgb, ok := parseRGBColor(color); ok {
		return ColorInRGB(s, rgb)
	}

	return s
}
