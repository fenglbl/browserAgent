# Browser Agent 🐙

一个由 AI 驱动的浏览器扩展。用户输入自然语言目标后，扩展会通过多轮 tool loop 调用浏览器工具，逐步完成打开页面、定位元素、点击、输入、提取内容、总结等任务。

## 项目定位

当前项目已经不只是一个“命令触发器”，而是一个 **Manifest V3 浏览器扩展 + 后台 Agent Runtime + DOM 工具层** 的浏览器代理原型。

它的核心方向是：

- 用自然语言驱动浏览器操作
- 将浏览器能力抽象成可组合工具
- 通过 Agent 多轮决策逐步完成任务
- 在操作后观察页面变化与异常，而不是只盲目执行

## 当前状态

**当前阶段**：可演示原型 / 可继续产品化的第一版底盘

### 已完成的核心能力

- ✅ **MV3 扩展基础架构**
  - `background.js` 作为后台执行中心
  - `content.js` 负责页面侧注入与错误监听
  - `popup` / `options` 完成基本交互与配置

- ✅ **标准 tool loop Agent**
  - `agent.js` 已实现多轮决策式执行
  - 支持工具调用、结果回看、继续决策、最终总结
  - 兼容 OpenAI 风格 tool calling，并带 JSON fallback

- ✅ **基础浏览器工具集**
  - `open_url`
  - `click_element`
  - `type_text`
  - `extract_text`
  - `get_tab_list`
  - `summarize_text`
  - `find_element`
  - `wait_for_element`
  - `wait_for_navigation`
  - `press_key`
  - `scroll_into_view`
  - `screenshot`
  - `hover_element`
  - `select_option`
  - `check_element`
  - `wait_for_text`
  - `read_attribute`
  - `extract_links`
  - `read_storage`
  - `wait_for_url_change`
  - `dom_snapshot`
  - `extract_forms`
  - `read_cookie`
  - `wait_for_network_idle`
  - `extract_images`
  - `upload_file`
  - `fill_form`

- ✅ **统一结果协议与错误码**
  - 工具结果统一走 `success / tool / message / data / error / code / kind / meta`
  - 已开始把常见失败收口为结构化错误码，例如 `NO_ACTIVE_TAB`、`MISSING_SELECTOR`、`MISSING_FILE_PATH`、`MISSING_FIELDS`、`MISSING_API_CONFIG`、`TIMEOUT`
  - 便于 Agent 层更稳定地消费、重试与回看

- ✅ **元素定位增强**
  - 支持 CSS selector
  - 支持 `text=文本` 形式的文本定位
  - 支持候选元素排序与最佳候选推荐
  - 支持一定程度的 shadow DOM / iframe 扫描

- ✅ **操作后页面观测**
  - 监控 JS error / unhandled rejection / 资源错误
  - 检查页面中疑似错误提示块
  - 记录 URL / title 是否变化
  - 为 Agent 提供“操作后页面是否异常”的依据

- ✅ **任务状态与日志**
  - 后台任务状态持久化到 `chrome.storage.local`
  - Popup 可展示任务步骤 timeline
  - Options 页面可查看和清空运行日志

## 目前存在的问题

项目方向是对的，但距离“稳定可用”还有明显差距，主要问题包括：

1. **版本信息不统一**
   - `README.md`、`manifest.json`、`options.html` 中版本号不一致

2. **执行稳定性仍不足**
   - `click_element` / `type_text` 主要依赖 DOM 直接操作
   - 缺少更可靠的等待机制与状态确认机制

3. **关键工具仍未补齐**
   - 当前已补上 `wait_for_element`、`wait_for_navigation`、`press_key`、`scroll_into_view`、`screenshot`
   - 但更完整的可观测性与协议统一仍未完成

4. **复杂页面适配能力不够**
   - 现代前端框架、受控组件、复杂交互页面的稳定性还不够

5. **Agent 级恢复与闭环能力偏弱**
   - 已有基础恢复日志，但任务级策略和失败分类还不够完善

6. **工程化约束不足**
   - 还没有系统化测试
   - 还没有统一的结果协议与发布规范

## 推荐的下一步方向

当前不建议优先“继续堆更多花哨工具”，而应该先补底盘。

### 优先级 P0：执行稳定性
优先补这些工具或能力：

- 页面结构快照 / DOM 摘要
- 更细的等待与恢复策略

### 优先级 P1：统一工具结果协议
建议所有工具统一返回：

- `success`
- `tool`
- `message`
- `data`
- `error`
- `code`
- `kind`
- `meta`（如 `tabId`、`url`、`title`、`durationMs`、`observation`）

当前已接入统一协议的工具：
- `open_url`
- `click_element`
- `type_text`
- `extract_text`
- `get_tab_list`
- `summarize_text`
- `find_element`
- `wait_for_element`
- `wait_for_navigation`
- `press_key`
- `scroll_into_view`
- `screenshot`
- `hover_element`
- `select_option`
- `check_element`
- `wait_for_text`
- `read_attribute`
- `extract_links`
- `read_storage`
- `wait_for_url_change`
- `dom_snapshot`
- `extract_forms`
- `read_cookie`
- `wait_for_network_idle`
- `extract_images`
- `upload_file`
- `fill_form`

### 优先级 P2：增强 Agent Runtime
重点补：

- 更清晰的 stop conditions
- 失败分类与恢复策略
- tool result 摘要压缩
- 更可靠的任务结束判定
- 用户确认钩子（敏感操作）

### 优先级 P3：补测试
最少先补：

- selector / intent 纯函数测试
- DOM 定位策略测试
- tool 返回结构测试
- tool loop 解析与 fallback 测试

## 快速开始

### 1. 安装扩展
1. 打开 Edge，访问 `edge://extensions/`
2. 开启 **开发人员模式**
3. 点击 **加载解压缩的扩展**
4. 选择本目录 `D:\web\browserAgent`

### 2. 配置模型
1. 打开扩展设置页（右键扩展图标 → 选项）
2. 填写：
   - **API Key**
   - **Base URL**
   - **模型名称**
3. 保存设置

### 3. 运行
- 按 `Ctrl+Shift+Y` 打开控制面板
- 输入自然语言任务，例如：
  - `打开 GitHub`
  - `帮我总结这篇文章`
  - `在百度搜索 OpenClaw`
  - `点击导航栏里的研究`

## 当前目录结构

```text
browserAgent/
├── manifest.json            # 扩展清单（MV3）
├── background.js            # 后台任务执行中心
├── agent.js                 # 标准 tool loop Agent 核心
├── content.js               # 页面侧注入与运行时事件上报
├── popup.html
├── popup.js                 # 控制面板 UI
├── options.html
├── options.js               # 设置页 / 日志页 UI
├── tools/
│   ├── open_url.js
│   ├── click_element.js
│   ├── type_text.js
│   ├── extract_text.js
│   ├── get_tab_list.js
│   ├── summarize_text.js
│   ├── find_element.js
│   ├── dom_locator.js       # DOM 候选定位器
│   └── page_monitor.js      # 页面观测与异常采集
├── openclaw_temp.json       # 临时文件（待确认用途）
└── README.md
```

## 已支持工具

| 工具 | 作用 | 说明 |
|------|------|------|
| `open_url` | 打开网址 | 支持新标签页或当前标签页跳转 |
| `click_element` | 点击元素 | 支持 CSS / `text=` 定位，操作后带观测 |
| `type_text` | 输入文本 | 支持 CSS / `text=` 定位，操作后带观测 |
| `extract_text` | 提取页面文本 | 偏文章/正文提取 |
| `get_tab_list` | 获取标签列表 | 返回全部标签页基本信息 |
| `summarize_text` | 总结文本 | 调用大模型对页面内容做总结 |
| `find_element` | 查找候选元素 | 用于点击/输入前定位元素 |
| `wait_for_element` | 等待元素出现 | 适合点击/输入前先确认页面元素已出现，并返回候选摘要 |
| `wait_for_navigation` | 等待页面跳转 | 适合点击跳转、搜索提交后确认 URL 或标题是否变化 |
| `press_key` | 触发键盘按键 | 适合输入后按 Enter 提交、按 Escape 关闭弹层、按 Tab/方向键移动焦点 |
| `scroll_into_view` | 滚动到目标元素 | 适合点击或输入前先把目标滚到视口内，减少点不中的问题 |
| `screenshot` | 页面截图 | 抓取当前可视区域截图，用于调试、失败回看和视觉确认 |
| `hover_element` | 悬停元素 | 适合展开菜单、气泡提示、悬停态组件 |
| `select_option` | 选择下拉项 | 适合标准 `select` 以及有选项列表的表单控件 |
| `check_element` | 勾选/取消勾选 | 适合复选框、开关、同意项 |
| `wait_for_text` | 等待文本出现 | 适合提交后等结果文案、状态提示、列表刷新 |
| `read_attribute` | 读取元素属性 | 适合拿 `href`、`src`、`aria-*`、`value` 等属性 |
| `extract_links` | 提取链接 | 适合收集页面可见链接列表 |
| `read_storage` | 读取 storage | 适合检查站点 localStorage / sessionStorage 状态 |
| `wait_for_url_change` | 等待 URL 变化 | 适合跳转后确认地址栏变化 |
| `dom_snapshot` | DOM 快照 | 适合快速看页面结构骨架 |
| `extract_forms` | 提取表单 | 适合梳理页面表单字段 |
| `read_cookie` | 读取 cookie | 适合检查登录态 / 会话态 |
| `wait_for_network_idle` | 等待网络空闲 | 适合提交后等异步请求稳定 |
| `extract_images` | 提取图片 | 适合收集页面可见图片资源 |
| `upload_file` | 上传文件 | 适合文件输入框上传 |
| `fill_form` | 批量填表 | 适合按字段列表一次填多个输入项 |

## 适合当前版本的使用场景

当前版本更适合：

- 打开网页
- 查找标签页
- 对简单页面做点击/输入
- 提取文章页内容并总结
- 观察单步或少量步骤任务执行情况

当前版本还不适合直接承诺：

- 高复杂度后台系统自动化
- 多页面长链路稳定执行
- 强依赖等待/异步状态的交互任务
- 高风险敏感站点上的自动操作

## 后续开发建议

如果继续推进，建议先走这条线：

1. **稳定性优先**：已补齐 wait / navigation / key / scroll / screenshot 这一批基础能力
2. **协议收口**：核心交互工具现已统一到同一结果 envelope，Agent 层后续可以更少写特判；当模型返回空 final 时，当前也会自动回退到执行摘要，避免任务完成后最终结果为空串
3. **恢复增强**：第一版已开始接入 Agent 自动恢复策略：点击前会优先 `scroll_into_view`，点击失败时会优先补 `screenshot` 便于回看；并已修正 preflight 注入方式，避免把预处理步骤伪装成模型原始 tool_call 结果。下一步可继续补提交后 `wait_for_navigation`、输入后 `press_key(Enter)` 等联动
2. **统一协议**：统一所有工具返回结构
3. **增强闭环**：加强 Agent 的恢复与结束判定
4. **补测试**：为定位和工具调用建立最小测试集
5. **再扩功能**：下载、表单、多步任务编排、历史记录

---

*这个项目已经有一个不错的底子，下一阶段重点不是“再加几个工具”，而是把完成率和稳定性做上去。*