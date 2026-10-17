// Native Windows CI test through Tauri's standard WebDriver bridge, not a browser substitute.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

if (process.platform !== "win32")
  throw new Error("This native smoke test requires Windows.");
const application =
  process.env.TAURI_SMOKE_APP || resolve("src-tauri/target/release/app.exe");
if (!existsSync(application))
  throw new Error(`Application missing: ${application}`);
const output = resolve("artifacts/windows-native");
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "result.json"), JSON.stringify({ passed: false, status: "not completed" }));
// These are the native WebView2 capabilities used by Tauri's Windows bridge.
// Start Microsoft's driver directly to preserve verbose launch diagnostics.
const bridge = spawn("msedgedriver.exe", ["--port=4444", "--verbose"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, TAURI_WEBVIEW_AUTOMATION: "true" },
});
let logs = "";
bridge.stdout.on("data", (data) => {
  logs += data;
});
bridge.stderr.on("data", (data) => {
  logs += data;
});
let startupError;
bridge.on("error", (error) => {
  startupError = error;
});
let session;
let appProcess;
async function command(
  path,
  body,
  method = body === undefined ? "GET" : "POST",
) {
  console.log(`WebDriver ${method} ${path}`);
  let response;
  try {
    response = await fetch("http://127.0.0.1:4444" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(
        path === "/session" ? 120_000 : path === "/status" ? 2_000 : 30_000,
      ),
    });
  } catch (error) {
    throw new Error(`WebDriver ${method} ${path}: ${error.message}`);
  }
  const result = await response.json();
  if (!response.ok || result.value?.error)
    throw new Error(JSON.stringify(result));
  return result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 30_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    if (startupError) throw startupError;
    try {
      if (await predicate()) return;
    } catch (error) {
      last = error;
    }
    await sleep(100);
  }
  throw new Error(`Timeout: ${label}${last ? " " + last.message : ""}`);
}
const execute = (script) =>
  command(`/session/${session}/execute/sync`, { script, args: [] });
async function click(selector) {
  const value = await command(`/session/${session}/element`, {
    using: "css selector",
    value: selector,
  });
  const id = value["element-6066-11e4-a52e-4f735466cecf"];
  await command(`/session/${session}/element/${id}/click`, {});
}
const idle = () =>
  until(
    () =>
      execute(
        "return document.querySelector('#live-table')?.dataset.busy === 'false'",
      ),
    "animations finish",
  );
async function screenshot(name) {
  const bytes = await command(`/session/${session}/screenshot`);
  writeFileSync(join(output, name + ".png"), Buffer.from(bytes, "base64"));
}
async function debugEndpointAvailable() {
  try {
    const response = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(2000) });
    return response.ok && !!(await response.json()).webSocketDebuggerUrl;
  } catch { return false; }
}
async function launchNative() {
  assert.equal(await debugEndpointAvailable(), false, "The test-only port must be free before starting our app");
  // WebView2 133+ has a known WebDriver launch-mode regression. Attach to the
  // installed app's own loopback DevTools endpoint instead of downgrading its runtime.
  appProcess = spawn(application, [], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      TAURI_WEBVIEW_AUTOMATION: "true",
      WENDAO_TEST_DEBUG_PORT: "9222",
      WENDAO_TEST_PROFILE: resolve("artifacts/.windows-test-profile"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
      WEBVIEW2_USER_DATA_FOLDER: resolve("artifacts/.windows-test-profile"),
    },
  });
  appProcess.on("error", (error) => {
    startupError = error;
  });
  appProcess.on("exit", (code) => {
    logs += `\nApplication exit: ${code}\n`;
  });
  appProcess.stdout.on("data", (data) => {
    logs += data;
  });
  appProcess.stderr.on("data", (data) => {
    logs += data;
  });
  await until(
    debugEndpointAvailable,
    "installed app exposes its test-only DevTools endpoint",
    60_000,
  );
  const created = await command("/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "webview2",
        "ms:edgeChromium": true,
        "ms:edgeOptions": { debuggerAddress: "127.0.0.1:9222" },
      },
    },
  });
  session = created.sessionId;
  assert.ok(session, "Native session must exist");
  await until(
    () =>
      execute(
        "return !!document.querySelector('#start') && !document.querySelector('#start').disabled",
      ),
    "native page initializes",
  );
  assert.equal(await execute("return '__TAURI_INTERNALS__' in window"), true, "The session must target the native Tauri client");
}
try {
  await until(async () => { await command("/status"); return true; }, "Tauri driver starts");
  await launchNative();
  // The CI machine has an isolated user profile. These are test fixtures, never a user's save.
  await execute(
    "localStorage.setItem('wendao:preferences:v1',JSON.stringify({sound:false,reducedMotion:true,quality:'balanced'}));localStorage.removeItem('wendao:practice:v1');localStorage.setItem('wendao:learning:v1','[\"ranks\",\"actions\",\"position\"]');localStorage.removeItem('wendao:trials:v1');",
  );
  await command(`/session/${session}/refresh`, {});
  await until(
    () =>
      execute(
        "return !!document.querySelector('#start') && !document.querySelector('#start').disabled",
      ),
    "fresh native profile",
  );
  await click("#start");
  await idle();
  await until(
    () => execute("return !document.querySelector('#call').disabled"),
    "hero turn",
  );
  await click("#raise");
  await until(
    () => execute("return document.querySelector('#raise-dialog').open"),
    "raise sheet",
  );
  assert.equal(
    await execute(
      "return document.querySelector('#raise-confirm').getBoundingClientRect().bottom <= innerHeight",
    ),
    true,
  );
  await screenshot("raise");
  await click("#raise-confirm");
  await idle();
  const before = await execute(
    "return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent}",
  );
  if (
    await execute(
      "return document.querySelector('#live-table').dataset.street !== 'complete'",
    )
  ) {
    await command(`/session/${session}/refresh`, {});
    await idle();
    await until(
      () => execute("return !document.querySelector('#resume').hidden"),
      "resume after native reload",
    );
    assert.deepEqual(
      await execute(
        "return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent}",
      ),
      before,
    );
    await click("#resume");
    await idle();
  }
  let actions = 0;
  while (
    await execute(
      "return document.querySelector('#live-table').dataset.street !== 'complete'",
    )
  ) {
    assert.ok(++actions < 40, "The hand must terminate");
    await until(
      () => execute("return !document.querySelector('#call').disabled"),
      "call enabled",
    );
    await click("#call");
    await idle();
  }
  await screenshot("showdown");
  await click("#review");
  await until(
    () => execute("return document.querySelector('#review-dialog').open"),
    "review",
  );
  assert.equal(
    await execute(
      "return document.querySelectorAll('.action-history li').length > 0",
    ),
    true,
  );
  await click("#review-dialog .close-button");
  await command(`/session/${session}/window/rect`, { width: 360, height: 690 });
  assert.equal(
    await execute(
      "const r=document.querySelector('#next').getBoundingClientRect();return r.bottom <= innerHeight && r.height >= 44 && document.documentElement.scrollWidth <= innerWidth",
    ),
    true,
  );
  await screenshot("narrow-window");
  const trialBefore = await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent}");
  await click("#study");
  await click('[data-trial="free-check"]');
  await click("#trial-call");
  await until(() => execute("return document.querySelector('#trial-feedback')?.classList.contains('passed') && !document.querySelector('#trial-done').disabled"), "trial earns its seal");
  await screenshot("trial");
  await click("#trial-done");
  await click("#study-dialog .close-button");
  await command(`/session/${session}/refresh`, {});
  await idle();
  assert.deepEqual(await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent}"), trialBefore);
  await click("#study");
  await until(() => execute("return document.querySelector('[data-trial=free-check]')?.textContent.includes('已达成')"), "trial seal survives native reload");
  await click("#study-dialog .close-button");
  await click("#next");
  await idle();
  await until(() => execute("return !document.querySelector('#call').disabled"), "next hand reaches the hero");
  await click("#pause");
  const coldBefore = await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent,progress:document.querySelector('#progress').textContent}");
  const previous = appProcess;
  logs += execFileSync("taskkill.exe", ["/PID", String(previous.pid), "/T", "/F"], { encoding: "utf8", timeout: 15_000 });
  await until(() => previous.exitCode !== null || previous.signalCode !== null, "native app process exits", 15_000);
  await until(async () => !await debugEndpointAvailable(), "old native WebView process tree disappears", 15_000);
  const oldSession = session;
  session = undefined;
  try { await command(`/session/${oldSession}`, undefined, "DELETE"); } catch { /* The killed target may already have disconnected. */ }
  await launchNative();
  await idle();
  await until(() => execute("return !document.querySelector('#resume').hidden"), "cold launch restores the paused hand");
  const coldAfter = await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent,progress:document.querySelector('#progress').textContent}");
  assert.deepEqual(coldAfter, coldBefore, "The new native process must restore the same hand, wallet and courses");
  assert.notEqual(appProcess.pid, previous.pid, "Cold launch must use a new app process");
  const processRestart = { beforePid: previous.pid, afterPid: appProcess.pid, state: coldAfter };
  await screenshot("process-restored");
  await click("#study");
  await until(() => execute("return document.querySelector('[data-trial=free-check]')?.textContent.includes('已达成')"), "trial seal survives full native process death");
  await execute("document.querySelector('[data-trial=free-check]').scrollIntoView({block:'center'})");
  await screenshot("process-trial-restored");
  writeFileSync(
    join(output, "result.json"),
    JSON.stringify(
      {
        platform: process.platform,
        application,
        actions,
        processRestart,
        checks: [
          "native launch",
          "raise sheet",
          "reload persistence",
          "showdown",
          "public action review",
          "360px layout",
          "trial operation",
          "trial seal persistence",
          "trial wallet isolation",
          "native process tree stopped",
          "cold launch restores hand, wallet and courses",
          "cold launch restores trial seal",
        ],
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Windows native smoke passed: installed app, raise, reload, showdown, review, narrow window, trials and native process restart.",
  );
} catch (error) {
  writeFileSync(join(output, "result.json"), JSON.stringify({ passed: false, error: error.message }, null, 2));
  if (session) {
    try {
      await screenshot("failure");
    } catch {}
  }
  throw error;
} finally {
  if (session) {
    try {
      await command(`/session/${session}`, undefined, "DELETE");
    } catch {}
  }
  bridge.kill();
  appProcess?.kill();
  writeFileSync(join(output, "driver.log"), logs);
}
