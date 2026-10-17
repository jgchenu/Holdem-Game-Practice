# 跨平台持续交付与验收

目标：完成移动端优先的《问道牌途》在 iOS、Android、Windows、macOS 和 Web 的开发与验证。美术与动效要求以根目录 AGENTS.md 为准。持续目标仍在进行，未实际执行的验收保持待办，构建通过不等于真机运行或性能通过。

## 共同能力

- 独立扑克规则、加密随机洗牌、六人单人练习、七选五比牌、主池与边池、平局分池、未跟注返还。
- 五名只接收本人底牌与公开信息的本地策略对手；当前对手不是求解器或大语言模型。
- 九课三阶段、十八道练习、逐境解锁与学习进度、本手公开行动复盘。
- 手机底部操作、加注确认、减少动态效果、暂停、存档恢复；损坏的结算记录被拒绝，旧版弃牌结算可迁移。
- 师父面板先展示程序事实；兼容接口在服务端持有密钥，模型文本安全呈现，离线或失败时回退本地指引。
- 原生 Preferences 存储桥接、Web 离线缓存与版本隔离更新、主屏幕安装清单、统一图标与启动画面。
- 本地分发 OFL 授权宋体子集；Canvas 绘制前加载，字体或入口模块加载失败可回退或重试。

## 当前平台矩阵

| 平台 | 工程与构建 | 实际运行和功能证据 | 仍待验收 |
| --- | --- | --- | --- |
| Web | Vite 生产构建通过 | Chromium 手机/窄屏/桌面、移动尺寸 WebKit；离线重载与恢复通过 | 手机浏览器安装至主屏幕、长时间离线、实际触控和性能 |
| iOS | Capacitor 模拟器和未签名真机工程可构建 | iPhone 17 Pro / iOS 26.5 模拟器；师父面板、进程终止再启动恢复 XCTest 1 项通过 | Xcode 账号及签名、连接 iPhone、真机音频与持续性能 |
| Android | SDK 36 / JDK 21 调试 APK 可构建 | API 36 模拟器，原生自动化覆盖行动、加注、Activity 重建、完整动画、摊牌复盘和师父面板 | 真机连接、系统杀进程恢复、音频、触控与持续性能 |
| macOS | Tauri Apple Silicon App / DMG 可构建 | 本机已操作恢复、加注、翻牌、师父；最新窗口初始化的 GUI 复验待解锁 | 最新包窗口复验、音频、持续性能、签名公证 |
| Windows | Tauri x64 NSIS 可构建 | Windows CI 实际安装并启动原生 App，通过加注、重载恢复、摊牌复盘和 360px 窗口测试 | 用户电脑实际运行、音频与持续性能 |

用户已确认有 iPhone、Android 手机、Windows 电脑和 Apple 开发者账号；这些条件尚不等于设备已连接或已验收。iOS 签名实测曾报 `No Accounts` 和缺少描述文件，等待用户在本机 Xcode 登录并连接设备。

## 最近验证

上一版完整 CI：[39073060344](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39073060344)，Web、Android、iOS、macOS、Windows 五项任务全部成功。其中核心/师父服务 15 项，浏览器 34 项通过、2 项有意跳过，生产离线 2 项通过。iOS 包含原生 XCTest，Windows 包含 NSIS 安装后的实际原生运行，不是独立浏览器替代。

该版本机原生回归：Android 1 项、iOS 1 项通过。报告与日志：

- `artifacts/android-final.log`
- `artifacts/ios-final.log`、`artifacts/ios-native-1792273536679.xcresult`
- `artifacts/windows-final-run/artifacts/windows-native/`（下载的 CI 原生截图与结果 JSON）
- `artifacts/show-me-platforms.html`（实际 iOS 模拟器与 Windows CI 截图，明确标注环境）

### 本轮：音频生命周期

关闭音效、页面隐藏或收到原生后台事件时，取消已排期的音符并暂停音频上下文；显式继续后再恢复。快速开启后立即关闭也会取消仍在等待恢复的预览，避免悬挂请求；再次开启可正常播放。销毁场景关闭上下文并移除监听。禁用 Phaser 未使用的音频管理器，避免额外创建音频上下文。

新增浏览器测试使用真实 Web Audio 对象而非假音频引擎，覆盖按需创建、模拟原生后台事件、手动恢复、取消和弦、销毁与关闭后不再创建，四种配置共 8 项通过。这里验证的是浏览器资源状态，不能替代手机扬声器、静音模式、来电或蓝牙验证。API 语义见 [MDN AudioContext.suspend](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend)。

本轮生产构建、15 项核心/服务测试、服务端类型检查通过；浏览器 42 项通过、2 项重复进阶场景按项目主动跳过。Android 原生测试 1 项、iOS XCTest 1 项、生产离线 2 项通过，macOS App / DMG 重建通过。日志为 `artifacts/audio-e2e-final.log`、`artifacts/android-audio-final.log`、`artifacts/ios-audio-final.log`、`artifacts/macos-audio-final.log`、`artifacts/offline-audio-final.log`；iOS 报告为 `artifacts/ios-native-1792275303160.xcresult`。本轮 Windows 及云端回归待 CI。

中途构建目录和报告目录曾因并发清理失败，已改为独立测试轮次及串行原生构建，不将失败或中断轮次计为通过。快速开关专项测试发现浏览器恢复请求可能悬挂，已补齐取消处理并回归。

## 可重复执行

```sh
npm ci
npm run test:unit
npm run check:server
npm run test:e2e
npm run test:offline
npm run build:android
npm run test:android       # 隔离测试仅对模拟器执行
npm run build:ios
npm run test:ios
npm run build:ios-device   # 未签名；还不能直接安装
APPLE_TEAM_ID=你的团队ID npm run build:ios-signed
npm run build:desktop     # macOS App/DMG；Windows NSIS
```

平台脚本在共享 Web 构建、原生同步和原生构建期间持有构建锁，避免资源被并发覆盖。CI 各平台使用独立任务。Android 脚本只测试本应用，避免误运行依赖库的旧测试。测试构建强制禁用远程师父地址，不调用可能计费的模型。

产物位置：Android `artifacts/packages/wendao-android-debug.apk`；iOS 模拟器 `artifacts/ios/Build/Products/Debug-iphonesimulator/App.app`；macOS `src-tauri/target/release/bundle/dmg/`；Windows 为 CI `desktop-windows-latest` 附件中的 NSIS 安装程序。CI 附件有保留期限，不等同正式发布。

Windows 测试采用安装后启动 App、测试进程显式启用本机端口、EdgeDriver attach 的方式；正常启动不启用调试端口。早期 WebView2 会话失败已解决，失败运行仍保留在 CI 历史中。macOS 最新窗口初始化已构建，GUI 复验因界面工具报告锁屏而尚未完成。

## 剩余交付条件

- 国内模型真实联调：提供服务 Base URL、模型名，在本机 `.env` 配置密钥；具体步骤见 `docs/AI.md`。目前仅验证兼容接口和模拟响应，未验证实际模型质量或延迟。
- 公网师父服务：账号鉴权、配额、持久限流、HTTPS、发布环境和相应隐私披露。当前服务是本机开发网关。
- 教学扩展：将课程知识应用到指定决策场景的试炼与突破反馈，当前不把普通测验表述成场景试炼。
- 真机与用户电脑验收、商店资料及签名发布；用户尚未要求实际提交商店或正式发布。
- 各平台音频、持续帧时间与内存、触控延迟。60 FPS 是目标，尚无真机测量结论。`web-perf` 技能要求的 Chrome DevTools MCP 未配置，专项性能审计未执行。

真机步骤：记录型号和系统 → 安装、冷启动 → 玩三手（弃牌、加注、摊牌和复盘）→ 切后台再返回 → 结束进程再启动 → 核对手牌、灵石和课程进度 → 检查键盘、安全区和触控 → 音效、静音、来电恢复 → 持续帧时间和内存测量。每一项只在实际完成后填写结果。
