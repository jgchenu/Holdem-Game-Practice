# 国内兼容接口与青玄师父

师父入口位于牌桌底部的「请教师父」。打开后暂停牌局；程序先显示当前牌型、跟注成本和直接价格。玩家可选择看懂局面、衡量价格或复盘思路；关闭后自行继续。

模型只解释程序事实，不参与发牌、下注和结算，不生成胜率或策略评分。AI 文本与本地规则指引有独立标签；服务未配置、离线、请求失败或超时均保留本地指引。模型输出按纯文本显示，不执行 HTML 或操作。

## 配置

使用兼容 Chat Completions 的国内服务。接口格式依据 [DeepSeek 官方接口说明](https://api-docs.deepseek.com/api/create-chat-completion/)；其他服务只要兼容相同的请求与响应结构，即可配置其 Base URL 和模型名。不要把模型名写死为过期型号，按服务商控制台选择。

用户已选择 DeepSeek。当前示例为 `AI_BASE_URL=https://api.deepseek.com`、`AI_MODEL=deepseek-flash`、`AI_THINKING=disabled`（2026-10-18 核对官方文档，并由真实 `/models` 确认可用）。师父输出简短规则解释，显式使用非思考模式；[官方文档](https://api-docs.deepseek.com/guides/thinking_mode/)说明默认开启思考。其他兼容服务不支持此扩展时将 `AI_THINKING` 留空，网关就不发送 `thinking` 字段。

1. 复制 `.env.example` 为本地 `.env`。
2. 填写 `AI_BASE_URL`、`AI_MODEL` 和 `AI_API_KEY`。Base URL 填到版本前缀，例如 `https://api.deepseek.com` 或服务商给出的 `…/compatible-mode/v1`；程序自动追加 `chat/completions`。
3. 运行 `npm run coach:serve`，用 `/health` 检查配置状态。它只返回是否配置，不回传密钥。
4. `npm run dev` 将同源 `/api/coach` 转发到本机 8787。Web 正式部署需要将 `/api/coach` 转发到师父服务。
5. 原生包填写 `VITE_COACH_URL=https://你的域名/api/coach` 后重新构建；客户端中只保留公开服务地址。不要使用 `VITE_` 前缀保存服务商密钥。

`.env` 已排除版本控制。不要把密钥、证书或口令发到聊天、提交至仓库或放入安装包。

## 运行边界

服务默认只监听本机 127.0.0.1。`COACH_ALLOWED_ORIGINS` 控制允许的 Web / 原生 Origin，逗号分隔；开发时默认允许 localhost:5173 与 localhost:4173。原生发布时按实际平台加入对应 Origin。

当前有请求结构校验、32 KiB 请求上限、64 KiB 上游响应上限、每来源 IP 每分钟 20 次、全局最多两次并发和 12 秒超时。上游地址、模型与密钥只能由服务端配置。请求仅包含本人底牌、公共牌、匿名座位筹码及最多 64 条公开行动，不传牌堆、烧牌或其他底牌。价格计算按可竞争的投入上限处理，排除短码无法竞争的高层边池。

当前服务用于开发联调。公网发布还需要部署方接入账号鉴权、配额和持久限流，并配置 HTTPS；不要把本机开发服务直接暴露为收费模型的公共转发器。真实服务商的模型质量、延迟、计费与故障表现必须在完成配置后实测。App 隐私披露与商店数据声明也应按选用服务及部署方式更新。

## 已验证与未验证

- 单元与本机 HTTP 模拟上游：可见信息过滤、额外字段拒绝、直接价格、边池上限、兼容请求头与结构、未配置和超时错误已通过。
- 浏览器：模型文本安全呈现、失败回退、关闭后保留同一手牌和灵石已通过；这里使用模拟响应，不是真实模型调用。
- DeepSeek 真实联调：本机网关经官方服务实际完成「看懂局面」「衡量价格」「复盘思路」三次调用，均 HTTP 200；此固定合成测试的耗时分别为 1545 / 1323 / 1639 ms，来源为模型，数字与程序事实一致。报告位于 `artifacts/deepseek-live-report.json`。这是一次本机小样本联调，不能代表持续延迟、其他模型、原生包网络或整体教学质量。
- 页面真实联调：390×844 的本机 WebKit 独立测试页面通过真实网关取得 DeepSeek 解读，灵石保持不变；端到端一次为 2046 ms。证据为 `artifacts/deepseek-live-mobile-webkit.png` 和 `artifacts/deepseek-live-ui.json`，并非手机真机或原生包联网证明。
- Android 原生联调：API 36 模拟器中的实际 Capacitor WebView 经本机回环端口转发取得 DeepSeek 解读；健康检查 HTTP 200、实际 Origin 为 `https://localhost`。报告 `artifacts/android-native-runtime-1792305645015.json` 中 `liveAI.passed=true`。首次失败及调试网络配置的边界见 [原生运行验收](NATIVE_AUDIT.md)，不能当作公网服务已部署或手机已验收。
- iOS 原生联调：iOS 26.5 模拟器的真实师父面板取得模型解读，XCTest 原生断言通过，日志为 `artifacts/ios-deepseek-native-background.log`；同轮原生音频、后台恢复与持续动画数据见 `artifacts/ios-audit-1792305846978.xcresult`。本机回环请求未额外放开 ATS。
- macOS 原生联调：独立验收客户端 `tauri://localhost` 实际取得模型解读，解释跟注 20 / 跟注后可竞争 90 / 价格 22.2%；请教前后灵石均为 1000，来自 CUA 实际窗口观察，记录在 `artifacts/macos-native-runtime-observation.json`。
- 新手表达：真实回复曾把内部字段名带入说明，已补充零基础表达要求，先说明当前选择、不展示字段名或空值。实际免费过牌场景复测 HTTP 200、1585 ms，回复未带内部字段名；见 `artifacts/deepseek-beginner-language.json`。这是单次样本，不保证模型每次表达都正确。
- Windows 原生传输检查已在 682109f CI 实跑通过：真实 WebView2 请求真实本机 HTTP 网关，Origin 为 `http://tauri.localhost`，由明确标识的兼容接口替身返回数据，成功 200、上游错误转 502、超时转 504 及 204 预检通过。失败时本地回退，手牌与钱包保持；超时上游连接确实取消。测试不读取供应商环境变量或密钥。证据为 `artifacts/windows-682109f-run/artifacts/windows-runtime/coach-transport.json` 和三张同名状态截图；这是传输、CORS 与回退的检查，不能当成 Windows 已调用真实 DeepSeek。
- 网关上游错误正文现在主动取消，避免服务商返回错误状态但正文不结束时连接残留。真实回环 HTTP 单元回归先失败后通过，不调用收费模型。
