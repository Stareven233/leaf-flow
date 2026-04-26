<div align="center">
  <p align="center">
    <img src="assets/banner.png" alt="Logo" width="400" />
  </p>
  leaf-flow (leaf², a <b>l</b>ightweight <b>ea</b>sy <b>f</b>ast and <b>f</b>lexible execution framework) ，一个轻量的声明式执行框架，支持通过 YAML 配置快速为 CLI/TUI 工具生成结构化的交互界面，试图填补 Gradio 的“笨重” 与 ComfyUI 的“复杂” 之间的空白。

  <br/>

  <!-- <a href="https://demo-link.com">🚀 Live Demo</a> · 
  <a href="#quick-start">📖 Docs</a> -->
</div>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.9.4-94f6b8" alt="version" />
  <!-- <img src="https://img.shields.io/badge/license-AGPLv3-BD0000" alt="agplv3" /> -->
  <img src="https://img.shields.io/badge/Bun-1.3-fbf0df?logo=bun" alt="bun" />
  <img src="https://img.shields.io/badge/Solid-1.9-2C4F7C?logo=solid" alt="solid" />
  <img src="https://img.shields.io/badge/Go-1.25-00ADD8?logo=go" alt="go" />
  <img src="https://img.shields.io/github/stars/Stareven233/leaf-flow?style=social" alt="stars" />
</p>

## 特性
为机器学习项目提供图形界面通常 Gradio 与 ComfyUI 是主流选择，但各有局限：  
- **Gradio**：开发快但启动慢，不灵活，依赖 Python
- **ComfyUI**：很灵活但略显复杂，学习成本高，依赖 Python

而 **leaf²** 有一个更好的平衡：
- ⚡ 轻量快速，1秒启动  
- 🎨 简洁直观的表单交互  
- ✨ 多模块统一管理  
- 🔧 复用模块，简单工作流  

## 快速开始
### 预构建
下载Release提供的压缩包，解压后运行`leaf.exe`

### 手动构建
环境要求：
- `Bun` ≥ 1.3
- `Go` ≥ 1.25

注：除windows以外，linux等其他操作系统未经测试，但理论上支持

## 核心概念
- **模块 (Module)**: 最小可执行单元，对应一个任务，包含一条或多条命令
- **项目 (Project)**: 模块的集合，一次选定一个模块执行
- **分支 (Branch)**: 模块的另一种集合，一次串行执行多个模块
- **流 (Flow)**: 分支的集合，一次选定一条分支执行
- **蓝图 (Bud)**: leaf²可解析的yaml文件，组织上述项目(leaf)/流(sprig)，渲染对应UI
- **调度器 (Scheduler)**: 管理任务队列，保证命令串行执行

leaf²选择 YAML 配置来组织程序（CLI/TUI）的命令行参数，并据此生成相应的交互界面。在界面上设定好参数然后组装成可执行命令发送给调度器，各命令按顺序串行执行   

关于蓝图（bud）如何编写，可参考[蓝图手册](assets/bud-manual_zh-CN.md)：

## 速览
基于 0.9.4 版本

### 最小例子
下面是一段最小的合法 leaf bud
```yaml
name: 最小示例
modules:
  - key: intro
    template: 'echo "你好: #{name}"'
    arguments:
      - key: name
        name: 姓名
        value: Leaf²
```

leaf²会将其渲染为如下页面，有一个文本输入框，默认值为 "Leaf²"。点击右下角预览按钮会渲染出当前命令，点击执行按钮命令 `echo "你好: Leaf²"` 将被送到终端执行
<p align="center">
  <img src="assets/screenshots/minimum-example.png" alt="minimum-example" width="900" />
</p>

### 蓝图卡片
leaf²启动后默认启动打开首页，将展示 `bud/` 目录下的所有蓝图。卡片展示名称、简介（支持精简markdown）、模块tab（可点击）
<p align="center">
  <img src="assets/screenshots/home.png" alt="home" width="900" />
</p>

### 执行历史
页面右上角提供执行历史列表，显示执行的模块、参数，点击后自动跳转填充。目前队列容量20，所有模块共享。
<p align="center">
  <img src="assets/screenshots/execution-history.png" alt="home" width="900" />
</p>

### 任务队列
右上角任务详情按钮可以看到正在执行的命令输出与任务队列，支持对正在执行与等待的任务进行撤销
<p align="center">
  <img src="assets/screenshots/task-detail.png" alt="home" width="900" />
</p>

### Flow & 临时文件
flow支持连续执行多个模块（任务），对应的命令同样按顺序串行执行。输入输出支持临时文件（mmap方式），使数据在模块间更迅速地流动。
<p align="center">
  <img src="assets/screenshots/mmap-flow.png" alt="home" width="900" />
</p>

## 许可证
leaf-flow 基于 **AGPL 3.0** 发布。
