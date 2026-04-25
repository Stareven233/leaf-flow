package utils

import (
	"fmt"
	"log"
	"os"
	"reflect"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Version           string  `yaml:"version" json:"version"`
	Host              string  `yaml:"host" json:"host"`
	Port              int     `yaml:"port" json:"port"`
	IsDev             bool    `yaml:"isDev" json:"isDev"`
	UIDir             string  `yaml:"uiDir" json:"uiDir"`
	YamlDir           string  `yaml:"budDir" json:"budDir"`
	LogDir            string  `yaml:"logDir" json:"logDir"`
	OpenBrowser       bool    `yaml:"openBrowser" json:"openBrowser"`
	ProgressSampleGap float32 `yaml:"progressSampleGap" json:"progressSampleGap"`
	MmapMarker        string  `yaml:"mmapMarker" json:"mmapMarker"`
	MmapSize          float32 `yaml:"mmapSize" json:"mmapSize"`
}

var config Config
var LeafAsciiArt string = `   __             __ 
  / /  ___  __ _ / _|
 / /  / _ \/ _` + "`" + ` | |_ 
/ /__|  __/ (_| |  _|
\____/\___|\__,_|_|  `

func GetConfig(flush bool) Config {
	if !flush && config.Host != "" {
		return config
	}

	data, err := os.ReadFile("config.yaml")
	if err != nil {
		log.Println("Warning: config file not found, using default configuration")
		return Config{
			Version:           "0.0.0",
			Host:              "0.0.0.0",
			Port:              23334,
			IsDev:             true,
			UIDir:             "./ui",
			YamlDir:           "./bud",
			LogDir:            "./temp/log",
			OpenBrowser:       true,
			ProgressSampleGap: 1,
			MmapSize:          1,
		}
	}

	config = Config{}
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		log.Fatalf("Error parsing config.yaml: %v", err)
	}

	return config
}

func (c *Config) Print() {
	v := reflect.ValueOf(*c)
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i)
		fmt.Printf("%-40s\t%v\n", Color(field.Name, Colors.ForestGreen)+":", value)
	}
}

func (c *Config) PrintStartMessage() {
	fmt.Printf("%s\t\t%s\n", Color(LeafAsciiArt, Colors.Green), Color("v"+c.Version, Colors.LightOrange))
	fmt.Println("------------ Configuration ------------")
	c.Print()
	fmt.Println("--------------------------------------")
	fmt.Printf("%s\t%v\n", "Author:", Color("獭栖八雫@space.bilibili.com/1610042298", Colors.ForestGreen))
	fmt.Printf("%s\t%v\n", "Github:", Color("github.com/Stareven233", Colors.ForestGreen))
}
