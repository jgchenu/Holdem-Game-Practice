// Native Windows CI test through Tauri's standard WebDriver bridge, not a browser substitute.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { collectWindowsMemory } from './windows-process-memory.mjs';

if (process.platform !== "win32")
  throw new Error("This native smoke test requires Windows.");
const runtimeAudit = process.env.WENDAO_RUNTIME_AUDIT === "1";
const soakCycles = Number(process.env.WENDAO_SOAK_CYCLES || 1);
assert.ok(Number.isInteger(soakCycles) && soakCycles>=1 && soakCycles<=30,'Soak cycles must be 1..30');
const application =
  runtimeAudit ? resolve("src-tauri/target/release/app.exe") : process.env.TAURI_SMOKE_APP || resolve("src-tauri/target/release/app.exe");
if (!existsSync(application))
  throw new Error(`Application missing: ${application}`);
const output = resolve(runtimeAudit ? "artifacts/windows-runtime" : "artifacts/windows-native");
mkdirSync(output, { recursive: true });
const profiles = resolve("artifacts/.windows-test-profiles");
mkdirSync(profiles, { recursive: true });
const testProfile = mkdtempSync(join(profiles, "profile-"));
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
let coachFixture;
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
async function until(predicate, label, timeout = 30_000, pollMs = 100) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    if (startupError) throw startupError;
    try {
      if (await predicate()) return;
    } catch (error) {
      last = error;
    }
    await sleep(pollMs);
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
      WENDAO_TEST_PROFILE: testProfile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9222",
      WEBVIEW2_USER_DATA_FOLDER: testProfile,
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
async function verifyCoachTransport(state) {
  const before = await state();
  await click('#coach-open');
  await until(() => execute("return document.querySelector('#coach-dialog').open"), 'native mentor opens');
  const nativeOrigin = await execute('return location.origin');
  const checks = [];
  for (const [mode,topic,status] of [['success','price',200],['error','review',502],['timeout','situation',504]]) {
    coachFixture.setNextMode(mode);
    const count = coachFixture.report().gatewayRequests.filter(r => r.method==='POST').length;
    await click(`[data-coach-topic="${topic}"]`);
    await until(() => {
      const posts = coachFixture.report().gatewayRequests.filter(r => r.method==='POST');
      return posts.length === count+1 && posts.at(-1).status === status;
    }, `real native HTTP ${mode}`);
    await until(() => execute(`return document.querySelector('#coach-source').textContent.includes(${JSON.stringify(mode==='success'?'AI 解读':'AI 暂不可用')})`), `native mentor ${mode} response`);
    const reply = await execute("return document.querySelector('#coach-reply').textContent");
    assert.equal(reply.includes('fixture-server-only'),false,'Server credential must not reach client');
    assert.equal(reply.includes(coachFixture.label),mode==='success','Fixture success and real local fallback must differ');
    assert.ok(reply.length>0);
    assert.deepEqual(await state(),before,'Mentor transport must preserve the hand and wallet');
    checks.push({mode,status,source:await execute("return document.querySelector('#coach-source').textContent")});
    await screenshot(`coach-transport-${mode}`);
  }
  const observed = coachFixture.report();
  const posts = observed.gatewayRequests.filter(r => r.method==='POST');
  assert.equal(posts.length,3);
  assert.ok(posts.every(r => r.origin===nativeOrigin),'Native origin must actually traverse CORS');
  assert.ok(observed.upstreamRequests.every(r => r.playersHaveNoPrivateCards && r.serverCredentialPresent));
  await until(() => coachFixture.report().upstreamRequests.at(-1).disconnected,'timed-out upstream socket closes');
  const result = {passed:true,nativeOrigin,checks,...observed};
  writeFileSync(join(output,'coach-transport.json'),JSON.stringify(result,null,2));
  await click('#coach-dialog .close-button');
  await click('#resume');
  await until(() => execute("return !document.querySelector('#call').disabled"),'continue after mentor');
  return result;
}
async function verifyRuntime() {
  await until(() => execute("return !!window.__wendaoAudit"), "explicit native audit build");
  assert.deepEqual(await execute("return window.__wendaoAudit.report().audioStates"), [], "Audio must be lazy");
  await click('#sound');
  await until(() => execute("return window.__wendaoAudit.report().audioStates.includes('running')"), "real audio unlock");
  await click('#start'); await idle();
  await until(() => execute("return !document.querySelector('#call').disabled"), "hero turn before minimizing");
  const state = () => execute("return {hand:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent}");
  const coachTransport = coachFixture ? await verifyCoachTransport(state) : null;
  const before = await state();
  await command(`/session/${session}/window/minimize`, {});
  await until(() => execute("return window.__wendaoAudit.report().hidden>0 && window.__wendaoAudit.report().audioStates.includes('suspended')"), "native minimize suspends audio");
  await command(`/session/${session}/window/rect`, {width:460,height:920});
  await until(() => execute("return !document.hidden && !document.querySelector('#resume').hidden"), "native restore remains paused");
  assert.deepEqual(await state(), before, "Minimizing preserves the same hand and wallet");
  await click('#resume');
  await until(() => execute("return window.__wendaoAudit.report().audioStates.includes('running')"), "explicit continue resumes audio");
  await click('#sound');
  await until(() => execute("return window.__wendaoAudit.report().audioStates.includes('suspended')"), "mute suspends real context");
  const memory = () => collectWindowsMemory(appProcess.pid,testProfile);
  const memoryBefore = memory(), rounds = [];
  const started = Date.now();
  let status, measurements;
  let previousStarts = await execute('return window.__wendaoAudit.report().starts');
  for(let cycle=1;cycle<=soakCycles;cycle++) {
    if(await execute("return document.querySelector('#audit-panel').hidden")) await click('#audit-open');
    await click('#audit-run');
    await until(() => execute("return document.querySelector('#audit-status').dataset.phase==='running'"),`soak round ${cycle} starts`);
    await until(() => execute("return ['complete','failed'].includes(document.querySelector('#audit-status').dataset.phase)"), `soak round ${cycle} completes`, 110_000, 750);
    status = await execute("return {phase:document.querySelector('#audit-status').dataset.phase,text:document.querySelector('#audit-status').textContent}");
    measurements = await execute("return JSON.parse(document.querySelector('#audit-report').textContent.slice(6))");
    const round = {cycle,status,measurements,memory:null};
    // Preserve the real native frame report even if the subsequent OS query fails.
    const roundPath = join(output,`round-${String(cycle).padStart(2,'0')}.json`);
    writeFileSync(roundPath,JSON.stringify(round,null,2));
    round.memory = memory();
    writeFileSync(roundPath,JSON.stringify(round,null,2));
    rounds.push(round);
    // Preserve completed rounds even when a later round fails or the job ends.
    writeFileSync(join(output,'soak.json'),JSON.stringify({requestedCycles:soakCycles,completedCycles:rounds.length,elapsedMs:Date.now()-started,memoryBefore,rounds},null,2));
    assert.equal(status.phase,'complete',status.text);
    assert.ok(measurements.elapsedMs>=65_000 && measurements.frames>=1000 && measurements.completedHands>=2);
    assert.ok(measurements.starts>previousStarts,'Each round must actually generate sound, not reuse earlier counters');
    previousStarts=measurements.starts;
    assert.deepEqual(measurements.audioStates,['suspended']);
    console.log(`Native soak round ${cycle}/${soakCycles}: ${measurements.completedHands} hands, callback P95 ${measurements.p95Ms}ms, ${rounds.at(-1).memory.processes.length} processes, private ${rounds.at(-1).memory.privateBytesSum} bytes`);
  }
  const result = {passed:true,application,scope:'native Windows WebView2 audit binary; installed production client tested separately',status,measurements,coachTransport,
    soak:{requestedCycles:soakCycles,completedCycles:rounds.length,elapsedMs:Date.now()-started,totalHands:rounds.reduce((n,r)=>n+r.measurements.completedHands,0),rounds},
    memory:{before:memoryBefore,after:rounds.at(-1).memory,scope:memoryBefore.scope}};
  writeFileSync(join(output,'runtime.json'),JSON.stringify(result,null,2));
  await screenshot('continuous-runtime');
  writeFileSync(join(output,'result.json'),JSON.stringify(result,null,2));
}
try {
  if (runtimeAudit && process.env.WENDAO_COACH_FIXTURE === '1') {
    const {startCoachFixture} = await import('./coach-fixture.mjs');
    coachFixture = await startCoachFixture({port:8787});
  }
  await until(async () => { await command("/status"); return true; }, "Tauri driver starts");
  await launchNative();
  if (runtimeAudit) {
    await verifyRuntime();
  } else {
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
  await click("#tutorial-open");
  await click("#tutorial-next");
  await until(() => execute("return document.querySelector('#tutorial-step-title').textContent.includes('两张底牌') && !document.querySelector('#tutorial-next').disabled"), "beginner hole-card step");
  await click("#tutorial-hole");
  await until(() => execute("return document.querySelector('#tutorial-step-title').textContent.includes('字和图案') && !document.querySelector('#tutorial-next').disabled"), "beginner rank step");
  await click('.hand-guide > summary');
  assert.deepEqual(await execute("return {open:document.querySelector('.hand-guide').open,examples:document.querySelectorAll('.hand-guide-list > li').length,cards:document.querySelectorAll('.hand-guide-cards .trial-card').length}"), {open:true,examples:9,cards:45});
  await click('[data-hand-category="1"] .hand-guide-compare > summary');
  assert.equal(await execute("return document.querySelector('[data-hand-category=\"1\"] .hand-guide-compare').open"), true);
  assert.equal(await execute("return JSON.parse(localStorage.getItem('wendao:onboarding:v1')).step"), 2, "Hand reference must not advance the lesson");
  await screenshot('hand-guide-pair');
  await click('.hand-guide > summary');
  await click("#tutorial-next");
  await until(() => execute("return document.querySelector('#tutorial-step-title').textContent.includes('灵石池') && !document.querySelector('#tutorial-next').disabled"), "beginner progress checkpoint");
  await screenshot("beginner");
  await click("#tutorial-dialog .close-button");
  await click("#next");
  await idle();
  await until(() => execute("return !document.querySelector('#call').disabled"), "next hand reaches the hero");
  await click("#pause");
  const coldBefore = await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent,progress:document.querySelector('#progress').textContent,beginnerStep:JSON.parse(localStorage.getItem('wendao:onboarding:v1')).step}");
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
  const coldAfter = await execute("return {label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent,progress:document.querySelector('#progress').textContent,beginnerStep:JSON.parse(localStorage.getItem('wendao:onboarding:v1')).step}");
  assert.deepEqual(coldAfter, coldBefore, "The new native process must restore the same hand, wallet and courses");
  assert.notEqual(appProcess.pid, previous.pid, "Cold launch must use a new app process");
  const processRestart = { beforePid: previous.pid, afterPid: appProcess.pid, state: coldAfter };
  await screenshot("process-restored");
  await click("#study");
  await until(() => execute("return document.querySelector('[data-trial=free-check]')?.textContent.includes('已达成')"), "trial seal survives full native process death");
  await execute("document.querySelector('[data-trial=free-check]').scrollIntoView({block:'center'})");
  await screenshot("process-trial-restored");
  await click("#study-dialog .close-button");
  await click("#tutorial-open");
  await until(() => execute("return document.querySelector('#tutorial-step-title').textContent.includes('灵石池')"), "beginner step restored from native checkpoint");
  await screenshot("process-beginner-restored");
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
          "beginner guided steps",
          "nine hand examples and comparisons without advancing the lesson",
          "beginner progress survives native process death",
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
  }
} catch (error) {
  writeFileSync(join(output, "result.json"), JSON.stringify({ passed: false, error: error.message, memorySamplingFailure:error.samplingAttempts }, null, 2));
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
  if (appProcess?.pid && appProcess.exitCode === null) {
    try {
      execFileSync('taskkill.exe', ['/PID', String(appProcess.pid), '/T', '/F'], {stdio:'ignore',timeout:15_000});
    } catch { appProcess.kill(); }
  }
  writeFileSync(join(output, "driver.log"), logs);
  if (coachFixture) {
    writeFileSync(join(output,'coach-fixture-observations.json'),JSON.stringify(coachFixture.report(),null,2));
    await coachFixture.close();
  }
}
