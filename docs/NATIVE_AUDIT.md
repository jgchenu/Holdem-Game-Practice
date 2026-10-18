# 原生运行验收

用户本轮接受 iOS / Android 模拟器。以下采样不能证明真机性能、GPU 实际呈现帧率或扬声器可听效果；60 FPS 仍是目标。

## 可重复执行

先准备项目专用模拟器，再运行：

```sh
npm run audit:android
IOS_TEST_DEVICE=<模拟器 UUID> npm run audit:ios
```

两个命令使用单独的验收构建，开启精美画质与完整动效，通过原生触摸事件开启真实 Web Audio。检查首次触摸前未创建音频上下文、开启/静音、切后台暂停、恢复后手牌不变，并连续运行至少 65 秒的真实牌局。测试通过只表示这些检查完成，帧时间是否达标应另看报告。

验收过程会修改该模拟器中的偏好及练习进度。Android 只接受已确认的模拟器；不要在手机真机上执行这些测试。iOS 应显式选择测试专用设备。平台构建串行执行，采样期间也不要同时运行其他平台构建或浏览器测试。

- Android 报告：`artifacts/android-native-runtime-<时间>.json`，来自 Gradle 保留的原生测试日志；测试结束卸载 App 后仍可导出。
- iOS 报告：`artifacts/ios-audit-<时间>.xcresult` 中的 `ios-native-runtime-audit` 附件。
- 验收 APK：`artifacts/packages/wendao-android-audit.apk`，不覆盖普通调试包。
- iOS 验收 App：`artifacts/ios-audit/Build/Products/Debug-iphonesimulator/App.app`。
- `npm run build:desktop-audit` 使用单独的桌面标识和存档目录；桌面运行结果需另外实测。

桌面验收面板还提供「连续牌局验收」：由一次真实原生点击开启真实音频，再通过正常操作控件连续运行至少 65 秒，结束后暂停牌局、静音并固定本轮报告。只观察浏览器资源、渲染回调与正常规则结果，不代替规则引擎。验收期间不要运行其他构建或浏览器回归；「停止验收」或进入后台会将本轮标为未完成。简短 `MEASURE` 与完整 `AUDIT` 均来自同一实际采样，不是示意数据。

普通构建不包含采样面板，也不会强制修改玩家偏好。常规 `test:ios` 额外保留首次触摸诊断：教学第一次点击必须打开，不重试、不跳过首次进程；失败后才打开诊断面板并附上触摸目标、坐标、弹窗状态和页面错误。

## 指标含义

Windows 原生网络验收新增 `WENDAO_COACH_FIXTURE=1`：仅在独立 `desktop-audit` 构建启用回环网关地址，不能与真实模型模式同时开启。测试进程启动真实 `createCoachServer` 与本机兼容上游替身，断言原生页面发出的实际 Origin、HTTP 200 / 502 / 504、成功回复与本地回退、公开信息边界及手牌/钱包保持。回复明确写“兼容接口验收替身（非真实模型）”，不读取 `.env` 或使用 DeepSeek 密钥。替身自身通过本机真实 HTTP 单元检查；Windows 端结果须以新增 CI 的 `coach-transport.json` 和实际截图为准，不能把该替身写成真实模型联调。

Windows CI 请求 `WENDAO_SOAK_CYCLES=15`，每轮走实际 65 秒牌局并验证新音频计数；本地省略时仍为一轮。每轮结束保存 `soak.json`，失败也保留已经完成的轮次。内存从主进程扩展为递归子进程及本次独立配置目录所属的 WebView2 进程，记录每个 PID 的私有字节和工作集；无关窗口与相似目录会被排除，若进程在两次系统查询之间消失，会记录缺失 PID。主进程必须存在，且采样中必须实际有 WebView2。682109f 的真实 Windows 系统采集与 15 轮长测已执行，结果见下方；后续目录匹配另补充了 WebView2 子目录边界的单元检查。

## 最新增量：长测与网络资源释放

- **Windows CI / 682109f**：15 轮、98 手牌、1,037,826 ms（约 17.3 分钟），各轮回调 P95 15.7 ms，总最大间隔 31.3 ms，未记录超过 50 ms 的间隔。每次实际采到 8 个进程，没有缺失 PID；进程组私有字节由 390,606,848 增至 466,276,352，第 6–15 轮约 439–445 MiB。后半段有波动范围，不代表没有泄漏。窗口 460×920，精美画质、完整动效，实际 renderer 为 Microsoft Basic Render Driver / D3D11。证据：`artifacts/windows-682109f-run/artifacts/windows-runtime/{runtime,soak}.json`。这是 CI 环境，不是用户 Windows 电脑。
- 同一 Windows 原生窗口实际经过 HTTP 网关与兼容上游替身，Origin 为 `http://tauri.localhost`；成功 200、上游错误转 502、超时转 504 均通过，预检 204、回退、手牌/钱包保持及超时连接取消也通过。截图与 `coach-transport.json` 在同目录。替身不是 DeepSeek；没有使用服务商密钥。
- **本机独立 Chromium / 390×844 / DPR 2**：15 轮、99 手牌、985,971 ms（约 16.4 分钟），无页面脚本错误；各轮回调 P95 16.7–16.8 ms，总最大间隔 149.9 ms，超过 50 ms 共 5 个。实际 renderer 是 SwiftShader 软件驱动，不能与此前 Metal 浏览器短测混为一谈。自然 GC 下堆使用量有下降也有增长，开始 8,556,316、结束 32,273,672 字节；浏览器进程组 RSS 开始 590,708,736、结束 828,882,944 字节，不能宣称无增长或无泄漏。DOM / listener 数随 GC 回落。记录见 `artifacts/web-soak/report.json` 与首末截图；此轮运行时 HEAD 为 682109f，新增长测脚本当时尚未提交，客户端源码未变。复现：`npx playwright test --config playwright.soak.config.ts`，默认 15 轮，与默认功能测试隔离。
- **iOS / 682109f 云端失败保留**：常规首个冷启动教学用例失败，另两个功能用例通过，运行审计按配置跳过。失败层级中整棵原生窗口为 `{inf,inf,0,0}`；同一进程视频 105 秒画面已完整显示，BOOTSTATE 为 ready、inert=false、errors=[]。不能归因于页面仍在初始化，也尚未确认唯一根因。原始报告 `artifacts/ios-682109f-run/`，层级 `artifacts/ios-682109f-attachments/09C92BB3-FB55-4D8F-9B6C-27A0586B3B97.txt`，视频帧 `artifacts/ios-682109f-startup-105.png`。新测试在第一进程前连接 Simulator 显示，并先检查原生窗口有效几何，保留首次真实点击断言；本机新设备 3 项通过，`artifacts/ios-native-1792314634125.xcresult`，云端复验仍待执行。没有重试教学点击、强制坐标点击或跳过首次进程。
- **服务端连接释放修复**：兼容上游若返回错误状态后持续发送未结束的正文，旧网关虽已回退，但连接仍存活。现在在错误路径取消正文，再清理超时。真实回环 HTTP 回归先失败后通过，日志为 `artifacts/coach-error-stream-before.log` / `artifacts/coach-error-stream-after.log`；单元共 27 项及服务端类型检查通过。不是用真实模型制造故障。

后续本机 iOS 长测已完整结束：专用 iPhone 17 Pro / iOS 26.5 模拟器 15 轮、93 手牌、981,893 ms 实际牌局采样、58,796 个回调样本；各轮 P95 20–21 ms，总最大间隔 67 ms，超过 50 ms 共 3 个。精美画质、完整动效，实际 renderer 为 Apple GPU。各轮真实音频开始次数增加，结束时均 suspended，原生测试通过。每轮归属本设备的 App、WebContent、Networking、GPU 四个进程均实际采到；RSS 合计首轮 999,784,448、末轮 828,817,408 字节，范围 815,759,360–999,784,448 字节，不代表 iPhone RAM 或没有泄漏。每次主机采集耗时 631–712 ms；测试在固定本轮报告后安排两秒停顿，为主机采集留出间隔。记录为 `artifacts/ios-extended-soak/{report,summary,provenance}.json`、`run.log` 及 `artifacts/ios-audit-1792315024594.xcresult`。期间没有本机构建、浏览器测试、Android 模拟器或归档解压，有短时文档/Git、远程 CI 查询及本机网关重启/健康检查；XCTest 本身持续查询可操作状态，因此不是无观测开销的手机性能测量。结束后测试设备已关闭，普通原生资源已恢复。

11d0912 云端原生功能复验仍失败：窗口几何这次确为 `(0,0,402,874)`，真实启动 ready / inert=false 后，首次「从零学德州」点击未打开教学，另两项功能测试通过；不能把连接显示认定为已解决所有首次输入问题。日志 `artifacts/ios-11d0912-job.log`，运行 [39115185096](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39115185096)。首次触摸诊断及完整 xcresult 继续保留，唯一根因尚未确认。

该次原始触摸记录现已下载：`artifacts/ios-11d0912-attachments/09DFBAED-4F63-457C-91F8-200A053671C7.txt`。按下准确落在 `learn-start`，约 110 ms 后发生 pointercancel / touchcancel，没有 up / end / click；当时 ready、inert=false、focused=true、无脚本错误。之后诊断按钮能收到完整点击。这确认了该次手势被取消，但不能单独认定是哪一个原生识别器。参照 [Pointer Events 的触摸行为定义](https://www.w3.org/TR/pointerevents/#details-of-touch-action-values) 和 [Apple 滚动取消说明](https://developer.apple.com/documentation/uikit/uiscrollview/cancancelcontenttouches)，固定首屏入口与常驻教学按钮现在单独设为 `touch-action:none`，避免从这些控件开始的手势被当作视口拖动；仍使用标准 click，不在按下时提前执行。教学内容独立滚动区不改动。修改后教学/启动浏览器 28 项通过，含 320×568 和移动 WebKit；新装 iOS 本机首次教学、滚动、进程恢复和试炼 3 项通过，报告 `artifacts/ios-native-1792316695119.xcresult`、`artifacts/ios-fixed-entry-gesture.log`。这仍是待云端复验的候选修正，不能把本机通过说成根因已确定。此前 15 轮长测与 a001301 候选包不含这一输入策略改动。

iOS 原生 15 轮长测可用专用命名设备运行：`IOS_TEST_DEVICE=<Wendao Soak 开头的专用设备 UUID> node scripts/ios-runtime-soak.mjs`。它只接受单一已启动测试设备，先确认新启动环境中没有 WebKit 进程，再按本设备的 `launchd_sim` 后代采集 App 与 WebKit RSS；不把桌面 Safari/WebKit 或其他模拟器算入。实际结果在 `artifacts/ios-extended-soak/report.json`，仅当 15 轮原生断言全部完成且无采集错误才记通过。RSS 可重复计算共享页，不能称作 iPhone 实际 RAM 或 GPU 显存。长测期间不要并行本机构建或浏览器测试。

内存字段采用 [.NET PrivateMemorySize64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.privatememorysize64) 和 [WorkingSet64](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.workingset64) 的字节值；工作集包含共享页面，所以跨进程求和可能重复计算，不能称为独占物理内存或 GPU 显存。进程亲属关系依据 [Win32_Process](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process)。连续采样完成本身不证明没有泄漏，仍需检查预热后的变化和异常；不借此承诺手机帧率。

`p50Ms` / `p95Ms` / `p99Ms` 是可见页面的 `requestAnimationFrame` 间隔；`busyP95Ms` 只统计牌局动效进行中的样本。切后台时重置相邻帧时间，避免将后台停留算成动画卡顿。记录实际 WebGL renderer、画布尺寸、像素比和 CPU 并发数，不能只根据模拟器启动日志判断硬件加速。

音频状态和振荡器开始/停止次数来自实际 AudioContext。Android 内存值为 App 主进程 PSS，不包含独立 WebView renderer；短时前后差值不能用来认定无内存泄漏。

`WENDAO_GRAPHICS_COMPARE=1 npm run audit:android` 可追加相同模拟器中的空闲牌桌、去掉背景纹理、最小页面三组顺序对照。它是诊断手段，不会永久移除产品材质，不能直接推导手机性能。

## 本轮已知结果

- 全新 iPhone 17 Pro / iOS 26.5 模拟器完成常规原生验收：3 项通过，运行审计项按配置跳过。首次教学点击和进程恢复通过；报告为 `artifacts/ios-native-1792304821919.xcresult`。
- c834c5d 的云端首次教学点击仍失败，其余两个原生用例通过；不能用本机成功覆盖此失败。保留 `artifacts/ios-c834c5d-run/` 和首次点击视频帧。新输入诊断和牌桌异步准备等待需在下一轮云端复验。
- 36c5ebb 的云端诊断确认：首次 `pointerdown` / `touchstart` 到达正确的 `learn-start`，当时 `inert=false`、页面已完成且有焦点，但没有收到 `pointerup` / `touchend` / `click`，也没有脚本错误。原始记录为 `artifacts/ios-36c5ebb-all-attachments/1827A64A-168A-41D7-8548-9A51D94ED2E0.txt`。这不能用等待时间不足解释。现调整原生滚动容器的触摸延迟，并追加取消事件诊断，保留第一次点击断言。该轮另一次重启在失败时仍停留于原生启动图；启动顺序调整为挂载界面、收起原生遮罩、等待牌桌准备、开放输入，避免渲染准备与遮罩可见性互相等待。修改后的云端结果待验证。
- iOS 26.5 原生运行审计已通过：显式等待真实原生后台状态、恢复同一手牌、音频开启/静音/后台暂停/手动恢复，并完成真实 DeepSeek 解读。完整动效连续 67.3 秒、5 手牌，帧间隔中位 17 ms、P95 22 ms、P99 28 ms、最大 61 ms，超过 50 ms 的样本 3 个；实际 renderer 为 Apple GPU。证据为 `artifacts/ios-audit-1792305846978.xcresult` 及 `artifacts/ios-runtime-attachments/EEABC86B-8334-4ADE-BFD1-3B041C9B07CF.json`。早一轮因只断言 JS 隐藏事件而失败的记录保留在 `artifacts/ios-native-runtime-first-attempt.json`；不能用模拟器结果宣称手机全程 60 FPS。
- 1 核 / 2 GB Android API 36 模拟器完成音频与生命周期检查，但持续动画中位帧间隔 33.3 ms、P95 83.4 ms，未达目标。实际 WebGL renderer 包含 SwiftShader 软件驱动；详见 `artifacts/android-native-runtime-controls.json`。该轮还与 13.7 秒浏览器测试有时间重叠，三个对照只作探索记录。
- 临时 4 核 / 4 GB、`-gpu host -feature -Vulkan` 模拟器复测完成，未改原 AVD 配置。实际 renderer 为 Apple M1 Pro；完整动效完成 7 手牌，帧间隔中位 16.7 ms、P95 16.8 ms，动效样本 P95 16.8 ms。空闲牌桌、去纹理和最小页面对照均约 16.7 ms，不据此牺牲背景材质。报告为 `artifacts/android-native-runtime-1792305370413.json`；这是该配置中的 WebView 帧回调测量，不代表手机或 GPU 呈现保证。

## 真实 AI 的原生联调

只有显式设置 `WENDAO_LIVE_AI=1` 的验收构建才使用本机网关 `http://127.0.0.1:8787/api/coach`；常规测试不联系收费模型。Android 需配置模拟器到本机端口转发；iOS 网络策略和 WebView 混合内容限制须以实际请求验证。网关按平台 Origin 精确配置白名单。不要把服务商密钥放入 `VITE_` 变量或客户端。

Android 原生页面已完成真实 DeepSeek 解读，网关健康检查 HTTP 200、Origin 为 `https://localhost`，报告为 `artifacts/android-native-runtime-1792305645015.json`。首次本机请求失败保留在 `artifacts/android-deepseek-first-attempt.json`；新增 debug source set 的网络安全配置，仅允许 localhost / 127.0.0.1 明文访问，其他目标仍要求 HTTPS，release 不包含此调试配置。未放开 WebView 的混合内容设置。

这轮 65 秒动画的 P95 仍为 16.8 ms，但最大间隔为 1333.4 ms、超过 50 ms 的样本有 5 个，不能描述为全程无卡顿。与无明显长停顿的一轮一起保留，后续需结合系统与长时测量定位；均不能外推到手机。

本机 Web、iOS / Android 模拟器及 macOS 原生验收客户端均已取得 DeepSeek 真实回复，详见 [AI 接入说明](AI.md)。macOS 的原生开启/静音和最小化后暂停音频、恢复同一手牌已有 CUA 观察，见 `artifacts/macos-native-runtime-observation.json`；此文件明确记录人工观察范围，尚未把初始混跑采样作为持续性能通过。桌面持续运行验收仍在推进；本机 loopback 联调也不能替代正式 HTTPS 服务部署。

macOS 随后的独立连续验收已完成：65.2 秒、6 手牌、3912 个帧间隔样本，P95 18 ms、P99 20 ms、最大 29 ms，没有超过 50 ms 的样本；实际 renderer 为 Apple GPU、精美画质、完整动效。真实 AudioContext 在结束后为 suspended；启动连续验收前也观察到音频上下文尚未创建。数据来自原生窗口固定后的 `MEASURE` 显示，人工抄录于 `artifacts/macos-native-continuous-runtime.json`，不是浏览器替代。该次没有同时运行构建或浏览器回归；采样期间有小量文档写入与短时 xcresult 附件导出，已记录范围。App 主进程 RSS 单点为 101664 KiB，不包含 WebKit 子进程，不能据此判定没有泄漏。

启动顺序和原生触摸调整后，全新 iOS 26.5 模拟器常规回归 3 项通过、审计项按配置跳过，报告为 `artifacts/ios-native-1792307594180.xcresult`。云端首次触摸仍待对应新提交验证。Windows 已补充独立验收构建及实际 WebView2 音频、最小化恢复、连续牌局和内存采样流程，尚未在 Windows 执行，不能当作通过结果。

Web 生产验收构建也已在实际内置 Chromium 浏览器的 390×844、DPR 2 页面完成连续采样：65.6 秒、7 手牌、7877 个回调样本，P95 9.1 ms、最大 16.7 ms，真实音频在结束后为 suspended。数据由页面固定报告直接保存至 `artifacts/web-mobile-continuous-runtime.json`，截图为 `artifacts/web-mobile-continuous-runtime.jpg`。此环境的回调频率高于 60 Hz，不能把该数值当作游戏 GPU 呈现帧率或手机性能；实际 renderer 为 ANGLE Metal / Apple M1 Pro。构建命令为 `npm run build:web-audit`，独立输出 `artifacts/web-audit/`，不读取本机模型配置；临时验收页关闭后已恢复浏览器尺寸，正常游戏仍位于 5173。

040edb5 的 Windows 正式安装版功能检查通过，但新增验收构建因 cmd.exe 去掉内联 JSON 引号而失败，音频/持续采样没有执行。日志保留在 `artifacts/native-runtime-windows-job.log`。现改成生成单独配置文件传给 Tauri，修复后的 Windows 运行结果待 CI 确认；不能用 macOS 上的成功代替 Windows。

040edb5 云端整轮仍失败：iOS 首次冷启动的教学入口等待可操作超时，另外两项原生功能测试通过。失败视频在 78 秒时能看到完整主界面，但不能仅据此判断是触摸、辅助功能还是异步启动准备的问题；尚未确认根因。报告保存在 `artifacts/ios-040edb5-run/`，截图为 `artifacts/ios-040-startup-78.png`。保留此失败，不将本机成功等同于云端首次进入已修复。

4dbdf67 的 Windows CI 已实际通过配置文件修正后的验收构建和运行：正式安装版功能检查通过，独立 WebView2 验收版完成真实 AudioContext 的运行/暂停、最小化后手牌和钱包保持、显式继续，以及 65.3 秒 / 6 手牌连续采样。4179 个回调样本的 P95 15.7 ms、最大 15.8 ms、超过 50 ms 为 0；窗口 460×920、精美画质、完整动效，renderer 为 Microsoft Basic Render Driver / D3D11。App 主进程工作集 29495296 → 29532160 字节，不含 WebView2 子进程，不能作为无泄漏结论。原始报告为 `artifacts/windows-4dbdf67-run/artifacts/windows-runtime/runtime.json`，实际窗口截图为同目录 `continuous-runtime.png`，任务日志为 `artifacts/windows-4dbdf67-job.log`。这是 Windows CI 的功能和回调证据，不是用户电脑的运行证明。

iOS 启动配置原先同时声明 Main Storyboard 和代码创建窗口，现统一由 SceneDelegate 创建一个 PracticeBridgeViewController。依据 [Apple 场景生命周期说明](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle) 清除遗留 Storyboard 入口；重复创建的风险已移除，但尚不能认定它就是此前云端失败的根因。新全新模拟器的首次教学点击、图鉴打开和进度恢复、牌局重启恢复及试炼本机 3 项通过，报告为 `artifacts/ios-native-1792310104036.xcresult`。随后根据实际截图发现教学框进入状态栏区域，已修正上下安全区并增加至少 44 点关闭触控区域；新完整本机 3 项通过，报告为 `artifacts/ios-native-1792310415021.xcresult`。另用专门的教学用例验证整行五张牌至少 54 点高且位于固定操作上方、关闭按钮在状态栏下方，通过结果与截图保存在 `artifacts/ios-guide-visible.xcresult` 和 `artifacts/ios-guide-visible-attachments/`。不能只根据 accessibility 的裁剪后 frame 认定整行卡牌可见。启动异常现在会释放渲染器并提供重试；启动与教学浏览器 28 项通过，含真实重试。诊断构建记录启动阶段、inert 和错误，入口尚未可操作的失败也会先保存诊断，再保留原失败断言。

a001301 的五平台 CI 全部通过，当前 Windows 安装版增加图鉴检查后共 15 项通过；独立原生运行 65.7 秒 / 7 手牌 / 4201 回调样本，P95 15.7 ms、最大 31.2 ms、超过 50 ms 为 0，软件图形驱动环境不变。报告为 `artifacts/windows-a001301-run/artifacts/windows-runtime/runtime.json`。iOS 当前源码的原生音频、后台恢复和 67.2 秒 / 5 手牌运行通过，P95 22 ms、最大 88 ms；同一 App 随后在 Simulator 中通过 CUA 真实触摸启动内置连续牌局，66.1 秒 / 6 手牌 / 3946 样本，P95 18 ms、最大 66 ms，保留一次超过 50 ms 的间隔。对照过程中没有本机构建或浏览器回归，有少量远程 CI 轮询；不能把差别全部归因于原生控件查询，也不能当作 GPU 或手机性能优化结论。前者为 `artifacts/ios-audit-1792311248544.xcresult`，后者显示的固定报告人工抄录于 `artifacts/a001301-ios-continuous-cua.json`，实际截图为同名 JPG。运行结束后已恢复普通资源，同提交普通包的密钥与验收代码扫描通过。
