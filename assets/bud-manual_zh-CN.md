## 蓝图
蓝图，或者说嫩芽（`bud`），一个能被[leaf²](https://github.com/Stareven233/leaf-flow)解析的yaml文件。细分为叶片（`leaf`）（对应前述project/“项目”）, 枝条（`sprig`）（对应flow/“流”）两种：
- **project**：包含多个独立的 Module，每个 Module 单独执行，适合组织相关但独立的任务。
- **flow**：包含多个 Branch，每个 Branch 下的多个 Module 会一次性解析为命令批量执行，通过 mmap 可在 Module 间传递数据，并可引用已有 Project 中的 Module。

编写可参考下方配置以及 [project示例](../bud/leaf/demo.yaml), [flow示例](../bud/sprig/demo.flow.yaml) 这两个标准示例进行。   

## Project 配置

Project（项目） 配置文件定义了项目的基本信息、包含的模块 (Module) 以及每个模块可执行的命令模板和参数，`key` 字段强制且自动与配置文件名保持一致。

### 1. 核心结构

一个完整的 Project 配置文件包含以下顶层字段：

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| key | string | **是** | 项目唯一标识符，**自动与配置文件名保持一致**（不含扩展名），用于URL。 |
| name | string | 否 | 项目显示名称，未赋值则使用key。 |
| desc | string | 否 | 项目简短描述。 |
| meta | map | 否 | 元数据键值对（字符串/数字/布尔），可在模板中通过 `#{key}` 引用。 |
| modules | Module[] | **是** | 模块数组，定义了可执行命令。 |

*\[注\]*：meta除了上述三种基本类型，还支持 `Argument` ，可参考`../bud/leaf/demo.yaml`

### 2. Module 定义

Module（模块）代表一个可执行的功能单元。

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| key | string | **是** | 模块唯一标识符，用于URL。在 Flow 中可通过 `"project.module"` 格式引用。 |
| name | string | **是** | 模块显示名称。 |
| desc | string | 否 | 模块描述。 |
| template | string/string[] | **是** | 用于执行的命令模板，可使用 `#{key}` 占位符引用参数和 meta（meta优先级较低）。 |
| shell | string | 否 | 使用shell：`cmd`, `powershell`, `pwsh`, `bash`, `sh`, `auto` (默认), `no` (不使用shell)。 |
| arguments | Argument[] | 否 | 参数数组，定义用户输入控件。 |
| dynamicBind | DynamicBind[] | 否 | 对参数属性值进行动态绑定。 |
| disabled | boolean | 否 | 是否禁用该模块，默认为`false`。 |

*\[注\]*：
1. 为防止yaml解析出错，确保template字符串总由单引号`''`包裹
2. `shell` 默认为 `auto`，表示根据操作系统自行选择使用的shell。命令间共享上下文（支持cd等命令），所有命令将按顺序执行
3. 若 `shell=no` ，命令间无法共享上下文，将按顺序独立地执行，但能立即终止进程
4. 当取消正在执行的命令时，所有`shell`设置均会尝试让进程优雅退出（发送Ctrl+C事件/SIGINT信号）。但使用shell的情况下由于不确定进程是否已经完成退出，将在发出事件/信号后等待固定时长，并尝试强制杀死进程。因此`shell=no`的取消命令通常更快。
5. shell支持`pty:`前缀，如`pty:ps, pty:no`。带有该前缀的shell会使用PTY模拟终端环境，对TUI程序的正确显示、交互很有帮助

*关于PTY*：
pty启动后不会由于命令执行结束而关闭，因此默认给所有pty最后推入一条exit命令。此外，pty的所有键盘事件都由子进程控制，在便TUI交互的同时也意味着无法通过go主进程监听Ctrl+C来取消pty任务。虽然pty里的进程会响应Ctrl+C然后退出，但如果template里有许多命令，就得一条一条地退出，而且最后任务状态是`complete`而不是`cancelled`（因为最后一条是exit，确实正常结束）。推荐通过leaf²任务队列页面来取消该任务。

### 3. Argument 定义

Argument （参数） 定义了命令模板中可替换的变量，其值将用于替换 `template` 中的占位符。若为空值（例如 `[], {}, undefined`），占位符将被替换为空字符串 `''`；若是布尔值将按照字符串 `'true'/'false'` 去替换模板，想实现布尔的条件效果参考"高级模板语法"。

#### 3.1 通用属性

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| key | string | **必填**。参数键，可在module.template中使用：`#{key}`。 |
| name | string | **必填**。参数名称。 |
| desc | string | 参数说明。 |
| value | Value\|Value[] | 参数值。Value: number\|string\|boolean |
| required | boolean | 是否必选，false将允许该参数选择空值。 |
| template | string | 参数模板，支持使用简写`#{}`表示本参数`#{key}`。如果设置，该渲染结果将替代value传递给module.template使用。只支持引用meta与本参数。 |

#### 3.2 数据类型与交互方式

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| dtype | 'string'\|'number'\|'file'\|'directory'\|'boolean' | 数据类型，默认 `string`。 |
| method | 'input'\|'slide'\|'radio'\|'select'\|'switch'\|'mmap' | 输入方法，配合 dtype 共同决定使用的输入组件。 |
| multiple| boolean | 是否支持多选，适用于多种输入组件。 |
| dir | string| 文件选择器的工作目录，适用于 dtype=`file\|directory`。 |
| min/max| number | 数值范围限制，适用于 dtype=`number`。 |
| step | number | 数值步长，适用于 dtype=`number`。 |
| options | string[] | 可选值，适用于 `method=select\|radio`。 |

**dtype 与 method 的对应关系**：
- dtype=`string`: input(默认) / select / radio
- dtype=`number`: input(默认) / slide / select / radio
- dtype=`boolean`: radio(默认) / switch
- dtype=`file/directory`: select(路径输入+选择，默认) / mmap(内存映射) / select|mmap（同时启用二者）

*\[注1\]*: dtype=`file/directory`, method=radio 均原生支持multiple数组输入，其他的通过数组组件来支持  
*\[注2\]*: 对于dtype=`file/directory`，允许使用 `|` 组合method。例如 method: select|mmap|resolve 表示除了手动选择输入路径外，还可以使用内存映射，且所有相对目录都会被解析为以leaf²所在目录为根目录的绝对路径

#### 3.3 动态绑定
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| from | string | **必填**。绑定来源。 |
| fromRule | string | 可选。来源解析规则。若绑定来源解析为对象，则可据此获取具体值。 |
| to | string | **必填**。绑定目标。 |

**from**: 指定绑定的来源，支持四种形式：
1. url: `http://...` 或 `https://...`，期望响应合法JSON，自动将其解析
2. 本地路径: `/path/to/file` 或 `./relative/path`，期望是 json/yaml 文件，读取后解析；或目录，将列出目录下所有文件名数组
3. 本模块直接引用参数属性: `#{argumentKey.sourceAttr}`，范围仅限本模块所属参数，表示获取以argumentKey作为key的`Argument`的sourceAttr属性值
4. 本模块间接引用参数属性（其值作为url/path）: `#{{argumentKey.sourceAttr}}`，先按第3点获取属性值，该值期望满足上述第1或第2点，并再次解析

**fromRule**: 从from解析的数据源对象中提取最终值的键路径：
1. 支持 lodash _.get 语法，如 `data.items`、`models[0].name`
2. 若为空则以from解析的值作为最终值
3. 也支持部分函数如 `len(keys(a.b).[2]).c`: 
   - `keys`: 列举对象所有键以数组返回
   - `values`: 列举对象所有值以数组返回
   - `len`: 计算并返回对象键值对个数/数组长度

**to**: 指定绑定的目标，范围仅限本模块所属参数的属性：
1. 格式为`argumentKey.targetAttr`，如 "model.options"
2. 绑定触发时同步将 `from+fromRule` 解析的值赋值给 `to` 指定的目标属性

*\[注\]*：动态绑定将在`from`指定的参数属性变化时触发，且不会/不允许触发新的动态绑定

### 4. 模板语法

`template` 字段支持变量替换功能，在module/argument中行为基本一致。

#### 4.1 基础模板替换
使用 `#{key}` 语法引用参数的值。

**示例**:
```yaml
template: 'python train.py --name #{name}'
arguments:
  - key: name
    value: taffy
```
**结果**: `python train.py --name taffy`

#### 4.2 引号处理
本小节只是一个提醒。如果参数值可能包含空格，需要由模板指定好是否需要引号包裹，以免解析执行时报错。

**示例**:
```yaml
template:
  - 'audition #{song}'
  - 'photoshop #{picture}'
  - 'launch "#{game}"'
arguments:
  - key: song
    value: god knows.flac
  - key: picture
    value: chaika.png
  - key: game
    value: granblue fantasy relink
```
**结果**: `audition god knows.flac` （报错）; `photoshop chaika.png` （无空格，正常）; `launch "granblue fantasy relink"` （加上了引号，正常）

#### 4.3 无效参数值
如果模块模板中存在占位符，其参数未定义或值为空（空字符串、空数组、空对象），模板将渲染为空字符串。  

**示例1: 空值**
```yaml
template: 'python infer.py #{name}'
arguments:
  - key: name
    value: ~
```
**结果**: `python infer.py `

但是布尔值特殊，不属于空值，表现接近于字符串，`true/false`都将直接用于模板渲染

**示例2: 布尔值**
```yaml
template: 'loader.exe --debug #{flag}'
arguments:
  - key: flag
    dtype: boolean
    value: false
```
**结果**: `loader.exe --debug false`

#### 4.4 高级模板语法
**语法**: `#{prefix#{key}suffix}{sep}`

嵌套模板语法用于格式化数组，当参数值不为数组则视为长度为1的数组，整体渲染后使用分隔符连接。`{sep}` 部分可选。

**示例 1: 简单的列表**
```yaml
template: 'pip install #{#{deps}}'
arguments:
  - key: deps
    value: ['numpy', 'torch']
```
**结果**: `pip install numpytorch` (默认无前后缀)  
注：若想数组项之间空格分离，应在前缀加上空格' '，例如`#{ #{deps}}`

**示例 2: 带前缀**
```yaml
template: 'git clone ssh://git@ssh.github.com:443#{/#{userAndRepo}}.git'
arguments:
  - key: userAndRepo
    value: ['Stareven233', 'leaf-flow']
```
**结果**: `git clone ssh://git@ssh.github.com:443/Stareven233/leaf-flow.git`

**示例 3: 前缀后缀**
```yaml
template: 'gcc#{ -I#{include_dirs} no}'
arguments:
  - key: include_dirs
    value: ['include', 'libs/include']
```
**结果**: `gcc -Iinclude no -Ilibs/include no`     
注：前缀' -I'、参数、后缀' no'均直接替换

**示例 4: 空值**
```yaml
template: 'go build#{ #{files}}'
arguments:
  - key: files
    value: []
```
**结果**: `go build`
注：当参数不存在或值为空（空字符串、空数组、空对象）时整个模板无效，以空字符串代替

**示例 5: 自定义分隔符**
```yaml
template: 'show #{「#{names}」}{->}'
arguments:
  - key: names
    value: ['希实香', '柘榴', '卓司']
```
**结果**: `show 「希实香」->「柘榴」->「卓司」`

#### 4.5 转义语法
若需要在模板中输出原始的 `#{...}` 字符串而不进行替换，可在前面加一个 `#` 进行转义。

**示例**:
```yaml
template: 'echo ##{raw}'
```
**结果**: `echo #{raw}`
注：`##` 开头的模板将被转义，#{}原样输出  

#### 4.6 参数模板 (Argument Template)
参数对象自身也可以定义 `template`，用于在传入主命令模板前将值进行预处理，语法与模块模板基本一致，不同在于：  
1. **简写** 在参数模板中，`#{}` 代表本参数的值，即 `#{key}`
2. **空值** 若参数不存在、值为空（空字符串、空数组、空对象**或 `false`**），参数模板将返回空字符串。（该特性可用于构造可选选项）

注：`true`行为没变，若模板中不含占位符，该模板直接作为value，否则将占位符替换为 `'true'`。

**1. 简写示例**:
```yaml
template: 'bun a #{pkg}'
arguments:
  - key: pkg
    value: tachibana
    template: '--save #{}' 
```
**结果**: `bun a --save tachibana`

处理流程:
1. 参数模板 `--save #{}` -> `--save #{pkg}` -> `--save tachibana`
2. 模块模板 `bun a #{pkg}` 替换 -> `bun a --save tachibana`

**2. 空值示例**:  
```yaml
template: 'rm#{force}'
arguments:
  - key: force
    dtype: boolean
    value: true
    template: ' -rf /*'
```
- 当 `value: true` -> 结果: `rm -rf /*`
- 当 `value: false` -> 结果: `rm`

#### 4.7 YAML 语法
由于配置采用yaml书写，自然也支持yaml的语法，例如多行字符串、锚点（Anchor）、别名（Alias） 等

## Flow 配置

Flow（流） 是一种更高级的配置方式，用于定义包含多个执行分支的工作流。每个 Branch 下的多个 Module 会一次性解析为命令批量执行，通过 mmap 可以在 Module 间高效传递数据。

### 1. 核心结构

Flow 配置文件使用 `.flow.yaml` 后缀（例如 `myflow.flow.yaml`），包含以下顶层字段：

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| key | string | **是** | 流唯一标识符，**自动与配置文件名保持一致**（不含 `.flow` 部分），用于URL。 |
| name | string | 否 | 流显示名称，未赋值则使用key。 |
| desc | string | 否 | 流简短描述。 |
| meta | map | 否 | 流级别的元数据，定义、作用与Project的一致。 |
| branches | Branch[] | **是** | 分支数组，每个分支代表一种执行路径。 |

*\[注\]*：Flow 的 `key` 字段**不包含** `.flow` 部分，例如 `myflow.flow.yaml` 的 key 为 `myflow`。

### 2. Branch 定义

Branch（分支）代表流的一个执行分支，其结构与 Project 一致：

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| key | string | **是** | 分支唯一标识符，必须指定，用于URL。 |
| name | string | 否 | 分支名称，未赋值则使用key。 |
| desc | string | 否 | 分支描述。 |
| meta | map | 否 | 分支级别的元数据，优先级高于流低于具体参数。 |
| modules | Module[] | **是** | 模块数组，定义了可执行命令。 |

**Branch 与 Project 的区别**：
- Branch 下的**所有** Module 会**一起解析**为一组命令串行执行，相互之间可能有依赖关系；而 Project 的 Module 是**逐个独立**执行的。
- Branch 中的 Module 可以引用 Project 中定义的 Module。
- Branch 的 shell：若所有 Module 都未指定shell则默认`auto`，否则为各 Module 第一个不为`no`的shell值。只当所有 Module.shell 都为`no`才会使用`no`值。

### 3. Module 定义与引用

Flow 中的 Module 与 Project 中的定义相同，但允许 **引用 Project 的 Module**。

#### 3.1 引用语法

指定 `"project.module"` 格式的 `key` 就可以引用 Project 中的 Module：

```yaml
branches:
  - key: main
    modules:
      - key: DrSTONE.kohaku  # 引用 DrSTONE 中的 kohaku 模块
      - key: NARUTO.konan   # 引用 myproject 中的 konan 模块
```

引用的 Module 默认使用原本定义的 `template`、`arguments` 等其余属性，但可以再次定义来覆盖。

*\[注\]*：Project **不支持**引用 Module，这是 Flow 的特性。

### 4. Mmap 数据传递机制

Flow 的一个重要特性是支持通过内存映射文件（mmap）在 Module 间高效传递数据，以支持各 Module 的”流“式执行。Project也可以用，但或许不太需要

#### 4.1 启用 mmap

在 Argument 定义中设置 `dtype: 'file'` 且 `method: 'mmap'`：

```yaml
arguments:
  - key: output
    name: 输出文件
    dtype: file
    method: mmap
```

#### 4.2 工作原理
1. **前端渲染**：当 `method: 'mmap'` 时，ui会将该参数的 `value` 设定为特殊占位符。
2. **后端替换**：scheduler识别该占位符，将其替换为打开的 mmap 临时文件路径。
3. **进程通信**：具体如何使用/读写该 mmap 文件完全由子进程自行约定，scheduler仅负责开辟并提供一块固定大小的内存区域。

#### 4.3 Mmap 协议示例

```
[1字节类型][4字节长度][数据]
```

- **类型**：`0x00` = 二进制，`0x01` = UTF-8 文本
- **长度**：小端序 uint32，表示数据部分的字节数
- **数据**：实际内容

## 常见问题 (FAQ)
- **Q: 为什么 `key` 必须和文件名一致？**
  - A: 系统加载配置时会将文件名作为 URL 路由的一部分，保持一致可以方便路由。
- **Q: `no` shell 模式有什么好处？**
  - A: 不使用 shell (cmd/bash) 包装，直接调用可执行程序。优点是取消任务时能立即杀死进程，不会残留；缺点是 `cd` 命令无效、不能使用管道  |` 或重定向 `>` 等 shell 功能。
- **Q: value 是数组，但参数模板中只使用基础模板 `#{key}`？**
  - A: 只取第一个元素进行渲染。
