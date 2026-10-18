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
