# 跨平台持续交付与验收

目标：完成移动端优先的《问道牌途》在 iOS、Android、Windows、macOS 和 Web 的开发与验证。美术与动效要求以根目录 AGENTS.md 为准。持续目标仍在进行，未实际执行的验收保持待办，构建通过不等于真机运行或性能通过。

## 共同能力

- 独立扑克规则、加密随机洗牌、六人单人练习、七选五比牌、主池与边池、平局分池、未跟注返还。
- 五名只接收本人底牌与公开信息的本地策略对手；当前对手不是求解器或大语言模型。
- 九课三阶段、十八道练习、逐境解锁与学习进度、本手公开行动复盘；三场问心试炼使用真实规则，独立于随机练习桌。
- 手机底部操作、加注确认、减少动态效果、暂停、存档恢复；损坏的结算记录被拒绝，旧版弃牌结算可迁移。
- 师父面板先展示程序事实；兼容接口在服务端持有密钥，模型文本安全呈现，离线或失败时回退本地指引。
- 移动端 Preferences 与桌面原生文件存储桥接、Web 离线缓存与版本隔离更新、主屏幕安装清单、统一图标与启动画面。
- 本地分发 OFL 授权宋体子集；Canvas 绘制前加载，字体或入口模块加载失败可回退或重试。

## 当前平台矩阵

| 平台 | 工程与构建 | 实际运行和功能证据 | 仍待验收 |
| --- | --- | --- | --- |
| Web | Vite 生产构建通过 | Chromium 手机/窄屏/桌面、移动尺寸 WebKit；离线重载与恢复通过 | 手机浏览器安装至主屏幕、长时间离线、实际触控和性能 |
| iOS | Capacitor 模拟器和未签名真机工程可构建 | iPhone 17 Pro / iOS 26.5 模拟器；师父面板、试炼和进程终止再启动恢复 XCTest 2 项通过 | Xcode 账号及签名、连接 iPhone、真机音频与持续性能 |
| Android | SDK 36 / JDK 21 调试 APK 可构建 | API 36 模拟器，原生自动化覆盖行动、加注、Activity 重建、完整动画、摊牌复盘、师父与试炼印记恢复；主机编排强制停止与新进程恢复通过 | 真机连接、低内存回收、音频、触控与持续性能 |
| macOS | Tauri Apple Silicon App / DMG 可构建 | 本机已操作恢复、加注、翻牌、师父；最新窗口初始化的 GUI 复验待解锁 | 最新包窗口复验、音频、持续性能、签名公证 |
| Windows | Tauri x64 NSIS 可构建 | 4d5b219 的 Windows CI 实际安装通过 12 项检查，包括结束整个原生进程树、新进程恢复下一手、灵石、课程及印记；原生文件测试 4 项通过 | 用户电脑实际运行、音频与持续性能 |

用户已确认有 iPhone、Android 手机、Windows 电脑和 Apple 开发者账号；这些条件尚不等于设备已连接或已验收。iOS 签名实测曾报 `No Accounts` 和缺少描述文件，等待用户在本机 Xcode 登录并连接设备。

## 最近验证

最近已确认全绿的功能提交 49bdc5c：[39078990197](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39078990197)，Web、Android、iOS、macOS、Windows 五项任务全部成功。其中规则/服务/平台单元测试 20 项，浏览器 46 项通过、2 项有意跳过，生产离线 4 项通过。iOS 包含原生 XCTest，Windows 包含 NSIS 安装后的实际原生运行，不是独立浏览器替代。

该版本机原生回归：Android 原仪器及独立进程恢复流程、iOS XCTest 2 项通过。报告与日志：

- `artifacts/android-lifecycle-final.log`、`artifacts/android-process-death/result.json`
- `artifacts/ios-lifecycle-final.log`、`artifacts/ios-native-1792279145447.xcresult`
- `artifacts/windows-49bdc5c-run/artifacts/windows-native/`（下载的 CI 原生截图与结果 JSON）
- `artifacts/show-me-platforms.html`（实际 iOS 模拟器与 Windows CI 截图，明确标注环境）

### 已完成：音频生命周期

关闭音效、页面隐藏或收到原生后台事件时，取消已排期的音符并暂停音频上下文；显式继续后再恢复。快速开启后立即关闭也会取消仍在等待恢复的预览，避免悬挂请求；再次开启可正常播放。销毁场景关闭上下文并移除监听。禁用 Phaser 未使用的音频管理器，避免额外创建音频上下文。

新增浏览器测试使用真实 Web Audio 对象而非假音频引擎，覆盖按需创建、模拟原生后台事件、手动恢复、取消和弦、销毁与关闭后不再创建，四种配置共 8 项通过。这里验证的是浏览器资源状态，不能替代手机扬声器、静音模式、来电或蓝牙验证。API 语义见 [MDN AudioContext.suspend](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend)。

本轮生产构建、15 项核心/服务测试、服务端类型检查通过；浏览器 42 项通过、2 项重复进阶场景按项目主动跳过。Android 原生测试 1 项、iOS XCTest 1 项、生产离线 2 项通过，macOS App / DMG 重建通过。日志为 `artifacts/audio-e2e-final.log`、`artifacts/android-audio-final.log`、`artifacts/ios-audio-final.log`、`artifacts/macos-audio-final.log`、`artifacts/offline-audio-final.log`；iOS 报告为 `artifacts/ios-native-1792275303160.xcresult`。音频增量的 Windows 与云端回归已在上方 CI 全部通过。

中途构建目录和报告目录曾因并发清理失败，已改为独立测试轮次及串行原生构建，不将失败或中断轮次计为通过。快速开关专项测试发现浏览器恢复请求可能悬挂，已补齐取消处理并回归。


### 本轮：三境问心试炼

每境三课完成后开放一场预设试炼：大盲免费过牌、按最近足额增量做最小再加注、短码全下后观察主池/边池。起始局面由规则引擎按合法行动生成，下注、发牌和分池使用同一规则核心；只按指定规则操作记达成，不把胜负或一种行动解释成最优策略。试炼不改动随机练习桌的手牌和灵石。

试炼完成印记单独保存，原生 Preferences 初始化包含新存储键。进入试炼从顶部任务开始，结算反馈获得焦点，返回后定位到对应入口。牌面、纸质卡片、墨青桌面和「悟」印记保持原有视觉方向；减少动态效果时取消入场动画。

当前验证：核心与服务 19 项通过；浏览器整轮 46 项通过、2 项有意跳过；随后焦点与完成区安全区调整的四种浏览器试炼回归 4 项通过。Android 原生 1 项、iOS XCTest 2 项通过；Android 验证 Preferences 写入及 Activity 重建后恢复，iOS 通过实际点击课程/试炼并终止进程后重启恢复。首次 iOS 新用例因匹配了被学习进度覆盖的初始标签失败，已根据实际可访问树修正并重跑通过。

证据：`artifacts/trials-e2e-final.log`、`artifacts/trials-browser-controls.log`、`artifacts/android-trials-controls.log`、`artifacts/ios-trials-controls.log`；iOS 报告为 `artifacts/ios-native-1792277030640.xcresult`。手机尺寸实际截图为 `artifacts/trial-raise-mobile.png`、`artifacts/trial-short-mobile-webkit.png`。这些是浏览器/模拟器验证，不是真机证明。

macOS App / DMG 已重建。生产离线回归 4 项通过，包含断网进入试炼及断网重载后印记恢复（`artifacts/offline-trials-controls.log`）。Windows 原生试炼、印记重载及练习钱包隔离检查已在 [试炼 CI](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39075570728) 实际安装运行后通过，结果 JSON 和截图下载于 `artifacts/windows-trials-run/artifacts/windows-native/`。该试炼 CI 后续五项全部通过。安全区提交 a1523d8 的 iOS / Android / macOS / Windows 通过，Web 回归发现迟到音频恢复问题，见下方增量。实际截图预览为 `artifacts/show-me-trials.html`。

最后的界面修正：单纯把反馈滚入视野仍可能遮住完成按钮。现改为滚至内容末尾，保留底部安全区；浏览器 320×568 断言与 iOS 原生按钮位置断言均通过。修正后的模拟器截图位于 `artifacts/ios-trials-controls-attachments/`。


### 本轮：进程恢复与迟到音频恢复

- Android 新增独立主机编排：在模拟器准备真实手牌、课程及试炼印记 → 启动 App 并记录 PID → `am force-stop` → 确认 PID 消失 → 重新启动取得新 PID → 由另一轮 instrumentation 核对同一手牌、灵石、课程进度及印记。原仪器测试 1 项通过；两个专用方法在普通 Gradle 轮次中主动跳过，由主机按准备/恢复阶段各执行并明确校验通过。结果为 `artifacts/android-process-death/result.json`，原始命令日志为同目录 `adb.log`，完整回归为 `artifacts/android-lifecycle-final.log`。此结果是强制停止后的恢复，不是低内存回收或真机验收。命令依据 [Android adb](https://developer.android.com/tools/adb#am) 和 [命令行测试说明](https://developer.android.com/studio/test/command-line)。
- 安装测试夹具前要求仅连接一台已确认的模拟器，并将 Gradle 与 adb 绑定到该序列号；真机、混合连接、多台设备及不匹配的序列号会被预检拒绝。规则单元测试通过，实际执行环境为本机 API 36 模拟器。失败或未完成的主机测试不会保留旧的成功结果。
- a1523d8 的 CI 发现快速静音后，迟到的恢复仍可能使音频上下文回到运行状态。新增延迟原生 `resume` 的回归先在旧代码稳定失败，再补齐 `statechange` 下的静音约束；当前 8 项音频测试通过，包含等待迟到请求真正完成后仍为暂停状态。保留关闭音效、后台暂停、显式恢复及销毁的检查。修复前后日志为 `artifacts/audio-late-resume-before.log`、`artifacts/audio-late-resume-after.log`。

本轮本机：规则/服务/平台单元测试 20 项、完整浏览器 46 项通过（2 项按项目有意跳过）、离线 4 项通过；Android 仪器与主机进程恢复流程、iOS XCTest 2 项通过。最新 iPhone 未签名 arm64 App 和 macOS App / DMG 已重建。日志为 `artifacts/mobile-lifecycle-e2e.log`、`artifacts/ios-lifecycle-final.log`、`artifacts/ios-device-lifecycle-final.log`、`artifacts/macos-lifecycle-final.log`、`artifacts/offline-lifecycle-final.log`。iOS 报告为 `artifacts/ios-native-1792279145447.xcresult`。这次音频修正的最终云端回归以 PR 当前提交的检查为准，未把 a1523d8 的失败运行计为整轮通过。


### 本轮：完整浏览器与 Windows 冷启动验收

Chromium 和 WebKit 新增关闭独立浏览器、从同一磁盘配置目录重新打开的用例：核对进行中手牌、灵石、课程及试炼印记。两种引擎各 1 项通过，另两种重复尺寸按项目主动跳过；日志为 `artifacts/browser-relaunch-final.log`。此前完整浏览器 46 项通过的证据继续保留，新整轮结果以当前提交的 CI 为准。

Windows 新增在下一手进行中暂停、记录手牌和灵石、按自身 PID 强制终止 App 及子进程、确认旧调试端点消失、重新启动并核对存档与印记。仅作用于测试配置目录及本测试启动的进程，依据 [taskkill 官方参数](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill)。e974248 的 [39080795780](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39080795780) 实跑发现重启回到了上一手，下一手未保留；结果与截图位于 `artifacts/windows-e974248-run/artifacts/windows-native/`。该运行明确失败，不能继续用旧版重载测试代表完整进程恢复。

49bdc5c 的五平台候选产物已收齐于 `artifacts/packages/candidate-49bdc5c/`，包括 Web ZIP、Android 调试 APK、iOS 模拟器与未签名设备 App ZIP、macOS arm64 DMG、Windows x64 NSIS。`manifest.json` 记录来源提交和验收边界，`SHA256SUMS.txt` 校验值已逐文件复核。Windows 包来自同提交成功的 CI；iOS 设备包仍需开发者签名，不能直接安装。该候选包的 Windows 证据只覆盖重载恢复；后续冷启动发现回退问题，现保留用于复现，manifest 已标记不可作为正式发布版本。

### 本轮：桌面原生文件检查点

修复 Windows / macOS 仅依赖 WebView 本地存储的进程退出风险：原生命令只接受四个游戏存储键，限制大小，持有进程与文件锁，写入临时文件并同步后替换主记录；关键牌局行动等待原生写入确认。存档损坏或读写失败会明确报错，不覆盖坏记录，也不把内存中的临时练习误报为保存成功。原生命令在后台任务执行。桌面首次启动迁移旧记录，移动端继续使用 Preferences。

本机 release Rust 文件测试 4 项通过，覆盖新实例读取、残留临时文件、覆盖写入、非法写入保留旧文件、损坏记录保护及并发键合并。完整浏览器 52 项通过、4 项按项目有意跳过，包含 Chromium / WebKit 的独立进程重开和四种配置的存储失败提示。失败提示用例明确模拟 IPC 不可用，不能代表原生磁盘运行。规则/服务/平台测试 20 项及服务端类型检查通过。

证据：`artifacts/desktop-store-release-tests.log`、`artifacts/native-store-full-browser.log`、`artifacts/native-store-unit.log`、`artifacts/storage-failure-mobile.png`。Android 本轮仪器及独立进程恢复流程通过（`artifacts/native-store-android.log`，新旧进程 7895 → 7992）；iOS XCTest 2 项通过（`artifacts/native-store-ios.log`、`artifacts/ios-native-1792283973574.xcresult`），未签名设备 App 与 macOS App / DMG 构建通过，生产离线 4 项通过（分别为 `artifacts/native-store-ios-device.log`、`artifacts/native-store-macos.log`、`artifacts/native-store-offline.log`）。macOS 界面复验仍因锁屏未执行。CI 新增 macOS / Windows 上的原生文件测试；4d5b219 的 Windows 安装包已通过 12 项原生检查，包含强制结束进程树后从 1720 切换至 3328，恢复下一手、灵石、课程和印记，结果位于 `artifacts/windows-4d5b219-run/artifacts/windows-native/result.json`。

实现使用 [Tauri 原生命令](https://v2.tauri.app/develop/calling-rust/)、[Rust 文件同步与锁](https://doc.rust-lang.org/std/fs/struct.File.html) 和 [文件替换](https://doc.rust-lang.org/std/fs/fn.rename.html)。测试涉及进程结束；不宣称覆盖系统断电或硬件故障。

### 本轮：跨系统测试启动条件

4d5b219 的 [39083719029](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39083719029) 中，Windows、macOS、Android 成功；整轮仍失败。Web 51 项通过、1 项在 Linux WebKit 启动前失败：中文用例名进入配置目录参数，启动器在 C locale 下报 `Invalid byte sequence in conversion input`。现使用独立临时配置目录，两次启动仍共用同一目录；不跳过 WebKit，也不改变恢复断言。macOS 本机两种引擎重开回归 2 项通过（另两种重复尺寸主动跳过），日志为 `artifacts/browser-profile-path-fix.log`。

iOS 同轮在 Xcode 首次启动应用超时，未进入功能断言；本机原生 2 项通过的证据保持独立记录。现先用本机 Xcode 的 `simctl bootstatus <id> -b` 确认测试模拟器完成初次启动和迁移，再交给 XCTest；未增加忽略失败或自动重试。CI 即使 iOS 测试失败也保留 xcresult，便于核对后续失败。本机更新后的 iOS 2 项 XCTest 通过（`artifacts/ios-bootstatus-regression.log`、`artifacts/ios-native-1792284749805.xcresult`），规则/服务/平台 20 项及服务端类型检查通过；当前修改的云端结果仍待执行。

## 可重复执行

```sh
npm ci
npm run test:unit
npm run check:server
npm run test:e2e
npm run test:offline
npm run build:android
npm run test:android       # 单台隔离模拟器；含独立进程恢复
npm run build:ios
npm run test:ios
npm run build:ios-device   # 未签名；还不能直接安装
APPLE_TEAM_ID=你的团队ID npm run build:ios-signed
npm run build:desktop     # macOS App/DMG；Windows NSIS
npm run test:desktop      # 原生文件存档测试
```

平台脚本在共享 Web 构建、原生同步和原生构建期间持有构建锁，避免资源被并发覆盖。CI 各平台使用独立任务。Android 脚本只测试本应用，避免误运行依赖库的旧测试。测试构建强制禁用远程师父地址，不调用可能计费的模型。

产物位置：Android `artifacts/packages/wendao-android-debug.apk`；iOS 模拟器 `artifacts/ios/Build/Products/Debug-iphonesimulator/App.app`；macOS `src-tauri/target/release/bundle/dmg/`；Windows 为 CI `desktop-windows-latest` 附件中的 NSIS 安装程序。CI 附件有保留期限，不等同正式发布。

Windows 测试采用安装后启动 App、测试进程显式启用本机端口、EdgeDriver attach 的方式；正常启动不启用调试端口。早期 WebView2 会话失败已解决，失败运行仍保留在 CI 历史中。macOS 最新窗口初始化已构建，GUI 复验因界面工具报告锁屏而尚未完成。

## 剩余交付条件

- 国内模型真实联调：提供服务 Base URL、模型名，在本机 `.env` 配置密钥；具体步骤见 `docs/AI.md`。目前仅验证兼容接口和模拟响应，未验证实际模型质量或延迟。
- 公网师父服务：账号鉴权、配额、持久限流、HTTPS、发布环境和相应隐私披露。当前服务是本机开发网关。
- 真机与用户电脑验收、商店资料及签名发布；用户尚未要求实际提交商店或正式发布。
- 各平台音频、持续帧时间与内存、触控延迟。60 FPS 是目标，尚无真机测量结论。`web-perf` 技能要求的 Chrome DevTools MCP 未配置，专项性能审计未执行。

真机步骤：记录型号和系统 → 安装、冷启动 → 玩三手（弃牌、加注、摊牌和复盘）→ 切后台再返回 → 结束进程再启动 → 核对手牌、灵石和课程进度 → 检查键盘、安全区和触控 → 音效、静音、来电恢复 → 持续帧时间和内存测量。每一项只在实际完成后填写结果。
