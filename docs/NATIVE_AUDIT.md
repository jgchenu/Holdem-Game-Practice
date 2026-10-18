# 原生运行验收

用户本轮接受 iOS / Android 模拟器。以下采样不能证明真机性能、GPU 实际呈现帧率或扬声器可听效果；60 FPS 仍是目标。

## 可重复执行

先准备项目专用模拟器，再运行：

```sh
npm run audit:android
IOS_TEST_DEVICE=<模拟器 UUID> npm run audit:ios
```

两个命令使用单独的验收构建，开启精美画质与完整动效，通过原生触摸事件开启真实 Web Audio。检查首次触摸前未创建音频上下文、开启/静音、切后台暂停、恢复后手牌不变，并连续运行至少 65 秒的真实牌局。测试通过只表示这些检查完成，帧时间是否达标应另看报告。

Android 新增 15 轮原生长测命令：`node scripts/android-runtime-soak.mjs`，要求仅连接一台已确认的测试模拟器。每轮由实际 touchscreen down/up 点击内置连续验收，检查 isTrusted、正常规则牌局、真实音频、新增音符和结束暂停；按包名、宿主 UID、相同 SandboxedProcessService 绑定识别独立 renderer，再逐 PID 读取实际 PSS / RSS，前后核对进程集合。不会把共享 WebView provider / zygote 当作本应用独占。此范围依据 [Android WebView 多进程内存说明](https://developer.android.com/topic/performance/memory/guide/webview-memory) 和 [dumpsys 字段说明](https://developer.android.com/tools/dumpsys)。PSS 按比例分摊共享页面，RSS 跨进程合计可能重复；不代表手机或 GPU 内存保证，不据有限采样宣称没有泄漏。

该命令禁用真实模型与图形对照，不读取模型回复来推动牌局。系统内存查询在本轮报告固定后执行，下一轮开始前停顿两秒；测量没有主动请求堆转储或 GC，但 dumpsys 属于带开销的系统诊断。每轮日志只发带运行 UUID 的进度摘要，完整报告用小于 Android 日志行上限的 Base64 字节片段导出并严格检查完整性，避免长报告或中文被截断。`artifacts/android-extended-soak/observer.json` 中的进度不能代替原生最终报告和断言；只有 15 轮及完整进程采样全部完成才会标通过。中断保留已观察轮次。报告重组单元检查 29 项、原生 Java 编译通过；新的 15 轮实跑尚待完成，不将已实现的流程当成通过结果。

验收过程会修改该模拟器中的偏好及练习进度。Android 只接受已确认的模拟器；不要在手机真机上执行这些测试。iOS 应显式选择测试专用设备。平台构建串行执行，采样期间也不要同时运行其他平台构建或浏览器测试。

- Android 报告：`artifacts/android-native-runtime-<时间>.json`，来自 Gradle 保留的原生测试日志；测试结束卸载 App 后仍可导出。
- iOS 报告：`artifacts/ios-audit-<时间>.xcresult` 中的 `ios-native-runtime-audit` 附件。
- 验收 APK：`artifacts/packages/wendao-android-audit.apk`，不覆盖普通调试包。
- iOS 验收 App：`artifacts/ios-audit/Build/Products/Debug-iphonesimulator/App.app`。
- `npm run build:desktop-audit` 使用单独的桌面标识和存档目录；桌面运行结果需另外实测。

桌面验收面板还提供「连续牌局验收」：由一次真实原生点击开启真实音频，再通过正常操作控件连续运行至少 65 秒，结束后暂停牌局、静音并固定本轮报告。只观察浏览器资源、渲染回调与正常规则结果，不代替规则引擎。验收期间不要运行其他构建或浏览器回归；「停止验收」或进入后台会将本轮标为未完成。简短 `MEASURE` 与完整 `AUDIT` 均来自同一实际采样，不是示意数据。

普通构建不包含采样面板，也不会强制修改玩家偏好。常规 `test:ios` 额外保留首次触摸诊断：教学第一次点击必须打开，不重试、不跳过首次进程；失败后才打开诊断面板并附上触摸目标、坐标、弹窗状态和页面错误。

## 指标含义

`completedHands` 的当前实现统计每个窗口中看见的不同“完成态”手牌编号，并非完成事件的全局去重计数。如果窗口从上一手完成态开始，边界可能重复计入。因此历史“轮数 / 手牌数”保留原字段，手牌数应读作完成态观测计数，不用于宣称跨窗口精确完成的总局数。实际规则运行、帧间隔和内存仍以各自原始记录为准。

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

4f9ea23 云端 iOS 仍失败，这次在首次点击前的截图诊断请求超时，并未验证到入口手势；另外两个功能用例通过。日志 `artifacts/ios-4f9ea23-job.log`、原始报告 `artifacts/ios-4f9ea23-run/` 已下载保留。现将启动辅助诊断改成仅记录 BOOTSTATE 和输入事件文字，保留原生窗口/真实就绪/第一次点击断言，实际图鉴截图仍在成功交互后获取。修改后全新本机 iOS 三项通过，报告 `artifacts/ios-native-1792318138357.xcresult`；下一次云端结果仍待确认，不把诊断超时等同于产品点击失败，也不宣称手势修正已通过云端。

Android 新增流程首轮在真实 Android 正则运行时抛出 PatternSyntaxException，发生在进入牌局之前，0 轮完成；失败保留于 `artifacts/android-extended-soak-first-attempt/`。已补齐正则中结束花括号的转义，重新执行原生运行检查后才能认定解析器和 15 轮长测通过。Java 编译成功不能代替 Android 实际运行成功。

修正后的 Android **60e0085 原生实跑已完整通过**：15 轮、101 手牌、982,440 ms 实际采样、58,909 回调样本；各轮 P95 16.7–16.8 ms，总最大间隔 50.1 ms，超过 50 ms 共 1 个。API 36 / 4 核 / 4 GB 临时启动参数，viewport 411×866 / DPR 2.625，实际 renderer 为 Android Emulator OpenGL ES Translator (Apple M1 Pro)，精美画质与完整动效。每轮均采到绑定的 App + WebView renderer 两进程，PSS 基线 262,007,808、末轮 298,432,512 字节，逐轮范围 287,997,952–298,911,744 字节；不是无增长或无泄漏结论。边界解析检查、实际音频开启/静音/后台恢复、新音符与结束暂停、全部正常规则循环通过；超过单行大小的最终报告经分片完整重组成功。原始数据 `artifacts/android-extended-soak/{report,summary,observer}.json`，原生导出 `artifacts/android-native-runtime-1792319464690.json`。此前 0 轮失败继续保留。

该轮没有并行本机构建、浏览器测试、iOS 模拟器、归档解压或其他自动帧测试；有静态代码草拟、Git/远程 CI 元数据查询和一次本应用检查点读取。既有桌面验收 App 持续保留，普通系统负载未排除。测试结束已关闭模拟器；不外推手机、实际 GPU 呈现或物理触控延迟。

macOS 新增 `node scripts/prepare-macos-soak.mjs`：构建独立的「问道牌途长测」与 `com.wendao.poker.soak.desktop`，使用 `artifacts/macos-soak-target/` 独立 Cargo 输出和独立存档，构建前后核对既有验收 App 二进制。此命令只准备 App 和诊断工具，不代表长测通过。采样工具按同一用户的两个内核 coalition 标识识别 App 和 WebKit / 其他助手，使用 `footprint` 的字节字段与 OS RSS，并核对采样前后成员；要求包含实际 WebContent、无系统采集错误和权限警告。诊断 ABI 来自 [Apple OSS proc_info_private.h](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h)，仅供本机测试，未链接到游戏。当前宿主的只读查询已验证既有 App / GPU / Network / WebContent 同属一组、无关 WebKit 属另一组，四进程 footprint 查询无错误；新的独立客户端和 15 轮运行仍待实际验证。相关单元共 30 项通过，不能把工具实现或一次归属查询写成持续性能验收。

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

### 启动交接与诊断完整性（2026-10-18 后续）

60e0085 的 [39118950023](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39118950023) 已全部结束：Web、Android、macOS、Windows 成功，iOS 首次入口就绪失败，另两项功能通过。失败发生在首次教学点击之前，原生附件 BOOTSTATE 为 launch-screen / inert=true / errors=[]；旧诊断每 500 ms 重建相同文本，不能仅凭这一条 AX 快照认定页面一直停在该阶段。原始证据保留在 `artifacts/ios-60e0085-attachments/`。

诊断现在按实际状态变化更新文本，并记录启动子阶段与有限长度时序，不再轮询替换相同文本。验收报告的音频事件改成独立快照，防止过去的内存对象随着未来事件变化。两个真实浏览器回归先失败后通过，分别记录于 `artifacts/diagnostic-integrity-before.log`、`artifacts/diagnostic-integrity-after-ready.log`；已导出的旧原生 JSON 不会因此改写。这些修正不等于云端启动根因已确认。

Windows 同一 60e0085 原生长测已完整通过：15 轮、96 手牌、982,117 ms 实际采样、62,831 个回调样本；各轮 P95 15.7 ms、最大间隔 31.3 ms、超过 50 ms 为 0。每轮实际采到 App 与测试配置目录所属 WebView2 共 8 进程。私有字节基线 385,884,160、末轮 467,468,288；工作集合计 585,445,376 → 416,432,128 字节，不能据此宣称无增长或无泄漏。实际 renderer 是 Microsoft Basic Render Driver / D3D11，窗口 460×920，精美画质与完整动效；不是手机、GPU 呈现或用户电脑验证。真实回环 HTTP 的 204 / 200 / 502 / 504、连接取消与本地回退通过，仍是明确标识的兼容上游替身。完整报告和截图在 `artifacts/windows-60e0085-run/artifacts/windows-runtime/`，普通安装版检查独立存于同级 `windows-native/`。

iOS 启动交接进一步改为等待原生 UIKit 确认 WebView 已附着窗口且自身及祖先均恢复交互，保留原有淡出，不强制开启交互，也不重试首次教学点击。依据当前安装的 Capacitor SplashScreen 8.0.2 实现：hide 的 Promise 在安排淡出后就返回，实际 tearDown 才恢复 parentView 交互。新增的桥接只在 iOS 调用，Android 保持原流程。启动交接异常会释放真实 Phaser 场景、音频及页面全局监听器，显示重试并保留教学进度；相应浏览器注入故障先失败后通过，此注入不冒充 iOS 实跑。

8657893 客户端本机浏览器共 96 项通过、4 项按平台主动跳过，规则/服务/采集边界单元 30 项通过，生产离线 6 项通过。全新命名 iPhone 17 Pro / iOS 26.5 模拟器原生功能 3 项通过、运行审计项按配置跳过，包含首次教学与图鉴、进程恢复和试炼；实际截图已检查五张牌、安全区和固定继续按钮。结果 `artifacts/ios-native-1792322876981.xcresult`、`artifacts/ios-native-handover-attachments/` 与 `artifacts/ios-native-handover-regression-fixed.log`。新增 Swift 桥接首次编译因方法数组推断为 Optional 数组而失败，显式声明类型后编译与执行通过，失败日志仍保留。上述功能通过不代表云端首次启动或启动耗时已达标；[39123410434](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39123410434) 正在复验。

Android 同轮 SwiftShader 软件渲染模拟器普通回归两次在首次教学后关闭失败，保留 `artifacts/android-handover-first-attempt/` 与 `artifacts/android-handover-diagnostic-attempt/`。诊断显示 down / up 均命中 close-button，处理间隔约 537.5 ms，没有 click，弹窗仍开，页面 inert=false；不能把这个间隔说成手机触控延迟或实际手指按住时长。普通功能测试原先使用同步 sendPointerSync，现在与已有长测一致，使用 [UiAutomation 异步原生事件注入](https://developer.android.com/reference/android/app/UiAutomation#injectInputEvent(android.view.InputEvent,%20boolean))，让事件排队独立于 WebView 对 down 的处理；仍发送真实 touchscreen down/up，不使用 DOM click 替代这些触摸，不重试首次点击。保留输入序列和目标诊断，完整回归结果须另行记录，当前不能把单次关闭成功当作全套通过。

该 Android 修正后完整回归已通过：教学入口、关闭、入席、加注均观察到真实可信 click；牌局、图鉴、课程和试炼恢复通过，宿主脚本强制停止后从 PID 7743 切换到 7840，恢复同一手牌与进度。日志为 `artifacts/android-handover-touch-async.log`，原始仪器结果保存在 `artifacts/android-handover-touch-passed/native-results/`。Gradle 的“Finished 7 tests”包含跳过和宿主分阶段统计，不把它说成七项原生功能通过。两次失败原样保留。此次软件 renderer 与先前长测的宿主 OpenGL 不同，没有重做或改写先前的 15 轮性能数据。

### 8657893 云端结果与后续修正

[39123410434](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39123410434) 已结束，**整体失败**：iOS、Android、macOS 成功，Web 与 Windows 失败。iOS 首次教学、图鉴、恢复和试炼通过，并已重新生成不含启动诊断的普通模拟器包。该次成功支持当前原生交接修正，但不证明所有启动环境或长期稳定性都已覆盖。

Web 共 95 项通过、4 项跳过、1 项失败：小屏恢复后的同位置触摸投入了额外灵石。云端 trace 的两次 tap 调用相隔约 600 ms，超过原有 300 ms 保护；这不能说成 300 ms 内的手机触摸失败。已用“等待跟注按钮真正启用后再点原坐标”的本机用例稳定复现失败。继续按钮现移到状态行，原下注区域在暂停时保留锁定提示和高度，恢复后原坐标不会变成下注。相关四种浏览器配置共 8 项通过，完整回归待最终结果。原失败在 `artifacts/web-8657893-run/`、`artifacts/resume-layout-before.log`，修正截图为 `artifacts/resume-safe-position-paused-*.png` 与 `resume-safe-position-active-*.png`。

Windows 普通安装版及兼容 HTTP 检查通过，长测只完成 12 轮 / 70 手牌，随后第 13 轮的 PowerShell Get-Process 内存计数查询超过 20 秒，整项失败；不能用旧 15 轮结果覆盖。前 12 轮每轮进程组均完整。证据在 `artifacts/windows-8657893-run/` 与 `artifacts/8657893-ci-failed-steps.log`。后续采集只对 ETIMEDOUT 做一次完整新快照，重新检查进程归属，不复用旧 PID 组；失败阶段、耗时与错误保留在最终报告，连续超时仍失败。任何归属进程缺少真实计数现在立即失败，不能接受缩小后的组。原生帧报告先逐轮落盘，避免随后的系统查询失败导致该轮帧数据丢失。32 项本机单元检查通过，其中重试用例是查询替身，**不是 Windows 运行证明**；新 Windows 实跑仍待执行。

macOS 独立客户端由干净 5de5d11 构建，既有用户验收 App 二进制保持不变。已通过 CUA 读取原生冻结 MEASURE 摘要并配对系统采集完成 10 轮；第 11 轮因 Mac 锁屏中断，未计入通过，`report.json` 保持 passed=false，并记录 interruption。每轮实际采到 8 个内核归属进程，除 App 与 WebKit 外还包括 Metal 编译、主题和音频助手。完整 MEASURE 可访问性摘要已保存；长 AUDIT 标签被 AX 截断，不能称为完整原始 AUDIT 导出。记录在 `artifacts/macos-extended-soak/{build,report,memory-baseline}.json` 和逐轮 footprint JSON，仍待解锁后继续验证。前 10 轮没有本机构建、浏览器回归或其他自动性能运行；有短时远程 CI 日志查询和每轮结束后的本地记录/系统采集，用户原有验收 App 仍运行。锁屏后恢复独立功能工作，第 11 轮不能据此用于性能结论。

继续按钮布局修正后的最终本机浏览器回归 **100 项通过、4 项按平台跳过**，含 Chromium 手机 / 320×568 小屏 / 桌面与移动 WebKit。新增测试等到跟注控制真正启用后，再触摸继续按钮旧坐标，钱包与手牌不变、不会打开其他对话框，随后仍能正常跟注。320×568 暂停和恢复实际截图已查看，继续按钮触控高度至少 44。生产构建、服务端类型检查、正式离线 6 项和单元 32 项通过，日志为 `artifacts/resume-and-memory-{browser,build,server,offline,unit}.log`。最新原生客户端与 Windows 采集仍需对应新提交执行，不能用此前 8657893 的成功平台替代。


### 触屏悬停候选与独立冷启动套件

触屏原先会应用鼠标悬停滤镜；新增浏览器输入检查先在三种触屏配置失败、桌面通过，限制到 `(hover: hover) and (pointer: fine)` 后通过。保留标准 click、按下位移、桌面高亮、原生滚动和取消策略；没有改为 pointerdown 打开、强制开启交互或重试首击。dfc5f92 的原生失败输入附于 `artifacts/ios-dfc5f92-attachments/6AD79DCF-B78B-4C85-A087-477F0BC7779A.txt`：ready / inert=false、正确目标 down 后约 115 ms cancel，无 click；这说明触摸被取消，不能据此认定滤镜就是唯一根因。

新增只读 UIKit 外层 pan 观察和带可信标志、事件时间戳、移动坐标、输入能力及实际 CSS 的启动诊断。原生观察只在 `STARTUP_TRACE` 测试编译条件下存在，不新增手势识别器、不修改其 delegate、不关闭滚动或触摸取消。事件写到测试 App 自身缓存中的独立记录文件，文件 IO 位于后台队列；导出仅保留本次 xcodebuild 开始之后的数据。普通构建没有这段原生记录器。最初的变量作用域接线错误与系统日志扫描超时均保留，未把它们算成功证据；缓存导出后来实际成功。`artifacts/ios-native-input-1792327865197.json` 验证了原缓存 12 条只保留本轮 6 条，排除旧 6 条；不能把“成功生成一个 JSON 文件”本身当作记录有效。

`npm run test:ios:cold` 每组新建一个独立 iPhone 模拟器，完整执行首次教学、图鉴滚动、恢复和试炼，任何一组失败即停止；这不是失败后换设备重试。每组必须有真实 xcresult、至少三项功能通过和本轮原生观察标记。只关闭/删除本次创建的 UUID，保留 xcresult、输入记录与汇总；不清理用户原有设备。CI 改为运行三组并在失败时上传同样的证据。只读原生 pan 没有记录，不足以识别其他识别器或断言根因。

本机工作树的三组独立套件全部通过，汇总为 `artifacts/ios-cold-entry.json`，每组 3 项通过 / 1 项按配置跳过，总计 9 项通过 / 3 项跳过，三个生成的设备均已清理。它不代表云端首次点击已解决，也不是手机性能测量。当前输入/教学/启动浏览器 36 项、输入/诊断 12 项、玩法 30 项（2 项按平台跳过）、单元 32 项与服务端类型检查通过。Android 原生与宿主强制停止恢复通过（4745 → 4851）；普通 iOS 模拟器及未签名设备构建通过。普通资源与 4 个原生 Mach-O 中的测试记录器标记检查在 `artifacts/hover-ordinary-build-scan.json`，138 个普通资源未发现凭据或 JS 验收标记，测试记录器未编译入普通二进制。日志导出只观察自身测试 App，不能作为手机 GPU 或用户 Mac 已解锁的证明。

另已收齐 dfc5f92 Windows 原生终态：15 窗口、981,554 ms、62,796 个回调样本，各轮 P95 15.7 ms，最大 31.3 ms，超过 50 ms 为 0；完成态观测计数为 94，跨窗口可能包含边界重复。每轮 8 个归属进程均有真实正计数，私有字节 380,985,344 → 471,760,896，工作集 586,326,016 → 415,121,408 字节。本次没有发生重采，不能称为真实超时恢复路径已实跑；该路径目前由查询替身单元覆盖。来源 `artifacts/windows-dfc5f92-run/artifacts/windows-runtime/{result,soak}.json`，普通安装版检查也通过，原生 HTTP 上游仍为明确标识的替身。该轮 CI 总体仍因 iOS 首次触摸失败而失败。

### 0912720 云端：功能通过，iOS 证据导出超时

[39130694495](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39130694495) 的 iOS 第一台独立模拟器实际通过 3 项功能、主动跳过 1 项：首次教学、图鉴滚动、进度恢复与试炼没有测试失败。冷启动门禁仍失败，原因是测试后的 `simctl get_app_container` 超过采集脚本的 5 秒期限，未取得本轮原生观察器记录。失败记录：`artifacts/ios-0912720-run/ios-cold-entry.json`、`ios-native-input-1792329961127.json`，XCTest 原始包在同目录。后两套没有执行，不能将这一台功能通过描述成三套冷启动通过。

云端 checkout 是 PR 合并提交 `74d06f91bbb805420ec64d0aa6db11aaafa214de`；GitHub API 返回的 tree 为 `50d87de56bb808a5bbd96ceb0997b4a304d410b0`，与本机 `0912720^{tree}` 相同。报告保留实际 checkout SHA，不将其误报为本机提交 SHA。

证据采集现独立为 `scripts/ios-native-input.mjs`：查询期限 30 秒，仅在该只读查询返回 `ETIMEDOUT` 时允许再查询一次同设备、同 App 的路径；每次状态、耗时与错误都保留。连续超时、非超时错误、缺少文件或缺少本轮观察器标记仍使门禁失败，不沿用旧记录。不会重启 App、重试首次教学点击或重跑失败套件。新增 3 项查询替身回归，单元总计 35 项通过；这不等于云端已实际触发并通过新的重采路径。冷启动脚本也会在日志中直接输出失败原因，完整报告照常保存。

本轮 Web 云端为 104 项通过、4 项按平台跳过，离线 6 项、单元 32 项通过（云端源码尚不包含新增采集单元）。候选 `artifacts/packages/candidate-0912720/` 保持 releaseReady=false；Web / Android / iOS 两类 App 的 17 个页面与资源文件逐字节一致。ZIP、APK 签名、iOS 可执行权限与 DMG 校验和通过；DMG 只读挂载后的文件字节扫描未发现凭据或诊断标记并已卸载，未解码嵌入/压缩资源，不代替原生窗口验证。

采集改动后的本机原生回归：`artifacts/ios-collector-native.log` 中 3 项功能通过、1 项主动跳过；`artifacts/ios-native-input-1792330348372.json` 实际查询耗时 317 ms，一次成功，取得本轮 6 条记录并排除 12 条旧记录。原生查询本轮没有触发超时重采；不能用替身回归代称真实重采已测。随后普通模拟器构建通过（`artifacts/ios-collector-ordinary-build.log`），仅关闭本轮使用的自建 Hover Gate 模拟器。

同轮 Windows 最终通过，记录 `artifacts/windows-0912720-run/summary.json` 及 `artifacts/windows-runtime/` 原始 JSON：15 个窗口 / 97 个完成态观测 / 982,850 ms 实际采样 / 62,884 次回调；各轮 P95 15.7 ms，最大 31.3 ms，超过 50 ms 间隔为 0。每轮 8 个进程的系统计数完整；组 Private Bytes 从 378,613,760 增至 464,764,928，Working Set 从 582,520,832 变为 408,784,896。不据此判断无泄漏。本轮没有任何重采样本。采用 Microsoft Basic Render Driver / D3D11 软件环境，数据不代表 GPU 呈现或手机性能。普通安装版原生检查及真实 HTTP 兼容替身检查通过，未将替身称为实际 DeepSeek。普通 NSIS 已补入 candidate-0912720，七份产物及校验和齐全；iOS 门禁和 Mac 原生剩余项仍使 releaseReady=false。

### e167d9b：CoreSimulator 首次发现超时

[39132629224](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39132629224) 的 iOS 在执行 `simctl list devices available --json` 时超过 30 秒，尚未创建验收设备或启动游戏；不是首次教学用例失败。日志为 `artifacts/ios-e167d9b-job.log`。旧的准备步骤在报告初始化之前，因而没有生成冷启动 JSON。

只读查询处理现在由 `readIosSimulator` 统一负责：仅允许列出可用设备或查询本 App 数据容器；30 秒期限，仅 ETIMEDOUT 可重读一次，两次状态和耗时全部保留。创建、启动、关闭、删除设备与其他 App 查询均不能进入重采路径。冷启动报告在发现设备之前初始化，准备阶段也进入同一失败保存流程。新增清单查询与禁止修改操作的回归后，本机单元 37 项通过；本机实际三套冷启动复验已全部通过，云端仍待新提交验证。

统一查询处理后的三套本机实测：`artifacts/ios-discovery-cold-entry.json`、`artifacts/ios-discovery-three-cold.log`。9 项功能通过、3 项按配置跳过；每套分别取得本轮 6 条原生记录，三台自建设备的关闭与删除均成功。设备发现实际一次读取成功（121 ms），本轮原生读取未发生超时重采；超时恢复的证据仍限于查询替身，不能称为已修复所有云端环境故障。复验后的普通模拟器已重新构建（`artifacts/ios-discovery-ordinary-build.log`），可执行文件及动态库扫描均不含测试记录器（`artifacts/ios-discovery-ordinary-scan.json`）。冷启动报告也保留实际 checkout SHA 与 tree，便于核对 PR 合并提交。

### 43ab4f4：就绪状态的无障碍查询超时

[39133500462](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39133500462) 的 iOS 第一个教学用例在就绪查询阶段失败，尚未点击教学入口；另两项功能通过、1 项按配置跳过。原始 `artifacts/ios-43ab4f4-job.log` 中，对启动 `StaticText` 的读取在测试时刻 59.13 → 117.27 秒与 117.29 → 148.34 秒之间出现长时间阻塞和框架内部查询重试。之后截取的 BOOTSTATE 为 ready、inert=false，页面相对时钟记录 ready 约 44,112 ms；这些不同钟源和事后快照不能单独证明截止时间内的状态，更不能称为手机启动性能通过。

本轮设备发现一次成功（5,491 ms），测试后的原生记录导出一次成功（941 ms），captureSucceeded=true；只读重采未触发。失败并非上两轮的发现/容器查询缺失。PR 合并 checkout `26da1bb0be75accbfbfbed3d50e81653b1fe37c9` 的 tree `9d2526b17e251778b9608bca5ecde9c88912ec7d` 与本机 43ab4f4 相同。原始包、冷启动报告、原生输入记录与测试摘要保存在 `artifacts/ios-43ab4f4-run/` 和 `artifacts/ios-43ab4f4-test-summary.json`。

验收诊断现在默认仅呈现 phase/inert 两个真实字段，完整 history/errors/detail 保留到展开面板；新增 timeOriginMs 以便把页面相对时钟与原生日志对齐。原生就绪等待在同一个远端查询中匹配两个状态字段，省去每轮独立的 exists 与 label 请求，保持相同的 ready 且 inert=false 条件、原 60 秒预算、第一进程与首次点击无重试；窗口尺寸就绪后不再额外查询尚在启动的完整 Web 文本。失败后再采集详细诊断，不将失败重新判为成功。此修改旨在减少测试诊断产生的 AX 开销，尚未证明消除所有云端启动或触摸问题。

短标签回归先在四种浏览器配置失败，再通过；新增锁定状态与完整历史保留检查后，相关浏览器 16 项通过（`artifacts/compact-startup-marker-red.log`、`artifacts/compact-startup-browser.log`）。其中阶段/锁定字段由隔离测试程序变动，用于检验诊断真实性，不代表原生启动或触控实测。三套原生冷启动复验已全部通过：9 项功能通过、3 项按配置跳过，每套取得本轮 6 条记录，关闭与删除三台自建设备均成功（`artifacts/compact-startup-cold-entry.json`、`artifacts/compact-startup-three-cold.log`）。这是本机当前改动的验证，不代替新提交的云端结论。

43ab4f4 同轮 Windows 安装版与原生连续运行通过。`artifacts/windows-43ab4f4-run/summary.json` 及原始 `artifacts/windows-runtime/` 记录 15 个窗口、97 个完成态观测、982,704 ms 采样、62,862 次回调；各轮 P95 15.7 ms，最大 62.6 ms，出现 1 次超过 50 ms 的回调间隔。保留这次间隔，未断言原因或连续零卡顿。15 轮每组 8 进程、计数完整；Private Bytes 388,751,360 → 465,518,592，Working Set 586,735,616 → 409,567,232。没有触发系统查询重采，不判断无泄漏，也不外推 GPU 呈现或手机 FPS。普通 NSIS 已补入 candidate-43ab4f4（6 份产物）；iOS gate 失败使该版本未生成云端普通模拟器包，releaseReady 继续为 false。

紧凑状态标签的实际 iPhone 模拟器截图已检查：`artifacts/compact-startup-native-attachments/1FEA8D87-112D-45E3-9CB5-059D710FDD40.png`。短标签完整可读，教学入口可操作；这是测试构建的诊断浮层，普通包会移除，不将其当作用户产品页面。

### 普通安装包首点门禁与 macOS CI 探针

3e25c0c 的云端运行 [39136170832](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39136170832) 已终止：Web 108 项通过、4 项跳过；Android、macOS 构建和 Windows 验证成功。iOS 前两套各 3 项功能通过、1 项跳过，第三套被作业 30 分钟外层期限中断；不能算三套通过，也未验证第三台清理结果。原始记录在 `artifacts/ios-3e25c0c-run/`，其中 running 是取消前的报告快照，不是仍在运行。

新增普通 iOS 构建的独立首点用例：全新模拟器、无诊断浮层、首次真实点击打开教学；通过后直接归档该设备实际安装的 App.app，再清理设备。原有三套诊断测试保留，首次点击不重试、单次就绪预算仍为 60 秒。外层 CI 调整为 60 分钟以容纳四台独立设备和打包，未放宽功能断言。本机普通用例 1 项通过、0 项跳过（`artifacts/ios-installed-ordinary-local.json`），归档 SHA-256 为 `9d3fff25002a752c38e569f0ab697f103e9493036c2b53c255e24d8e4ea08199`；原有三套复验 9 项通过、3 项跳过，设备均清理成功（`artifacts/ios-ordinary-preserved-three-cold.json`）。普通教学截图已实际检查。旧候选通用构建 ZIP 与实际安装包有 4 个文件不同，不能追认为同一实测包；新流程直接归档已安装 App 消除该归属缺口。

新增独立 macOS XCTest 工程，CI 中仅启动普通 App 的专用副本，检查首次教学点击及真实发牌；启动前核对副本全部文件与链接，结束只关闭该副本。本机只允许 build-only，已编译通过并验证本地运行保护；尚未在 CI 执行，不计为原生功能通过或 15 轮长测。外部 App URL 初始化依据 [Apple XCUIApplication 文档](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication)。不修改系统安全或辅助功能权限。

用户已确认解锁 Mac，原独立长测窗口观察为暂停状态。此前 10 轮保留为中断结果，完整新一轮尚待执行；解锁不改变旧报告的未通过状态。

### ba83680 macOS CI 探针首次结果

`artifacts/macos-ba83680-job.log` 的原生层级确认普通教学入口已存在，显示文字位于 macOS WebKit 的 Button.title（「从零学德州 →」），没有对应 label。初版探针只按 label 匹配，等待 60 秒后失败，未点击入口，不能算普通教学通过。现改为在同一按钮查询中接受 title 或 label；保持启用且可点击、首次真实点击与打开教学断言，不增加点击或启动重试。修改后的运行仍待验证。

### Mac 截图像素门禁与专用 XCTest 长测驱动

13cf180 云端普通客户端首次教学、关闭教学和发牌状态测试 1 项通过，实际 checkout 的 tree 与该提交一致。截图 `artifacts/macos-13cf180-attachments/6606B0BD-B441-47E2-B87D-B4FF116E14A9.png` 中牌桌画布空白，不能将手牌无障碍文字状态当作视觉通过。本机 ba83680 专用长测构建的 CUA 截图能实际看到桌面、头像与 4♣ / Q♠，13cf180 只改测试查询和文档；不因此推定云端空白的根因或完整渲染验收通过。核对记录为 `artifacts/macos-13cf180-visual-review.json`。

普通 Mac 测试现补充原生截图的手牌区域像素检查，最多只读等待 20 秒，仍只有第一次实际教学点击；不重启、不重试输入。空背景拒绝、浅色卡牌样本通过，旧 CI 截图人工核对边界的牌桌区域读取为 0 个卡牌像素（`artifacts/macos-card-pixels-selfcheck.log`）。本机编译通过，新的完整普通客户端运行尚未验证；像素检查只证明区域非空，不等同完整美术质量或 GPU 帧率。

新增独立 `scripts/macos-runtime-soak.mjs`，复用现有 XCTest 工程及内核进程归属采集器。Node 和 Swift 均核对专用 App 路径/标识；记录并复核 App 二进制、实际游戏输入差异、受保护审计 App 的哈希和 PID。使用随机 runID 的文件确认协议，冻结每轮 MEASURE 后才采样系统内存，采样成功后才允许下一轮；完整 15 轮之后还要检查实际卡牌像素和进程重启恢复。只选长测方法，普通 CI 仍单独选择教学方法。完整 AUDIT 长标签可能截断，未冒称导出了该完整原始数据。

本机单元 38 项通过，含不完整样本、音频未暂停、无新增音频与缺失/无效回调统计的拒绝检查（`artifacts/macos-native-soak-final-unit.log`）；独立驱动 build-only 两次编译通过。实际启动尝试 `2c47bc5f-e105-40cc-b345-c6a899950d25` 在 XCTest 初始化时失败，日志为“认证已取消。System authentication is running.”，随后系统状态实际确认 IOConsoleLocked=true。没有进入测试、没有 baseline 或接受轮次，report.passed=false；受保护 App PID 40880 和二进制哈希前后相同。已请求用户解锁并完成开发工具认证，不自动修改系统安全权限。新驱动运行协议、15 轮采样、最终像素和重启恢复仍待实际验证。

手动工作流新增 `platform=macos` 诊断范围，只启动 Mac 构建和原生测试，便于在本机系统认证未完成时继续核查云端截图；PR/main 仍始终执行原有全部平台，默认手动运行也为全部。当前独立分支的诊断不替代 PR #1 的五平台合并门禁，也不取消正在运行的 iOS 套件。

### 7ca5749 与 f73cb5c：强化像素门禁均复现失败

[39145575343](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39145575343) 和 [39147349513](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39147349513) 均为独立 Mac 专项，其他平台按显式手动范围跳过，不能称为五平台结果。普通首点和手牌状态可操作，但原生手牌区域约 20 秒内持续读取为 0 个浅色卡牌像素，像素断言失败。7ca5749 的延后截图 `artifacts/macos-7ca5749-attachments/EB9ED454-09CD-46BE-96E9-D553596301B6.png` 已实际检查，画布为空；f73cb5c 补充 app.activate() 后仍失败（`artifacts/macos-f73cb5c-job.log`），未将置前视为已修复。

新增只在 audit/dev 中使用的按需帧缓冲诊断：通过现有 Phaser renderer.snapshot 读取真实渲染后的缓冲区，报告像素、CSS/父容器尺寸、场景状态、可见性及上下文；另存 App 和整个原生屏幕截图。诊断读取图明确标注“不是原生屏幕截图”，其非空不自动视为屏幕已呈现。读取仅在点击时执行，连续验收期间禁用；不在真实采样窗口调用 GPU readPixels。普通生产 index.html/assets 的 17 个文件与实测 main13 仍逐字节相同。实际浏览器诊断及既有诊断回归共 16 项通过（含移动 WebKit、320px），手牌和灵石保持不变；日志 `artifacts/macos-renderer-readback-final-browser.log`，字节核对 `artifacts/macos-renderer-readback-final-parity.json`。

原生诊断宏编译通过。实际尝试复用旧 App 被游戏输入差异检查在启动 XCTest 前拒绝，受保护审计 App 的 PID/哈希未变（`artifacts/macos-renderer-readback-source-guard.log`）。CI 仅在普通 Mac 原生检查失败后构建新的独立诊断 App 并收集 `--render-probe`；该收集步骤不把原有失败转为成功。新的配对 Mac 屏幕/帧缓冲结果仍待实际运行。

### 2d45711：诊断文本查询遇到数值属性

[39148626171](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39148626171) 的普通像素门禁仍失败。独立诊断 App 构建成功，但采集在 `DRAWSTATE` 的原生文本查询时抛出 `Can't use in/contains operator with collection 1 (not a collection)`，没有生成 probe.json，不能推定帧缓冲内容。完整归档为 226 MB；已通过 ZIP 范围读取取得 CRC 验证的完整 report.json/run.log（`artifacts/macos-2d45711-text/selected-files.json`），其余完整附件继续单独下载，未冒称全部归档已校验。

查询对异构 StaticText.value 直接执行 CONTAINS，遇到数值 1 会异常。现统一用 CAST(value, 'NSString') 后匹配，并读取 value/label/title 三种文本入口；DRAWSTATE、MEASURE 和完成状态共用同一查询。Foundation 六类实测（数字、空值、缺失、value 文本、label 文本、title 文本）通过，原生宏编译通过；宏内也直接用实际查询工厂执行这六类回归。远端 XCTest 查询及配对数据仍待新一轮验证。

CI 额外上传轻量 `macos-diagnostic-reports`（JSON 与 run.log），完整 xcresult/画面证据仍保留原附件。轻量文件只改善取证速度，不更改普通像素门禁、渲染器或结果判定。

### 146f577：文本查询通过，报告写入被拒绝

[39150673700](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39150673700) 仍为 Mac 专项失败：普通原生卡牌像素门禁未通过。独立诊断本轮已通过六类查询回归，读取并解析 DRAWSTATE、保存前后截图与事实附件；随后写入项目内 probe.json 时系统返回 Code 513 / Operation not permitted。诊断测试失败，不能宣称已完成采集验收。日志还确认 teardown 确实终止独立 App。

报告交换现改至每轮 UUID 对应的 `/private/tmp/wendao-macos-xctest-<UUID>` 私有目录（0700），Swift 严格匹配同一轮路径。宿主仍将 JSON、握手记录归档回原 artifacts 位置，再清理自己创建的临时目录；不会修改系统权限。像素门禁、轮次和内存采样边界不变。38 项单元测试、Node 语法及原生宏 build-only 编译通过（`artifacts/macos-temp-exchange-unit.log`、`artifacts/macos-temp-exchange-build.log`）；临时目录协议仍待云端实际运行。

从本轮 xcresult 的 CRC 验证小文件中导出了实际事实附件 `artifacts/macos-146f577-attachments/8ED5BEDE-4FE7-4C66-919E-FE950BB173C4.json`：Apple GPU / WebGL、frame419、页面 hidden=false/focused=true、场景 active/visible、contextLost=false，840×1000 缓冲区有 124207 个非透明采样点、10331 个手牌浅色采样点。前后原生屏幕仍为空白画布，诊断读取图可见；因此帧缓冲非空不构成呈现通过。旧 2d45711 完整归档中的原生录屏第 7 秒也实际查看为空白，不能将问题仅归因于单张截图时机。

新增 audit/dev 专属的三个可恢复显示对照（隔离层 auto、canvas translateZ(0)、同一 canvas 暂移到 body 并保持位置尺寸），仅用于原生截图定位合成边界；不会替换为读取图或 Canvas renderer。连续验收开始前和卸载时恢复原始 DOM/样式。四种浏览器配置的真实操作检查通过，覆盖 320px、390px、移动 WebKit 和桌面，手牌/灵石不变、canvas 父节点及样式恢复；已查看移动基线和对照截图。普通生产 index/assets 17 文件仍与 main13 逐字节相同（`artifacts/macos-compositor-ordinary-parity.json`），原生宏编译通过；Mac 原生对照截图结果待运行。

### d3ceeeb：测试 Runner 的沙箱写入边界

[39151963130](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39151963130) 已结束，普通像素门禁仍失败，独立诊断在 `/private/tmp` 写入时同样返回 Code513。此前把问题局限于项目目录的判断不成立。实际检查本机生成的 Runner 签名权限，确认 `com.apple.security.app-sandbox=true`，仅有外部文件只读例外。现由 XCTest 使用自身 NSHomeDirectory 下的本轮 UUID 目录；宿主严格指向该 Runner 专属容器，归档后清理，不移除沙箱或扩大权限。该协议的云端执行仍待验证。

CI 将 SDK 导出的原生 PNG、事实 JSON 与 manifest 一并上传轻量附件；录像和完整 xcresult 仍在原归档，避免为查看几张对照截图下载整个录像。

### a36ad0b：Android 14 新手入口与恢复复核

本机临时启动 Pixel_7 / API34 模拟器，普通安装版 Instrumentation 最终 XML 为 1 项通过、3 项专项阶段跳过、0 失败；原生触控记录含从零教学、关闭教学、入席、打开加注，均有 trusted down/up/click。随后两个进程死亡专项各明确报告 OK(1 test)，确认 PID5935 消失、以 PID6041 重启，手牌/灵石、课程、试炼印记、新手教学步骤均恢复。教学图鉴内容和步骤保存检查包含 DOM 操作，不能全部称为原生触控。

原始 XML、logcat、APK 与重启日志已保存至 `artifacts/android-a36ad0b-validation/`；summary.json 记录 APK SHA256。普通前端 index/assets 17 文件与 main13 候选 APK 相同，Android 原生工程及构建/重启脚本也与 main13 无差异。旧 connected 和 process-death 数据已另存；本轮启动的模拟器已关闭。此为模拟器功能证据，不包含本轮持续性能、手机 GPU 帧率或硬件音频验收。

### a36ad0b：报告协议通过，对照截图仍需排除遮挡

[39152684668](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39152684668) 普通原生像素检查仍失败。独立采集 1 test 通过、0 失败，成功写入并归档 probe.json，确认沙箱容器协议可用；轻量附件也已包含原生 PNG 与事实 JSON。缓冲区手牌浅色采样点10430，读取前后原生手牌像素0。

实际检查三种对照及恢复截图，发现图片中验收面板仍覆盖牌桌；原生脚本此前在点击收起后立即截取，没有等待控件真正消失。因此这些对照截图不能证明任何合成方案有效或无效。现统一在收起操作后等待该原生按钮不存在，再截图；浏览器对照也明确检查面板 hidden。此为采集修正，未修改普通渲染器或放宽像素门禁。

### f012149：无遮挡对照仍无牌面

[39153570444](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39153570444) 已结束：普通像素门禁仍失败，独立采集 1 项通过。原生关闭断言通过，四张隔离层／独立层／外置／恢复截图已实际查看，验收面板确实收起，但仍没有牌桌像素。来源 `artifacts/macos-f012149-compact/`，实际环境为 Apple Virtual Machine 1 / macOS26.6.2；场景运行、contextLost=false，缓冲区有10410个手牌浅色采样点。没有把上述 CSS 对照作为产品修复提交到普通渲染路径。

新增按需基础绘图对照：DOM、Canvas2D、默认 WebGL 与保留缓冲区 WebGL 分别绘制相同绿色／白色色块，同时记录各自真实读取值。只有 audit/dev 中点击才创建，移除、开始连续验收或销毁界面时取消自己的循环并释放自己的上下文；不改 Phaser 渲染器。原生脚本在面板关闭后单独截图，结果待云端采集。普通前端17文件仍与 main13 相同；原生宏编译通过。首次浏览器执行被类型修正触发的热重载打断，失败 trace 已保留在 `artifacts/macos-basic-surface-interrupted/`，未算整轮成功；冻结后四种配置通过并实际查看移动 WebKit 与320px截图（`artifacts/macos-basic-surface-frozen-browser.log`）。

基础对照补充清理回归：四种浏览器配置均确认开始连续验收后对照 DOM 已移除，随后显式停止该轮并断言 failed／本轮未完成，不把取消操作称为完成65秒采样。最终日志为 `artifacts/macos-basic-surface-final-browser.log`（4 passed）。
