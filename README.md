# 杜有钱

功能完整的本地待办工具（Windows 桌面端）

一个数据本地化、离线优先的待办应用：待办、提醒、优先级、标签等核心功能可靠好用，同时内置数据统计、多套主题、自定义背景与图标等完整能力。当前版本功能已冻结，增重功能留待后续分支精简。

## 核心理念

| 理念 | 含义 |
|------|------|
| **数据本地化** | 数据只存本地文件，不依赖服务器，不上传云端；迁移与备份是内置能力 |
| **离线优先** | 运行时不联网，不接任何第三方 API；中国节假日数据由 `chinese-days` 随应用离线打包 |
| **轻量克制** | 体积小、启动快、界面克制；功能虽完整，但不为堆砌而堆砌 |
| **核心可靠** | 待办 / 提醒 / 优先级 / 标签必须可靠好用，数据层采用原子写入并有单元测试兜底 |

## 应用截图

  主界面：
> <img width="300" height="500" alt="image" src="https://github.com/user-attachments/assets/4cd93706-e7b4-4d33-9fda-781148a02a62" />
  支持自定义背景：
> <img width="200" height="350" alt="image" src="https://github.com/user-attachments/assets/fba02b42-1548-45bd-8097-5432c7e8c0ed" />
  图表统计:
> <img width="250" height="360" alt="image" src="https://github.com/user-attachments/assets/91416142-e76b-483d-b750-0e6e16052463" />

## 已知问题与限制

- **未签名的可执行文件**：便携版 EXE 未做代码签名，Windows SmartScreen 或部分杀毒软件可能提示“未知发布者”，需手动允许运行。
- **无自动更新**：不接 `electron-updater`，升级需手动下载新版本 EXE 替换；升级前建议先备份数据目录。
- **仅 Windows 便携单文件**：当前只发布 Windows portable 单文件，不提供安装包，也未适配 macOS / Linux。
- **节假日数据不自动跨年**：`chinese-days` 只包含已公布并录入的年度安排，次年数据需维护者主动升级依赖（见下文「节假日数据维护」）。

## 功能特性

- 📋 **待办管理**：创建、编辑、删除待办事项，支持 8 种预设颜色标记
- ⭐ **优先级标记**：P1/P2/P3 三级优先级（紧急/较高/普通），颜色标识；当天待办默认按 P1→P3 排列
- 🔍 **标题搜索**：实时搜索当前日期的待办标题，搜索关键词自动保存
- ✨ **流畅动画**：待办添加/删除平滑过渡动画，日期切换无闪烁，已完成任务即时显示
- 🔄 **重复任务**：支持每日 / 每周 / 每月自动生成重复待办
- 🔔 **定时提醒**：设置精确到分钟的提醒时间，弹窗通知（支持四角定位）；可选持久弹窗（达到指定优先级不自动关闭）与弹球移动
- 🏷️ **标签系统**：预设标签 + 自定义标签，分类管理待办
- 📊 **数据总览**：日历视图总览面板，使用 `chinese-days` 提供中国节假日和调休标记，数据随应用离线打包
- 📈 **数据统计**：ECharts 可视化（任务趋势、每日生产力、分类占比），支持日/周/月维度
- 🎨 **主题系统**：6 套预设主题
- 🖼️ **自定义背景**：上传背景图片，支持填充模式和透明度调节
- 🌙 **暗黑模式**：完整的亮色 / 暗色主题支持
- ⌨️ **全局快捷键**：快速添加待办、切换窗口显隐（可自定义）
- 💻 **系统集成**：系统托盘（自定义图标）、窗口置顶、开机自启、最小化到托盘
- 📁 **自定义存储**：支持自定义数据存储目录，数据自动迁移
- 🖼️ **自定义图标**：支持替换应用图标（exe 图标 + 托盘图标）

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 41.x |
| 前端框架 | Vue 3.5 + TypeScript |
| 状态管理 | Pinia 2.x |
| 路由 | Vue Router 4.x |
| 构建工具 | Vite 5.x |
| 图表库 | ECharts 5.x + vue-echarts |
| 打包工具 | electron-builder |

## 项目结构

```
agency-reminder/
├── electron/                    # Electron 主进程
│   ├── main.ts                 # 主进程入口（生命周期/Electron 交互/模块组装）
│   ├── preload.ts              # 预加载脚本（IPC 桥接，支持主窗口和通知窗口分支）
│   ├── types.ts                # 主进程与渲染进程共享类型（Todo/OperationResult 等）
│   ├── ipc-types.ts            # IPC 边界统一类型（ElectronAPI/ConfigKey/StoreKey）
│   ├── utils.ts                # 共享工具（日期格式化等）
│   ├── ipc-security.ts         # IPC 安全白名单和配置校验
│   ├── json-file-storage.ts    # JSON 原子写入、备份恢复
│   ├── data-store.ts           # 待办/标签状态、完整校验、持久化与迁移事务
│   ├── reminder-scheduler.ts   # 提醒调度、定时轮询
│   ├── window-manager.ts       # 主窗口创建、菜单、关闭保护
│   ├── notification-window.ts  # 通知窗口创建、定位、自动关闭
│   ├── settings-ipc.ts         # 设置/快捷键 IPC 注册
│   ├── storage-ipc.ts          # 待办/标签存储 IPC 注册
│   ├── background-ipc.ts       # 背景图片 IPC 注册
│   └── external-link-ipc.ts    # 外部链接 IPC 注册
├── src/
│   ├── components/             # Vue 组件
│   │   ├── AddTodoModal.vue    # 添加/编辑待办弹窗
│   │   ├── TodoItem.vue        # 单条待办组件
│   │   ├── WeekSelector.vue    # 周视图日期选择器
│   │   ├── OverviewModal.vue   # 待办总览弹窗
│   │   ├── StatsModal.vue      # 数据统计弹窗（ECharts）
│   │   ├── TagManageModal.vue  # 标签管理弹窗
│   │   ├── ThemeModal.vue      # 主题/背景设置弹窗（容器，拆分见 theme/）
│   │   ├── SettingsModal.vue   # 应用设置弹窗（容器，拆分见 settings/）
│   │   ├── Toast.vue           # 消息提示组件
│   │   ├── settings/           # 设置弹窗的功能区块子组件
│   │   │   ├── SettingsSection.vue        # 区块外壳（图标+标题+插槽）
│   │   │   ├── SettingToggle.vue          # 通用开关卡片
│   │   │   ├── AppearanceSection.vue      # 外观（深色模式）
│   │   │   ├── WindowSection.vue          # 窗口（置顶/托盘）
│   │   │   ├── SystemSection.vue          # 系统（自启/通知位置）
│   │   │   ├── ShortcutSection.vue        # 快捷键录制
│   │   │   └── DataSection.vue            # 数据存储目录
│   │   ├── main/               # 主页面子组件
│   │   │   ├── AppTitleBar.vue            # 标题栏+窗口控制
│   │   │   └── TodoListPanel.vue          # 进度条+搜索+列表+回到今天按钮
│   │   └── theme/              # 主题弹窗子组件
│   │       ├── PresetThemeGrid.vue        # 预设主题网格
│   │       └── CustomBackgroundSection.vue # 自定义背景上传/比例/透明度
│   ├── stores/                 # Pinia 状态管理
│   │   ├── todo.ts             # 待办数据（增删改查/重复任务）
│   │   ├── settings.ts         # 应用设置（快捷键/通知位置/暗黑模式）
│   │   └── theme.ts            # 主题管理（6套预设/背景图/透明度）
│   ├── composables/            # 可组合逻辑
│   │   └── useTodayButtonDrag.ts  # "回到今天"按钮拖拽
│   ├── config/
│   │   └── branding.ts         # 品牌配置（运行时读取 displayName 等）
│   ├── utils/
│   │   └── date.ts             # 日期工具（本地日期/中国节假日）
│   ├── views/
│   │   ├── MainView.vue        # 主页面（组装标题栏/周视图/待办列表面板）
│   │   └── NotificationView.vue # 提醒弹窗（独立窗口）
│   ├── App.vue
│   ├── main.ts
│   ├── router.ts
│   ├── style.css
│   └── vite-env.d.ts
├── tests/                      # Vitest 单元测试
│   ├── data-store.test.ts      # 数据仓储层测试
│   ├── date-calculation.test.ts # 日期与节假日计算测试
│   ├── ipc-security.test.ts    # IPC 白名单与配置校验测试
│   └── json-file-storage.test.ts # JSON 原子写入与备份恢复测试
├── branding.json               # 品牌配置（应用名称/描述/EXE文件名）
├── electron-builder.config.cjs # Electron 打包配置
├── favicon.ico                 # 应用图标
├── index.html                  # HTML 入口
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts              # Vite 配置（含生产环境 CSP 注入插件）
├── vitest.config.ts            # Vitest 测试配置
├── .gitignore
└── LICENSE
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run electron:dev
```

### 构建打包

```bash
npm run build
```

构建完成后，可执行文件位于 `release/` 目录；文件名由根目录 `branding.json` 的 `artifactName` 控制，默认格式为 `杜有钱-版本号.exe`。

### 运行测试

```bash
npm test
```

监听模式（开发时自动重跑）：

```bash
npm run test:watch
```

测试覆盖数据仓储层、JSON 原子写入、IPC 安全白名单和日期/节假日计算，共 4 个测试文件。

### 节假日数据维护

项目使用 `chinese-days` 提供中国法定节假日、调休日和工作日数据。该依赖及其数据会随 Electron 应用一起打包，软件运行时不请求 GitHub、搜索引擎或第三方节假日 API，因此不受用户网络环境影响。

`chinese-days` 只能包含已经公布并录入的年度安排，安装一次后不会自动获得下一年度数据。国务院办公厅公布下一年度节假日安排且 `chinese-days` 发布对应版本后，维护者必须主动升级依赖：

```bash
npm install chinese-days@latest
```

升级后需要确认实际安装版本：

```bash
npm ls chinese-days
```

发布新版本前至少核对以下内容：

1. 新年度数据已经包含在当前 `chinese-days` 版本中。
2. 元旦、春节、劳动节和国庆节的放假日期与调休上班日期正确。
3. 普通周末、法定节假日和调休工作日能够被正确区分。
4. 总览日历中的节假日名称和日期标记显示正确。

> 注意：升级其他依赖不会保证 `chinese-days` 自动更新。每年必须单独检查并显式升级该依赖；官方安排尚未公布或依赖尚未更新时，不得根据往年规律推算下一年度调休数据。

### 自定义应用名称、文案、EXE 名称和图标

所有品牌相关内容统一在根目录 `branding.json` 中维护。修改完成后重新构建，新的配置才会写入 EXE；已经生成的 EXE 不会自动改变。

#### 第一步：编辑品牌配置

打开根目录的 `branding.json`，按需要修改字段值：

```json
{
  "displayName": "我的待办",
  "description": "本地保存、离线使用的待办事项管理工具",
  "notificationTitle": "我的待办提醒",
  "artifactName": "${productName}-${version}.${ext}"
}
```

必须保留四个字段，字段值必须使用双引号包裹的非空文本；JSON 最后一项后面不要加逗号。

#### 字段说明

| 字段 | 填写规则 | 生效位置 |
|---|---|---|
| `displayName` | 填写应用显示名称。避免使用 `\`、`/`、`:`、`*`、`?`、`"`、`<`、`>`、`|`，因为默认 EXE 名称会引用它。 | EXE 内部产品名、窗口标题、网页标题、主界面标题、托盘提示、“关于”菜单和弹窗。 |
| `description` | 填写一段简短说明。 | “关于”弹窗中的说明文字。 |
| `notificationTitle` | 填写提醒弹窗顶部的默认标题。 | 到期待办的提醒通知标题；待办本身的标题仍显示为通知正文。 |
| `artifactName` | 填写最终文件名或文件名模板。必须以 `${ext}` 或 `.exe` 结尾。 | `release/` 目录中的最终 EXE 文件名。 |

#### EXE 文件名写法

`artifactName` 支持以下占位符：

| 占位符 | 构建时替换为 |
|---|---|
| `${productName}` | `displayName` 的当前值 |
| `${version}` | `package.json` 中的当前版本号 |
| `${ext}` | 文件扩展名，当前 Windows 便携版为 `exe` |

常用示例：

```json
"artifactName": "${productName}-${version}.${ext}"
```

生成示例：`我的待办-1.0.0.exe`。

```json
"artifactName": "我的待办.exe"
```

生成固定名称：`我的待办.exe`。

```json
"artifactName": "我的待办-${version}-Windows.${ext}"
```

生成示例：`我的待办-1.0.0-Windows.exe`。

#### 第二步：替换图标（可选）

1. 准备新的 `favicon.ico`，建议包含至少 `256×256` 的图标尺寸。
2. 使用新文件替换项目根目录的 `favicon.ico`。
3. 图标会用于 EXE 和系统托盘；替换后必须重新构建。

#### 第三步：构建

在项目根目录执行：

```bash
npm run build
```

构建完成后，到 `release/` 目录查看 `artifactName` 对应的 EXE。

#### 第四步：构建后核对

打开新生成的 EXE，依次确认：

1. EXE 文件名与 `artifactName` 的预期一致。
2. 主窗口标题、浏览器网页标题和左上角标题与 `displayName` 一致。
3. 托盘悬停提示与 `displayName` 一致。
4. 菜单中的“关于”、关于弹窗标题、版本名称和说明文字与 `displayName`、`description` 一致。
5. 创建带提醒时间的待办后，通知标题与 `notificationTitle` 一致。
6. EXE 图标和托盘图标与新的 `favicon.ico` 一致。

#### 不要修改的字段

`appId` 固定为 `com.du.remind`，不在 `branding.json` 中配置。不要为了修改名称而变更它；该值关系到 Windows 应用身份、默认数据目录和后续升级兼容性。

> 如果修改了 `branding.json` 却仍看到旧名称，说明运行的是旧 EXE。删除或移走旧 `release/` 产物后重新构建，并确认打开的是新生成的文件。

## 操作指南

### 标题栏

| 图标 | 功能 |
|------|------|
| 📅 | 周视图 |
| 📊 | 待办总览 |
| 📈 | 数据统计 |
| 🏷️ | 标签管理 |
| 🎨 | 主题设置 |
| ⚙️ | 应用设置 |

### 添加待办

1. 点击列表底部「添加待办」按钮，或按全局快捷键
2. 填写标题，选择优先级（P1-P3）、颜色、标签、提醒时间、重复周期（均可选）
3. 点击「添加」

### 快捷键（可自定义）

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Shift+T | 快速添加待办（全局） |
| Ctrl+Shift+F | 显示/隐藏主窗口（全局） |

### 周视图

| 视图 | 说明 |
|------|------|
| 周视图 | 按周浏览待办，点击日期切换，显示每天待办数量和完成进度 |

- 当前只提供周视图；「<」「>」切换上/下周，「今」按钮快速回到今天

### 标题搜索与默认排序

- 顶部搜索栏输入关键词，实时过滤待办标题
- 搜索关键词会自动保存，重启后恢复
- 当天待办固定按优先级 P1→P2→P3 排列；不提供标签、优先级或完成状态的筛选控件

### 提醒通知

- 为待办设置提醒时间（HH:mm），到时弹窗提醒
- 通知位置可在设置中选择（左上/右上/左下/右下）
- 弹窗 5 秒后自动关闭，点击也可关闭
- 开启「持久弹窗」后，达到指定优先级（P1/P2/P3）的待办弹窗不再自动关闭，需手动关闭；再开启「弹球移动」后，停留超时会在屏幕内弹球移动，鼠标悬停即暂停

### 设置

- 窗口置顶 / 最小化到托盘 / 开机自启
- 自定义全局快捷键（支持录制组合键）
- 自定义数据存储目录（支持数据迁移）
- 通知弹窗位置（四角可选）
- 持久弹窗（总开关 + 最低优先级 + 弹球移动 + 移动延迟）

### 主题

- 6 套预设主题一键切换
- 上传自定义背景图片
- 背景填充模式（cover / contain / 拉伸）
- UI 透明度调节

## 数据存储

| 数据类型 | 文件或目录 | 存放位置 |
|----------|------------|----------|
| 待办数据 | `remind-data.json` | 首次启动选择的数据存储目录；未选择时使用系统默认应用数据目录。 |
| 标签数据 | `remind-tags.json` | 与待办数据位于同一目录。 |
| 背景图片 | `remind-bg` | 与待办数据位于同一目录。 |
| 应用配置 | `remind-config.json` | 系统默认应用数据目录，用于保存窗口、快捷键、主题和已选存储目录等设置。 |

### 首次启动选择目录

首次启动时，主窗口显示后会弹出“选择数据存储位置”对话框：

1. 选择一个目录后，待办、标签和背景图片会迁入该目录。
2. 选择结果会保存到应用配置中；后续启动直接使用已选目录，不会重复弹出选择对话框。
3. 如需更换目录，在“设置 → 数据存储目录”中点击“选择目录”。切换时会迁移待办、标签和背景图片；目标目录已有数据时会显示冲突处理选项，不会静默覆盖。
4. 如果在首次对话框中点击取消，应用会改用系统默认应用数据目录，并将此次选择视为已完成；后续启动不会再次自动弹出。之后仍可在设置中手动选择目录。

## 许可证

MIT
