# 跨平台持续交付与验收

目标：完成移动端优先的《问道牌途》在 iOS、Android、Windows、macOS 和 Web 的开发与验证。美术与动效要求以根目录 AGENTS.md 为准。未实际验证的事项保持待办，安装包构建通过不等于运行或真机性能通过。

## 已完成的共同能力

- 独立扑克规则、加密随机洗牌、六人单人练习、主池与边池、七选五比牌、平局分池。
- 五名只接收可见信息的本地策略对手；不是求解器或大语言模型。
- 九课三阶段、十八道练习、学习进度、本手公开行动复盘。
- 移动端底部操作、加注确认面板、音效、减少动态效果、暂停、刷新恢复。
- 构建与类型检查通过；13 项核心与师父服务测试（含 240 局随机策略检查）通过。
- Chromium 手机/窄屏/桌面与移动尺寸 WebKit 共 30 项浏览器场景通过；2 项重复进阶流程仅在两种移动引擎运行，另两尺寸主动跳过。

## 平台验收矩阵

| 平台 | 工程与构建 | 安装运行 | 功能与生命周期 | 性能与真机 | 状态 |
| --- | --- | --- | --- | --- | --- |
| Web | Vite 生产构建通过 | 本机开发服务可运行 | 浏览器流程通过 | 真机浏览器、持续运行待验 | 开发中 |
| iOS | Capacitor 工程与无签名模拟器构建通过 | iPhone 17 Pro / iOS 26.5 模拟器已安装运行 | 实际操作出牌、加注、后台与重新启动恢复通过 | 用户有 iPhone，当前未连接；性能、音频待验 | 开发中 |
| Android | Capacitor 工程、SDK 36 / JDK 21 构建通过 | API 36 模拟器安装运行通过 | App 原生自动化通过：行动、加注、Activity 重建恢复、摊牌复盘 | 用户有 Android 手机，当前未连接；性能、音频待验 | 开发中 |
| macOS | Tauri Apple Silicon App 与 DMG 构建通过 | 本机启动和显示通过 | 恢复、加注、翻牌已操作；后台动画等待问题修复后复验通过 | 音频、持续运行与签名公证待验 | 开发中 |
| Windows | Tauri x64 NSIS 安装程序已在 Windows CI 构建通过 | 用户电脑安装待验 | 待验 | 用户有 Windows 电脑；实际运行与音频待验 | 开发中 |

## 后续共同功能

- [x] 新手到进阶九课、逐境解锁与进度恢复。
- [ ] 使用真实决策场景的应用试炼与突破反馈。
- [x] 师父兼容接口、请求白名单、程序事实计算、移动端面板、异常回退与本地凭据配置模板。
- [ ] 国内模型真实联调、质量/延迟验收及服务端发布配置。
- [ ] 各平台可靠存储、后台恢复、音频与窗口/触控适配。
- [x] Web 离线缓存、版本隔离更新、主屏幕安装清单；Chromium / WebKit 断网重载与恢复测试通过。
- [ ] 手机 Safari / Chrome 实际添加到主屏幕与长时间离线验证。
- [x] 原创统一图标、原生启动画面与基础版本元数据（商店发布资料尚未制作）。
- [ ] 可重复的构建脚本、跨平台 CI 和测试证据。
- [ ] 目标设备上的持续运行、帧时间、内存和触控表现。

## 验收规则

每个平台至少记录构建命令、产物位置、实际运行环境、核心玩法、存档恢复、生命周期、音频与布局结果。签名发布、商店上架和真人设备验证分别标注，不以模拟器或浏览器测试替代其结论。

## 本轮证据（2026-10-18）

- `npm run test:e2e`：原生存储桥接加入后重新运行，24 / 24 通过。
- `npm run test:android`：1 / 1 通过，模拟器 API 36，报告在 `android/app/build/reports/androidTests/connected/debug/`，日志 `artifacts/android-instrumentation.log`。这是 Activity 重建恢复，不冒充进程被系统杀死的验证。
- `npm run build:ios`：无签名模拟器构建通过。模拟器截图 `artifacts/ios-native-playing.png`、`artifacts/ios-restored.png`。
- `npm run build:desktop`：生成 Apple Silicon `.app` 与 `.dmg`，当前本地包没有开发者签名或公证。采用 [Tauri 后台节流配置](https://v2.tauri.app/reference/config/#windowconfig) 后，已实际复验：恢复存档继续到翻牌，动作和画面一致；截图 `artifacts/macos-native-playing.png`。
- `artifacts/android-native-latest.png`：实际 Android 原生页面；通过 Capacitor 内置 SystemBars 配置固定深色背景的浅色图标，已重新构建、安装并查看截图确认对比度修复。
- 原生测试构建曾因并行同步目录冲突失败；已加入构建锁。随后根 Gradle 测试任务误运行依赖库旧测试，出现 Kotlin 冲突；改为 `:app:connectedDebugAndroidTest` 后通过。没有把失败尝试计为通过。

## 可重复构建

```sh
npm ci
npm run test:unit
npm run test:e2e
npm run build:android      # Android SDK 36 + JDK 21
npm run test:android       # 只对模拟器执行隔离的 App 测试
npm run build:ios          # macOS + Xcode 26，模拟器 App
npm run build:ios-device   # 未签名真机 App，安装前还需要开发者签名
npm run build:desktop      # macOS: App/DMG；Windows: NSIS 安装程序
```

Android 调试包：`artifacts/packages/wendao-android-debug.apk`。iOS 模拟器包：`artifacts/ios/Build/Products/Debug-iphonesimulator/App.app`。macOS 安装包：`src-tauri/target/release/bundle/dmg/`。

平台脚本串行持有构建锁，避免共享 Web 资源在原生构建期间被覆盖。CI 为 Web、Android、iOS 和两种桌面系统分别提供隔离任务，安装包构建结果不能代替平台运行测试。

## 真机交接

用户已确认有 iPhone、Android 手机和 Windows 电脑。尚未连接或执行，三项真机结果均为待验。Android 可先安装调试 APK；iPhone 需要在本机 Xcode 选择开发团队、信任设备并完成签名；Windows 待 CI 产生安装程序后验证。不要在聊天或仓库里保存私钥、口令或签名证书。

每台设备验收：记录型号与系统版本 → 安装与冷启动 → 完整玩三手（包含弃牌、加注、摊牌、复盘）→ 切后台后返回 → 结束进程后重启 → 检查手牌、灵石与课程进度 → 加注输入键盘与安全区 → 音效、静音与来电恢复 → 持续运行及帧时间/内存测量。只有实际执行后才填写结果。

当前持续目标保持进行中。设备连接、签名与模型凭据尚未具备时，继续完成可自主推进的开发，并记录依赖项。

新增验证：九课逐境解锁及满境恢复在 Chromium / WebKit 移动尺寸通过；生产版离线冷加载、手牌/灵石恢复、离线答题 2 / 2 通过。CI 首轮 Web 出现一次等待动画超过测试默认 5 秒（状态仍在正常推进），已将这项等待改为 15 秒，待 CI 复验；Windows PATH 大小写修复也待 CI 复验。


## 最新增量

- [五个平台 CI 全通过](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39063409844)：包含九课与离线版，Web、Android、iOS、macOS、Windows 的构建/相应测试均通过。Windows 安装程序在本地 `artifacts/packages/windows/nsis/问道牌途_0.2.0_x64-setup.exe`，以及该次 CI 的 `desktop-windows-latest` 附件。这不表示用户 Windows 电脑运行验收已通过。
- 新增师父浏览器测试：规则事实、模拟模型文本、HTML 安全呈现、失败回退与保留同一牌局，在四种浏览器尺寸/引擎通过。实际真实模型尚未配置，模拟响应不作为模型能力证据。
- 13 / 13 核心与师父 HTTP 服务测试通过；服务端类型检查通过。说明见 `docs/AI.md`。
- 新增 `npm run build:ios-signed`，需要 `APPLE_TEAM_ID`。本机已发现开发签名证书，但签名实际尝试失败：Xcode `No Accounts` 与缺少本应用描述文件。已请用户在 Xcode 登录开发者账号并连接 iPhone，保留为待验。
- Android 共享前端加入师父后，原生测试重新运行通过；进一步加入完整动画与师父面板断言后，原生测试再次通过（1 / 1）。

- 最新本机验证：核心与服务 13 / 13、浏览器 30 通过 / 2 个按项目跳过、生产离线 2 / 2、Android 原生完整动画与师父断言 1 / 1；依赖 audit 已修复构建工具的旧 UUID 依赖，官方 registry 审计为 0 已知漏洞。
- Windows 新增 NSIS 静默安装与 Tauri WebDriver 原生运行验证脚本，覆盖加注、存档重载、摊牌、复盘和窄窗口，并保留截图；当前仅完成脚本与语法检查，等待 Windows CI 实际运行，不计为通过。使用 [Tauri 官方 WebDriver 方案](https://v2.tauri.app/develop/tests/webdriver/ci/)。
