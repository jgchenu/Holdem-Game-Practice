# 跨平台持续交付与验收

目标：完成移动端优先的《问道牌途》在 iOS、Android、Windows、macOS 和 Web 的开发与验证。美术与动效要求以根目录 AGENTS.md 为准。持续目标仍在进行，未实际执行的验收保持待办，构建通过不等于真机运行或性能通过。

当前矩阵、最近验证及剩余交付条件为现状；后面的历次增量保留旧失败和当时的待办，不能用历史状态替代当前结论。

用户于 2026-10-18 明确选择直接使用 iOS / Android 模拟器验收，并指定 DeepSeek。后续按模拟器推进，不再等待连接真机；下表中的手机真机、签名安装及硬件性能列为额外未验证范围，不冒充已测通过。

## 共同能力

- 独立扑克规则、加密随机洗牌、六人单人练习、七选五比牌、主池与边池、平局分池、未跟注返还。
- 五名只接收本人底牌与公开信息的本地策略对手；当前对手不是求解器或大语言模型。
- 完全新手的十二步第一手带练，支持退出续学；内置九种牌型图鉴，每种有五张示例牌、白话解释和同牌型比较方法；九课三阶段、十八道练习、逐境解锁与学习进度、本手公开行动复盘；三场问心试炼使用真实规则，独立于随机练习桌。
- 手机底部操作、加注确认、减少动态效果、暂停、存档恢复；损坏的结算记录被拒绝，旧版弃牌结算可迁移。
- 师父面板先展示程序事实；兼容接口在服务端持有密钥，模型文本安全呈现，离线或失败时回退本地指引。
- 移动端 Preferences 与桌面原生文件存储桥接、Web 离线缓存与版本隔离更新、主屏幕安装清单、统一图标与启动画面。
- 本地分发 OFL 授权宋体子集；Canvas 绘制前加载，字体或入口模块加载失败可回退或重试。

## 当前平台矩阵

跨窗口手牌数字按采样器的“完成态观测计数”解释，可能包含边界重复，不当作全局去重完成总局数；详见原生验收的指标含义。

| 平台 | 工程与构建 | 实际运行和功能证据 | 仍待验收 |
| --- | --- | --- | --- |
| Web | 13cf180 生产候选已归档 | 云端浏览器 108 项通过、4 项按平台跳过，离线 6 项、单元 37 项通过；历史 15 轮保留原版本范围 | 主屏幕安装、真机硬件与 GPU/触控专项未测；有限采样不证明无泄漏 |
| iOS | 13cf180 普通模拟器与未签名设备包齐备 | 实际安装普通包首点教学 1 项通过；三台独立冷启动共 9 项功能通过、3 项跳过，每套 6 条本轮原生记录；四台设备关闭/删除均成功 | 历史音频/生命周期/15 轮按原版本保留；签名与手机硬件为额外未测范围 |
| Android | 13cf180 API 36 / JDK 21 调试 APK，CI 与签名检查通过 | 17 个页面和资源与 Web、iOS 两种 App 逐字节一致；原生触控/进程恢复、15 轮与真实 DeepSeek 证据均保留各自版本范围 | 当前 APK 未冒称真机验证；硬件、低内存系统回收、GPU 呈现与触控延迟专项未测 |
| macOS | 13cf180 CI App/DMG、Rust 4 项及原生入口检查通过 | 普通首次教学/实际手牌状态 1 项通过；DMG 文件与 CI 原生测试副本相同。本机当前游戏源码可实际绘出桌面与卡牌 | 强化像素检查后，7ca5749 的 CI 画布 20 秒仍为 0 个卡牌像素，保持失败待查。完整新 15 轮待解锁/开发工具认证；旧 10 轮为中断结果。签名公证未做 |
| Windows | 13cf180 普通 NSIS、安装版原生检查与连续运行通过 | 15 个窗口 / 981153 ms / 98 个完成态观测，全部 8 进程计数完整；P95 15.7 ms，最大 31.3 ms，超过 50 ms 间隔为 0，无系统查询重采 | Microsoft Basic Render Driver / D3D11 环境，不外推 GPU 呈现、手机 FPS 或无泄漏；用户电脑和真实 Windows DeepSeek 未测 |

用户已确认有 iPhone、Android 手机、Windows 电脑和 Apple 开发者账号；这些条件尚不等于设备已连接或已验收。iOS 签名实测曾报 `No Accounts` 和缺少描述文件。按用户后续选择，本轮使用模拟器，签名与真机记录保留为额外未验证范围。

## 最近验证

[13cf180 五平台 CI](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39142903013) 全部成功，已按用户授权合并到 main，提交 `8a951c02d8bed61b8eb757718c8bbd269beedd36`；合并 tree 与实测 13cf180 相同。云端 iOS 原始报告为 `artifacts/ios-13cf180-run/{ios-ordinary-entry,ios-cold-entry}.json`，Windows 原始报告与摘要为 `artifacts/windows-13cf180-run/`。

`artifacts/packages/candidate-13cf180/` 有七份产物及 SHA256SUMS：Web、源码、Android APK、实际安装并通过首点测试的 iOS 模拟器 App、未签名 iOS 设备 App、Mac DMG、Windows NSIS。四类普通客户端的 17 个页面/资源相同；ZIP/APK 共 938 个文件做精确凭据值和普通包诊断标记字节扫描，未发现匹配，不能称为解码所有二进制嵌入数据。Mac DMG 只读挂载后 3 个 App 文件与 CI 原生实测副本相同，已卸载；APK 签名、iOS 平台和可执行权限验证通过。Windows EXE 未在本机展开，保留 CI 实际安装验证范围。`releaseReady=false`，代码合并不等于所有验收完成。

Mac 专项的新像素门禁在 7ca5749 复现失败：`artifacts/macos-7ca5749-job.log` 与 `artifacts/macos-7ca5749-attachments/EB9ED454-09CD-46BE-96E9-D553596301B6.png` 确认手牌文字已存在，但原生截图继续读取约 20 秒仍无卡牌像素。显式 App 置前（f73cb5c）的 [Mac 专项](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39147349513) 同样失败。现准备配对原生屏幕与真实帧缓冲诊断，普通游戏渲染器和像素断言保持原样。Mac 专项不代表其他平台重新通过。

原本机 10 轮报告已保留在 `artifacts/macos-interrupted-5de5d11-ten-rounds/`，新版 CUA 尝试没有接受任何轮次。独立 XCTest 15 轮驱动已编译通过、单元 38 项通过；实际启动在系统认证阶段失败，尚未进入测试，`artifacts/macos-xctest-soak/2c47bc5f-e105-40cc-b345-c6a899950d25/report.json` 保持 passed=false。已请求用户解锁并完成开发工具认证；受保护审计 App 的 PID 和二进制哈希保持不变。

## 历次补充（保留当时的失败与待办）

dfc5f92 的 [39126146571](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39126146571) 已全部结束，整体失败：Web / Android / macOS / Windows 成功，iOS 首次教学触摸在 ready / inert=false 后被系统取消，另两项功能通过。Web 云端单元 32、浏览器 100（另 4 项按平台跳过）、离线 6 项通过；完整日志为 `artifacts/web-dfc5f92-job.log`。同源码本机构建、服务端类型检查与上述回归也通过。Android 原生核心及宿主强制停止恢复通过；iOS 普通模拟器与未签名设备构建通过。已查看 320×568 新暂停/恢复布局实际截图；晚到的同位置第二次触摸不再导致下注。

候选包按提交保留：`artifacts/packages/candidate-0912720/` 有七份归档，`artifacts/packages/candidate-43ab4f4/` 有源码、Web、Android、未签名 iOS 设备、macOS DMG 与 Windows NSIS 六份；43ab4f4 云端 iOS gate 失败后没有生成普通模拟器包。各自 `manifest.json` 与 SHA256SUMS 记录来源、完整性及未通过项，均为 releaseReady=false。当前紧凑诊断改动不混入这些旧版本归档。43ab4f4 的四类 ZIP/APK 共 880 个文件已检查，17 个页面及资源逐字节一致；DMG 只校验和、Windows EXE 未在本机展开，不冒称所有嵌入资源均已解码扫描。

8657893 的 [39123410434](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39123410434) 已终止，整体失败：iOS / Android / macOS 成功，Web 在小屏继续后的同位置第二次触摸误下注，Windows 在已完成 12 轮后系统内存计数超时。原始日志、trace 和安装包保留于 `artifacts/web-8657893-run/`、`artifacts/windows-8657893-run/` 与 `artifacts/ios-8657893-run/`。iOS 的本轮首次教学成功不抹去此前失败；Web 布局与 Windows 只读重采的修正须以新源码结果确认。

macOS 的独立 5de5d11 长测已实际记录 10 轮 / 64 手牌 / 655,115 ms，P95 18–20 ms、最大 42 ms、未记录超过 50 ms 的间隔；每轮都有包含 WebKit / Metal / 主题 / 音频助手的 8 进程内存。第 11 轮因 Mac 锁屏中断，`report.json` 保持 passed=false，已请求用户手动解锁。普通功能工作在锁屏后继续，因此中断轮不作为性能证据，也不宣称整段运行无中断。长 AUDIT 的 AX 标签被截断，仅将完整可见 MEASURE 摘要和独立系统内存记录作为已取得证据。

当前工作树的触屏候选仅将悬停滤镜限制到 hover / fine pointer 设备，保留标准 click、按下反馈和教学滚动；不改触摸取消策略、不重试第一次教学点击。相关输入/教学/启动浏览器 36 项、输入能力与诊断回归 12 项、下注与复盘回归 30 项通过（另 2 项按平台跳过）。三个独立新模拟器套件全部通过，共 9 项功能通过、3 项运行审计按配置跳过；只读手势记录已验证当前轮次过滤。新版 Android 原生与进程恢复也通过，PID 4745 → 4851。普通 iOS 模拟器及未签名设备构建通过，138 个资源文件及 4 个原生二进制未发现凭据、JS 验收标记或测试记录器文件名。它尚未被云端验证，不能将本机通过称为根因已解决。

以下是历次增量与失败复现记录，段落中的“待验证”只表示当时状态；当前结论以本节、顶部矩阵及对应版本原始报告为准。

最新固定入口手势调整：云端触摸记录确认正确目标收到 down 后发生 cancel，未形成 click。首屏固定按钮与常驻教学入口只限制视口拖动，继续使用标准点击；教学内容保留纵向滚动。本机教学/启动浏览器 28 项、全新 iOS 模拟器功能 3 项通过，实际截图已检查。云端复验待进行，不认定间歇问题已解决；旧 15 轮报告和 a001301 包仍保持原源码范围，不冒充包含本次输入策略。

11d0912 的 [39115185096](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39115185096) iOS 已失败：本次窗口几何正常、启动就绪，但首次教学点击仍未打开，另两项功能通过。Android、macOS、Web 和 Windows 作业全部成功，Windows 新一轮原生 HTTP 与长测步骤均已通过；整轮仍因 iOS 失败而失败。本机 iOS 新增长测已完成 15 轮 / 93 手牌 / 16.4 分钟，四进程 RSS、真实音频和持续规则运行均有记录，仍不能覆盖此首次输入失败。普通资源已恢复；同轮服务端修复已重启加载，本机非计费健康检查 HTTP 200 / ready=true，未再调用模型。

682109f 的 [39112338856](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39112338856) **整轮失败**：Web、Android、macOS、Windows 成功，iOS 首次教学用例失败。失败中整个原生窗口及其后代为 `{inf,inf,0,0}`，105 秒视频却显示完整界面、ready / inert=false / errors=[]；不能把本机成功或先前全绿覆盖此失败。新测试在第一进程前连接模拟器显示，单独核对有效窗口几何与真实启动状态，不重试第一次教学点击。本机 3 项已通过，新云端结果仍待确认。Windows 已实际完成新增的兼容网关 HTTP 替身检查及 15 轮长测；同时本机独立 Chromium 完成 15 轮。详细范围、数据、内存增长和复现命令见 [原生运行验收](NATIVE_AUDIT.md)。客户端仍与 a001301 相同，新增的是验收代码及服务端错误正文释放修复；新增长测本机运行时测试脚本尚未提交，不冒充清洁提交的验收。

客户端 a001301 的 [39110164930](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39110164930) 五平台作业全部成功：Web 单元 24、浏览器 84、离线 6 项通过（4 项按项目跳过）；iOS 常规 3 项通过，运行审计项按配置跳过；Android 构建、macOS 构建和原生文件测试、Windows 正式安装版 15 项与独立运行验收通过。当前 Windows 65.7 秒 / 7 手牌回调 P95 15.7 ms、最大 31.2 ms。六份同提交候选包位于 `artifacts/packages/candidate-a001301/`，`manifest.json` 和 `SHA256SUMS` 记录来源与完整性，未标成正式发布就绪。

同一客户端另做本机原生运行：iOS XCTest 67.2 秒 / 5 手牌、真实音频和后台恢复通过，回调 P95 22 ms、最大 88 ms；随后在真实模拟器上由一次可信触摸启动 App 内置连续牌局，66.1 秒 / 6 手牌、P95 18 ms、最大 66 ms，超过 50 ms 一次。两次操作节奏和外部控件查询不同，不能据此认定单一原因或 GPU 优化。分别见 `artifacts/a001301-ios-runtime-attachments/CF4B9D1D-3907-440F-B5D4-0832BB6FB2DD.json`、`artifacts/a001301-ios-continuous-cua.json` 和同名 JPG。macOS 普通客户端也已实际打开图鉴、展开比较说明、观察窗口恢复后第一次继续没有额外投入，原手牌/底池和 960 灵石保留；见 `artifacts/a001301-macos-production-observation.json` 与 `artifacts/a001301-macos-production-guide.jpg`。

牌型图鉴增量：教学每一步均可展开，第十步默认展开；保留原十二步索引和存档格式。九组示例牌及皇家同花顺、葫芦优先级、A 低顺、踢脚、花色平等和公共牌平手说明均以规则程序验证。单元 24 项、教学浏览器 12 项及生产构建通过；浏览器覆盖 Chromium 390×844、320×568、桌面与移动 WebKit，验证 45 张示例牌不溢出、底部继续按钮常驻、展开图鉴不改变教学进度和练习钱包。随后补齐教学安全区与启动失败重试，相关浏览器 28 项通过，日志为 `artifacts/native-guide-startup-browser.log`。图鉴已纳入新本机 iOS / Android 安装产物：iOS XCTest 3 项通过（运行审计按配置跳过），报告为 `artifacts/ios-native-1792310415021.xcresult`，截图为 `artifacts/ios-guide-safe-area-attachments/747EAC34-3841-4651-B8D4-8B258F58505D.png`；Android 图鉴和比较展开、原生进度隔离与进程恢复通过，主机进程 7607 → 7739，日志为 `artifacts/android-hand-guide.log`。这次还未发布新的六平台同源候选包。

4dbdf67 的云端 [39109218733](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39109218733) 五个平台作业全部成功。Web 单元 24、完整浏览器 76 和离线 6 项通过，另 4 项按项目跳过；Android 构建、macOS 构建与原生文件测试、Windows 正式安装版功能及独立运行验收成功，iOS 常规原生用例通过。这轮尚不包含后续单一窗口入口和教学安全区修正；不能用此成功直接代表后续修改已通过云端。

36c5ebb 的 [39104828591](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39104828591) 中 Web、Android、macOS、Windows 成功；iOS 首次教学点击及一次带存档重启失败，试炼通过、审计项按配置跳过，整轮失败。其本机整轮浏览器 68 项通过、4 项有意跳过，单元 22 项与服务端类型检查通过；iOS 26.5 独立运行审计完成 5 手牌、音频与原生后台恢复，并取得真实 DeepSeek 解读，帧间隔 P95 为 22 ms。Android 硬件图形配置下 65 秒完整动效采样 P95 为 16.8 ms；另一次真实 DeepSeek 联调通过，但保留了 1333.4 ms 长间隔，不能称为全程稳定无卡顿。1 核 / 2 GB 软件渲染的低帧率结果也保留，指标口径、环境及复现命令见 [原生运行验收](NATIVE_AUDIT.md)。

云端首次触摸诊断已确认按下落在正确教学按钮，但没有松开或 click，页面无脚本错误；另一次重启失败时原生启动图仍可见、主界面未开放。现保留第一次点击验收，调整原生触摸延迟，并将启动流程改为先挂载界面和收起原生遮罩，再等待牌桌准备完成、开放输入；复验中，不宣称已解决。

原生桌面验收还发现快速连点「继续」会点到随后出现的跟注控件，手机浏览器实测旧版从 1000 意外变为 960。现为恢复后的下注操作加 300 ms 防误触保护，界面即时恢复，之后正常行动不受影响；手机/窄屏/桌面/移动 WebKit 的四项回归通过，连同启动边界共 12 项专项通过。重建的 macOS 客户端在自己的行动回合双击继续，手牌与灵石保持不变，随后真实跟注正常；另启用 macOS 未激活窗口的首击响应。连续运行面板仅用于验收构建，普通包不包含。

c834c5d 的 [39102687058](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39102687058) 中 Web、Android、macOS、Windows 成功，iOS 再次在首次教学点击失败。客户端输入保护现额外等待真正的 Phaser 场景准备完成；本机成功不能覆盖云端失败，下一轮继续保留首次点击断言与触摸目标证据。

14ced63 的 [39101785367](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39101785367) 五平台 CI 全部成功，iOS 包含首次教学入口及续学的三项原生测试。当前追加 DeepSeek 配置、原生渐隐区间保护和隔离测试服务，使用下方独立证据继续复验，不以先前全绿替代新改动验证。

7c517b0 的本机浏览器 60 项、生产离线 6 项、规则/服务/平台单元 21 项、Rust 文件 4 项及 iOS 原生 3 项通过；Android 模拟器与 macOS 实际窗口也验证了教学进度在进程重启后恢复。[39100789879](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39100789879) 中 Web、Android、macOS、Windows 成功；iOS 两项通过，新增教学用例首次点击未打开弹窗，整轮失败。修复与复验正在进行，不能称为五平台全部通过。上轮 3078cd1 的成功也不能代替新增教学验证。

本轮候选包位于 `artifacts/packages/candidate-7c517b0/`。已收齐 Web ZIP、Android 调试 APK、iOS 模拟器与未签名设备 App ZIP、macOS arm64 DMG、Windows x64 NSIS。Windows 包来自同提交 CI，实际安装后 14 项检查通过，进程 9132 → 7152、教学步骤 3（界面第 4 步）恢复；报告位于 `artifacts/windows-7c517b0-run/artifacts/windows-native/`。SHA-256、ZIP 完整性、iOS 可执行权限与平台类型、DMG 校验和、APK v2 签名均已检查。Android APK 与两个 iOS App 中的教学入口脚本，与当前 Web 构建逐字节一致。`manifest.json` 保留源码提交、证据与未验收项，`releaseReady` 为 false。

### 历史基线

49bdc5c：[39078990197](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39078990197)，Web、Android、iOS、macOS、Windows 五项任务全部成功。其中规则/服务/平台单元测试 20 项，浏览器 46 项通过、2 项有意跳过，生产离线 4 项通过。iOS 包含原生 XCTest，Windows 包含 NSIS 安装后的实际原生运行，不是独立浏览器替代。

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

iOS 同轮在 Xcode 首次启动应用超时，未进入功能断言；本机原生 2 项通过的证据保持独立记录。现先用本机 Xcode 的 `simctl bootstatus <id> -b` 确认测试模拟器完成初次启动和迁移，再交给 XCTest；未增加忽略失败或自动重试。CI 即使 iOS 测试失败也保留 xcresult，便于核对后续失败。本机更新后的 iOS 2 项 XCTest 通过（`artifacts/ios-bootstatus-regression.log`、`artifacts/ios-native-1792284749805.xcresult`），规则/服务/平台 20 项及服务端类型检查通过；b92b6cf 的 [39084475523](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39084475523) 中，Web（52 项及离线 4 项）、Android、macOS、Windows 成功；iOS 试炼通过，但首次启动未在 20 秒内出现师父按钮，整轮失败。此次 xcresult 已成功保留并下载到 `artifacts/ios-b92b6cf-run/`。原生日志显示第一轮 WebView 于约 26 秒后完成页面加载，随后 Preferences、Phaser 初始化正常；失败录屏确认之前为空白，不能称为启动体验通过。

首次启动功能测试改为最多等待 60 秒，并记录包含原生启动的耗时及就绪/失败截图；不重启、不跳过首次启动，也不改变后续操作与进程恢复断言。这是功能就绪窗口的调整，**不是启动耗时优化或性能通过**。需要真机检查首次启动体验，若实际设备仍有明显空白或慢启动，必须继续修复。后续 CI 尚待执行。

实际体验另行补齐：接入官方 `@capacitor/splash-screen` 8.0.2，原生启动图保持到游戏界面或可重试错误画面准备完成，再淡出；加载期间保留墨青「道」字图与金色指示器，避免首轮 WebView 导航只剩空白背景。它不缩短系统首次 WebKit 初始化。依据 [Capacitor 启动画面文档](https://capacitorjs.com/docs/apis/splash-screen#hiding-the-splash-screen)。本机 iOS 2 项通过，初始截图实际捕捉到启动图向牌桌淡出的过渡（`artifacts/ios-native-splash-attachments/`、`artifacts/ios-native-1792286268851.xcresult`）；本轮 Android 仪器与强制停止恢复通过（8941 → 9040，`artifacts/android-native-splash-regression.log`）；浏览器 52 项、离线 4 项、单元 20 项与服务端类型检查通过；未签名 iPhone App 和 macOS App / DMG 重建通过。对应日志为 `artifacts/e2e-native-splash.log`、`artifacts/offline-native-splash.log`、`artifacts/unit-native-splash.log`、`artifacts/server-native-splash.log`、`artifacts/ios-device-native-splash.log`、`artifacts/macos-native-splash.log`。云端复验尚待最终结果。

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

Windows 测试采用安装后启动 App、测试进程显式启用本机端口、EdgeDriver attach 的方式；正常启动不启用调试端口。早期 WebView2 会话失败已解决，失败运行仍保留在 CI 历史中。macOS 普通客户端和独立验收客户端均已有实际窗口证据，详见最近验证与原生验收记录。

## 剩余交付条件

- Android 触摸缺口已补齐：API 36 隔离模拟器通过 Instrumentation 注入真实 touchscreen down/up，首次教学、入席和加注均收到 isTrusted=true 的点击，未重试首次教学点击。新仪器检查及后续进程恢复通过，PID 5337 → 5528，证据为 `artifacts/android-native-touch.log`。其他仪器步骤仍有程序调用，不把整套检查都称为手势覆盖。
- DeepSeek 本机网关、Web、iOS / Android / macOS 原生验收配置已真实联通。Windows 实际回环 HTTP 的预检、成功、错误、超时与回退已测，上游为明确标识的兼容替身，仍未在 Windows 调用真实 DeepSeek。模型按 `deepseek-flash` 配置，详见 `docs/AI.md`。真实调用样本不代表持续质量或延迟保证。
- 公网师父服务：账号鉴权、配额、持久限流、HTTPS、发布环境和相应隐私披露。当前服务是本机开发网关。
- 额外范围：手机真机、用户电脑与签名发布未验收。用户已明确本轮使用手机模拟器，不再等待真机；未要求实际提交商店或正式发布。
- 各平台已有音频和一分钟以上连续牌局的实际证据；Web / iOS / Android / Windows 已有带归属进程组的 15 轮记录，不能替代当前源码功能复验。macOS 长测在 10 轮后被锁屏中断，GPU 呈现与触控延迟专项仍未完成。60 FPS 是目标，回调间隔不能作为手机硬件保证。`web-perf` 技能要求的 Chrome DevTools MCP 未配置，专项性能审计未执行。

真机步骤：记录型号和系统 → 安装、冷启动 → 玩三手（弃牌、加注、摊牌和复盘）→ 切后台再返回 → 结束进程再启动 → 核对手牌、灵石和课程进度 → 检查键盘、安全区和触控 → 音效、静音、来电恢复 → 持续帧时间和内存测量。每一项只在实际完成后填写结果。

### 本轮：原生入席可用状态

992dd9c 的 [39086263824](https://github.com/jgchenu/Holdem-Game-Practice/actions/runs/39086263824) 中，Web、Android、macOS、Windows 成功；iOS 首次画面就绪检查和试炼通过，但入席后无手牌，整轮失败。下载报告 `artifacts/ios-992dd9c-run/` 的原生层级显示，测试点击时「入席修炼」仍 Disabled，牌桌显示「正在铺开牌席…」，该次点击未开始牌局。测试先前把 DOM 出现等同于引擎可用。

现等待入席/继续按钮真实存在、启用且可点击，再执行原来的入席和手牌恢复断言；分别记录页面就绪与操作可用耗时和截图。未强制启用按钮，未跳过第一进程，仍保留入席后 20 秒内出现手牌、师父功能与进程恢复核对。启动缓慢仍是未通过的性能项，功能就绪窗口不能代表真机体验。本机修改后的 iOS 2 项通过（`artifacts/ios-actionable-entry-regression.log`、`artifacts/ios-native-1792287718130.xcresult`），云端新一轮待执行。992dd9c 的云端首次启动截图已确认原生「道」字画面保持可见，见 `artifacts/ios-992dd9c-attachments/85747DD9-49B6-458A-8211-8CD9145BD228.png`；这项视觉证明独立于失败的功能测试。

### 本轮：完全新手的第一手带练

原有九课偏向问答，不能代替从零教学。新增独立的 12 步带练，首屏主入口为「从零学德州」，师父旁常驻「新手教学」，修炼阁顶部也能进入。依次解释两张底牌、点数和花色、盲注与底池、3/1/1 张公共牌，再亲手过牌、跟注、加注和弃牌，摊牌时标出程序选择的最强五张。教学固定牌堆与行动使用同一规则引擎，明确不作盈利建议，不影响原练习桌与九课境界。

教学步骤使用独立版本键 `wendao:onboarding:v1` 保存；Web、移动 Preferences 和桌面原生文件白名单均已接入。手机弹窗将操作区固定在底部，内容独立滚动，兼顾 320×568 与安全区；可以上一步、退出后继续，完成后也可重学。实际渲染截图位于 `artifacts/onboarding-check-*.png` 与 `artifacts/onboarding-five-*.png`。

完整浏览器 60 项通过、4 项按项目有意跳过，覆盖 Chromium / WebKit 和 320×568 教学操作区；其中新教学专项 8 项通过。核心单元含真实发牌/投入/比牌的教学检查共 21 项通过；iOS 原生 3 项通过，新增教学进度在进程重启后恢复和按钮安全区检查（`artifacts/onboarding-ios.log`，`artifacts/ios-native-1792300811012.xcresult`）。Android API 36 模拟器仪器测试及独立进程恢复通过（30349 → 30449），核对教学步骤由 Preferences 恢复。生产离线 6 项、Rust 文件测试 4 项及服务端类型检查通过，iOS 模拟器、未签名设备包、Android APK 与 macOS App / DMG 构建成功。日志为 `artifacts/onboarding-full-browser-final.log`、`artifacts/onboarding-unit-final.log`、`artifacts/onboarding-android.log`、`artifacts/onboarding-offline-final.log`、`artifacts/onboarding-desktop-store-final.log` 和 `artifacts/onboarding-*-final.log`。

Mac 已解锁，本轮通过实际原生窗口验证新版教学：原练习桌的 J♦ 10♦ J♥ / 3♥ Q♣、灵石 960 和暂停状态在启动后保留；推进教学到第二步，退出 App 再启动，重新打开仍为第二步；最后回到教学欢迎页。此项为 CUA 实际操作观察，非自动化性能测量。Windows 新增教学推进及进程退出恢复断言已在本轮 CI 实际安装版通过，不能用上轮 3078cd1 的成功结果代替。

首轮完整浏览器执行期间改动了前端与字体，开发服务器热重载导致两项中途返回首屏，记录保留于 `artifacts/onboarding-full-browser.log` 与 `artifacts/onboarding-initial-browser-failures/`。冻结源文件后完整执行 60 项通过，未放宽功能断言。

本轮桌面文件测试曾因并行测试用系统时间生成了相同临时目录名而失败，改为进程内原子序号结合时间、PID，测试夹具目录独立；此修正只涉及测试夹具，不改变产品存档位置和写入逻辑。

### 本轮：启动过渡期间的点击保护

7c517b0 的 iOS 云端失败报告保留在 `artifacts/ios-7c517b0-run/`、`artifacts/onboarding-ios-ci.log`，视频帧为 `artifacts/ios-beginner-ci-before-tap.png` 与 `artifacts/ios-beginner-ci-after-tap.png`。原生测试在首次界面出现后点击教学，但失败层级仍停留在主界面，没有教学弹窗。此证据确认首次点击未打开；不能单独证明 WebKit 或启动图的具体内部根因。

补齐产品启动保护：主界面在依赖初始化、事件绑定和原生启动图收起结束前保持 `inert`，完成后才允许输入；失败时同样释放保护，保留重试入口。iOS 教学用例等待入口真实启用且可点击，首屏优先走「从零学德州」，复用模拟器有存档时走常驻入口；第一次点击后必须出现教学弹窗，未加重试或跳过首次进程。逐步教学操作也等待本步保存完成。另修复首屏次要按钮缺少样式造成的系统白底，并统一教学滚动条颜色。

本机原生 XCTest 3 项通过（`artifacts/startup-input-gate-ios.log`、`artifacts/ios-native-1792302348768.xcresult`）；浏览器模拟原生启动图等待的输入保护专项 4 项通过（`artifacts/startup-input-gate-targeted-final.log`），规则/服务/平台 21 项及服务端类型检查通过。浏览器专项使用模拟桥接，不能当作 iOS 实测；完整跨平台复验与新版候选包待完成。

### 本轮：DeepSeek 真实联调与测试服务隔离

用户选择 DeepSeek 后，本机 `.env` 已配置官方 Base URL、当前模型 `deepseek-flash` 和 `AI_THINKING=disabled`，既有密钥保持在本机服务端。官方 `/models` 实际确认该模型可用；本机网关三个主题均 HTTP 200，固定合成手牌的响应数字与程序事实一致，耗时 1545 / 1323 / 1639 ms（`artifacts/deepseek-live-report.json`）。另在 390×844 WebKit 的独立测试页面真实请求「衡量价格」，返回模型解读，灵石不变；端到端 2046 ms，截图和报告为 `artifacts/deepseek-live-mobile-webkit.png`、`artifacts/deepseek-live-ui.json`。均为小样本，未承诺稳定延迟或整体教学质量。客户端 dist、iOS 与 Android public 共 82 个文件扫描未发现已配置的密钥。

通用兼容接口不默认发送厂商扩展；配置 `AI_THINKING` 时才向上游传递 `thinking`，客户端仅收到最终解释，不透传推理字段。单元测试 22 项和服务端类型检查通过。

14ced63 的本机整轮浏览器被用户更新 `.env` 触发的 Vite 重启打断；该轮不是通过结果，保留 `artifacts/startup-input-gate-browser.log` 和 `artifacts/startup-input-gate-interrupted-browser-evidence/`。浏览器测试现使用专用 5183 端口、不复用日常 5173 服务、不读取本机 `.env`、不代理到真实模型，并忽略原生构建与 artifacts 目录的文件变化。新隔离服务的启动、教学、独立浏览器恢复专项 14 项通过、2 项按项目有意跳过（`artifacts/deepseek-isolated-targeted.log`），完整回归执行中。

核对本地 Capacitor SplashScreen 8.0.2 原生源码后确认：`hide()` 调用在原生渐隐被安排时即 resolve，并不等待动画完成。现让点击保护额外覆盖配置的 200 ms 渐隐区间，而非把桥接 promise 当成完成事件；功能等待不作为启动性能证明。此修改后的本机 iOS 三项 XCTest 通过（`artifacts/native-fade-gate-ios.log`、`artifacts/ios-native-1792303104392.xcresult`）；完整跨平台复验仍待最终结果。

### 普通包验收补充

iOS 新增普通构建的全新模拟器首次教学点击验证，直接归档该设备实际安装的 App，再执行原有三套诊断门禁。本机普通用例 1 项通过，三套诊断合计 9 项通过、3 项按配置跳过；云端新流程待执行。macOS 新增 CI 专用普通 App 副本的 XCTest 首点与发牌探针，本机仅编译和保护检查通过，运行未验证。详见 `docs/NATIVE_AUDIT.md`。3e25c0c 云端 iOS 因外层 30 分钟期限中断，仍不满足完整三套门禁；候选包继续 releaseReady=false。用户已解锁 Mac，完整新长测待继续。
