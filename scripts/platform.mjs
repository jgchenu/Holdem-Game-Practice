import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  readFileSync,
  rmSync,
  statSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isolatedEmulator } from "./android-test-device.mjs";
import { randomUUID } from "node:crypto";
import { parseAndroidAudit } from "./native-audit-log.mjs";
import { collectIosNativeInput } from "./ios-native-input.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = process.argv[2];
const env = { ...process.env };
const audit = ["ios-audit", "android-audit", "desktop-audit", "desktop-soak"].includes(target);
if (target === "desktop-soak") {
  if (process.platform !== "darwin") throw new Error("独立 macOS 长测构建需要这台 Mac。");
  env.CARGO_TARGET_DIR = join(root, "artifacts", "macos-soak-target");
}
const liveAudit = audit && env.WENDAO_LIVE_AI === "1";
const fixtureAudit = target === "desktop-audit" && env.WENDAO_COACH_FIXTURE === "1";
const extendedIOSAudit = target === "ios-audit" && env.WENDAO_SOAK_CYCLES === "15";
if (target === "ios-audit" && env.WENDAO_SOAK_CYCLES && !["1","15"].includes(env.WENDAO_SOAK_CYCLES)) throw new Error("iOS 长测轮数支持 1 或 15。");
if (target === "android-audit" && env.WENDAO_SOAK_CYCLES && !["1","15"].includes(env.WENDAO_SOAK_CYCLES)) throw new Error("Android 长测轮数支持 1 或 15。");
const auditRunToken = target === "android-audit" ? env.WENDAO_AUDIT_RUN_TOKEN || randomUUID() : "";
if (auditRunToken && !/^[a-zA-Z0-9-]{8,64}$/.test(auditRunToken)) throw new Error("Invalid native audit run token");
if (liveAudit && fixtureAudit) throw new Error("真实模型和接口替身验收不能同时启用。");
env.VITE_NATIVE_AUDIT = audit ? "1" : "";
env.VITE_STARTUP_TRACE = target === "ios-test" ? "1" : "";
// Native test runs never contact a configured, billable mentor service.
if (target === "ios-test" || target === "android-test" || audit)
  env.VITE_COACH_URL = liveAudit || fixtureAudit ? "http://127.0.0.1:8787/api/coach" : "";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const packages = join(root, "artifacts", "packages");
mkdirSync(packages, { recursive: true });
const lock = join(root, "artifacts", ".platform-build-lock");
const lockOwner = join(lock, "owner");
let locked = false;
for (let attempt = 0; attempt < 600; attempt++) {
  try {
    mkdirSync(lock);
    writeFileSync(lockOwner, String(process.pid));
    locked = true;
    break;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const pid = Number(readFileSync(lockOwner, "utf8"));
      if (pid) process.kill(pid, 0);
    } catch (error) {
      if (
        error.code === "ESRCH" ||
        (error.code === "ENOENT" &&
          Date.now() - statSync(lock).mtimeMs > 30_000)
      ) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
if (!locked) throw new Error("另一个平台构建仍在运行，请稍后重试。");
process.once("exit", () => rmSync(lock, { recursive: true, force: true }));
// Windows commonly exposes `Path`; duplicate PATH/Path keys lose the existing search path in spawn.
const pathKey =
  Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
const cargo = join(homedir(), ".cargo", "bin");
if (existsSync(cargo))
  env[pathKey] =
    cargo + (process.platform === "win32" ? ";" : ":") + (env[pathKey] || "");
function run(command, args, cwd = root, after) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (after) {
    try { after(); } catch (error) { console.error("Native diagnostic export failed", error); }
  }
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (
  ![
    "sync",
    "android",
    "android-test",
    "android-audit",
    "ios-sim",
    "ios-test",
    "ios-audit",
    "ios-device",
    "ios-signed",
    "desktop",
    "desktop-debug",
    "desktop-test",
    "desktop-audit",
    "desktop-soak",
  ].includes(target)
) {
  console.error(
    "Usage: node scripts/platform.mjs sync|android|android-test|android-audit|ios-sim|ios-test|ios-audit|ios-device|ios-signed|desktop|desktop-debug|desktop-test|desktop-audit|desktop-soak",
  );
  process.exit(1);
}
if (target.startsWith("desktop")) {
  if (target === "desktop-test") {
    run(npm, ["run", "build"]);
    run("cargo", ["test", "--locked", "--release", "--manifest-path", "src-tauri/Cargo.toml", "--lib"]);
    process.exit(0);
  }
  // A file avoids cmd.exe stripping the JSON quotes from a .cmd invocation.
  // Keep the argument relative and space-free even when the checkout path has spaces.
  const soak = target === "desktop-soak";
  const auditConfig = join("artifacts", soak ? "desktop-soak-config.json" : "desktop-audit-config.json");
  if (audit) writeFileSync(join(root, auditConfig), JSON.stringify({ productName: soak ? "问道牌途长测" : "问道牌途验收", identifier: soak ? "com.wendao.poker.soak.desktop" : "com.wendao.poker.audit.desktop" }));
  run(npx, [
    "tauri",
    "build",
    ...(audit ? ["--config", auditConfig] : []),
    ...(target === "desktop-debug"
      ? ["--debug", "--no-bundle"]
      : ["--bundles", soak ? "app" : process.platform === "win32" ? "nsis" : "app,dmg"]),
  ]);
  process.exit(0);
}
run(npm, ["run", "build"]);
run(npx, ["cap", "sync"]);
if (target === "sync") process.exit(0);
if (target === "android" || target === "android-test" || target === "android-audit") {
  const studioJava =
    process.platform === "darwin"
      ? "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
      : null;
  if (!env.JAVA_HOME && studioJava && existsSync(studioJava))
    env.JAVA_HOME = studioJava;
  const sdk =
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    (process.platform === "darwin"
      ? join(homedir(), "Library/Android/sdk")
      : process.platform === "win32"
        ? join(env.LOCALAPPDATA || "", "Android/Sdk")
        : join(homedir(), "Android/Sdk"));
  if (!existsSync(sdk))
    throw new Error("找不到 Android SDK，请设置 ANDROID_HOME。");
  env.ANDROID_HOME = sdk;
  if (target === "android-test" || target === "android-audit") {
    const adb = join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    const listing = spawnSync(adb, ["devices"], { env, encoding: "utf8" });
    if (listing.error || listing.status !== 0) throw new Error("无法查询 Android 测试设备。");
    env.ANDROID_SERIAL = isolatedEmulator(listing.stdout, env.ANDROID_SERIAL);
    const emulator = spawnSync(adb, ["-s", env.ANDROID_SERIAL, "shell", "getprop", "ro.kernel.qemu"], { env, encoding: "utf8" });
    if (emulator.error || emulator.status !== 0 || emulator.stdout.trim() !== "1") throw new Error("测试目标不是已确认的 Android 模拟器。");
  }
  writeFileSync(
    join(root, "android", "local.properties"),
    `sdk.dir=${sdk.replaceAll("\\", "\\\\").replaceAll(":", "\\:")}\n`,
  );
  // Exercise our installed app; dependency libraries own separate, unrelated test suites.
  run(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    [
      target === "android-test" || target === "android-audit"
        ? ":app:connectedDebugAndroidTest"
        : ":app:assembleDebug",
      ...(target === "android-audit" ? ["-Pandroid.testInstrumentationRunnerArguments.class=com.wendao.poker.NativeAuditTest", "-Pandroid.testInstrumentationRunnerArguments.phase=runtime-audit", `-Pandroid.testInstrumentationRunnerArguments.liveCoach=${liveAudit}`, `-Pandroid.testInstrumentationRunnerArguments.graphicsCompare=${env.WENDAO_GRAPHICS_COMPARE === "1"}`, `-Pandroid.testInstrumentationRunnerArguments.soakCycles=${env.WENDAO_SOAK_CYCLES || "1"}`, `-Pandroid.testInstrumentationRunnerArguments.auditRunToken=${auditRunToken}`] : []),
    ],
    join(root, "android"),
  );
  copyFileSync(
    join(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
    join(packages, audit ? "wendao-android-audit.apk" : "wendao-android-debug.apk"),
  );
  console.log(`Android ${audit ? "验收" : "调试"} APK：artifacts/packages/${audit ? "wendao-android-audit.apk" : "wendao-android-debug.apk"}`);
  if (target === "android-audit") {
    // Gradle may uninstall the app when instrumentation ends. Retain the report
    // from its captured native test output instead of reading deleted app data.
    const resultDirectory = join(root, "android/app/build/outputs/androidTest-results/connected/debug");
    const logs = readdirSync(resultDirectory, { recursive: true }).filter(name => name.endsWith("logcat-com.wendao.poker.NativeAuditTest-audioLifecycleAndSustainedFrames.txt"));
    const records = logs.flatMap(name => readFileSync(join(resultDirectory, name), "utf8").split("\n"));
    const report = parseAndroidAudit(records);
    if (report.runToken !== auditRunToken) throw new Error("Android 运行报告不属于本轮测试。");
    writeFileSync(join(root, "artifacts", `android-native-runtime-${Date.now()}.json`), JSON.stringify(report, null, 2) + "\n");
  }
  if (target === "android-test")
    run(process.execPath, ["scripts/android-process-death.mjs"]);
} else {
  if (process.platform !== "darwin")
    throw new Error("iOS 构建需要 macOS 与 Xcode。");
  const testing = target === "ios-test" || target === "ios-audit";
  const simulator = target === "ios-sim" || testing,
    signed = target === "ios-signed";
  let destination = simulator
    ? "generic/platform=iOS Simulator"
    : "generic/platform=iOS";
  let testDeviceUDID;
  if (testing) {
    const listing = spawnSync(
      "xcrun",
      ["simctl", "list", "devices", "available", "--json"],
      { env, encoding: "utf8" },
    );
    if (listing.status !== 0) throw new Error("无法查询 iOS 模拟器。");
    const devices = Object.values(JSON.parse(listing.stdout).devices)
      .flat()
      .filter((device) => /iPhone|iPad/.test(device.deviceTypeIdentifier || device.name));
    const device = env.IOS_TEST_DEVICE
      ? devices.find((device) => device.udid === env.IOS_TEST_DEVICE)
      : devices.find((device) => device.state === "Booted") || devices[0];
    if (!device)
      throw new Error("请安装可用的 iPhone 模拟器，或设置 IOS_TEST_DEVICE。");
    // Wait for first-boot setup and migrations before XCTest tries to launch
    // the application on a fresh CI simulator.
    run("xcrun", ["simctl", "bootstatus", device.udid, "-b"]);
    // A booted headless device can render frames while XCTest reports the
    // whole window at {inf,inf,0,0}. Attach its display before the first app
    // process; never retry the teaching tap or relaunch to hide that failure.
    run("open", ["-g", "-a", "Simulator", "--args", "-CurrentDeviceUDID", device.udid]);
    destination = `platform=iOS Simulator,id=${device.udid}`;
    testDeviceUDID = device.udid;
  }
  if (signed && !env.APPLE_TEAM_ID)
    throw new Error(
      "签名构建需要设置 APPLE_TEAM_ID，并在 Xcode 登录对应开发者账号。",
    );
  const derived = join(
    root,
    "artifacts",
    audit ? "ios-audit" : simulator ? "ios" : signed ? "ios-signed" : "ios-device",
  );
  const nativeInputStartedAt = Date.now();
  run("xcodebuild", [
    "-project",
    "ios/App/App.xcodeproj",
    "-scheme",
    "App",
    "-sdk",
    simulator ? "iphonesimulator" : "iphoneos",
    "-destination",
    destination,
    "-derivedDataPath",
    derived,
    ...(target === "ios-test" ? ["SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) STARTUP_TRACE"] : []),
    ...(audit ? [`SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) NATIVE_AUDIT${liveAudit ? " NATIVE_LIVE_AI" : ""}${extendedIOSAudit ? " NATIVE_SOAK" : ""}`, "-only-testing:PracticeUITests/PracticeUITests/testNativeRuntimeAudioAndFrames"] : []),
    ...(signed
      ? [
          "CODE_SIGNING_ALLOWED=YES",
          "CODE_SIGN_STYLE=Automatic",
          `DEVELOPMENT_TEAM=${env.APPLE_TEAM_ID}`,
          "-allowProvisioningUpdates",
        ]
      : ["CODE_SIGNING_ALLOWED=NO"]),
    ...(testing
      ? [
          "-parallel-testing-enabled",
          "NO",
          "-resultBundlePath",
          join(root, "artifacts", `ios-${audit ? "audit" : "native"}-${Date.now()}.xcresult`),
          "test",
        ]
      : ["build"]),
  ], root, target === "ios-test" ? () => {
    // Save the app's passive UIKit observer even when XCTest fails. No input
    // is injected here, and the original xcodebuild result is left unchanged.
    const file = join(root,"artifacts",`ios-native-input-${Date.now()}.json`);
    writeFileSync(file,JSON.stringify(collectIosNativeInput(testDeviceUDID,nativeInputStartedAt),null,2)+"\n");
    console.log(`iOS native input log: ${file}`);
  } : undefined);
  console.log(
    simulator
      ? `iOS 模拟器产物：artifacts/${audit ? "ios-audit" : "ios"}/Build/Products/Debug-iphonesimulator/App.app`
      : signed
        ? "iOS 开发签名产物：artifacts/ios-signed/Build/Products/Debug-iphoneos/App.app"
        : "iOS 真机未签名产物：artifacts/ios-device/Build/Products/Debug-iphoneos/App.app；安装到真机前须由开发者签名。",
  );
}
