package com.wendao.poker;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Build;
import android.os.Debug;
import android.os.SystemClock;
import android.security.NetworkSecurityPolicy;
import android.util.Base64;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Opt-in emulator audit. Touch events unlock real Web Audio; frames come from the actual WebView. */
@RunWith(AndroidJUnit4.class)
public class NativeAuditTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private MainActivity activity;
    private String js(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue(done.await(5, TimeUnit.SECONDS)); return result.get();
    }
    private void until(String predicate) throws Exception {
        untilFor(predicate, 20000, 80);
    }
    private void untilFor(String predicate, long timeoutMs, long pollingMs) throws Exception {
        long end = SystemClock.elapsedRealtime() + timeoutMs;
        while (SystemClock.elapsedRealtime() < end) { if ("true".equals(js("Boolean(" + predicate + ")"))) return; Thread.sleep(pollingMs); }
        fail("Native audit condition timed out: " + predicate);
    }
    private void tap(String selector) throws Exception {
        JSONArray point = new JSONArray(js("(()=>{const r=document.querySelector('" + selector + "').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth]})()"));
        int[] origin = new int[2]; float[] scale = new float[1];
        instrumentation.runOnMainSync(() -> { activity.getBridge().getWebView().getLocationOnScreen(origin); scale[0] = activity.getBridge().getWebView().getWidth(); });
        float ratio = scale[0] / (float) point.getDouble(2), x = origin[0] + (float) point.getDouble(0) * ratio, y = origin[1] + (float) point.getDouble(1) * ratio;
        long time = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(time,time,MotionEvent.ACTION_DOWN,x,y,0); down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        assertTrue(instrumentation.getUiAutomation().injectInputEvent(down, false)); down.recycle(); Thread.sleep(60);
        MotionEvent up = MotionEvent.obtain(time,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x,y,0); up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        assertTrue(instrumentation.getUiAutomation().injectInputEvent(up, false)); up.recycle();
    }
    private int pss() { Debug.MemoryInfo memory = new Debug.MemoryInfo(); Debug.getMemoryInfo(memory); return memory.getTotalPss(); }

    private void saveCheckpoint(JSONObject report) throws Exception {
        try (FileOutputStream file = instrumentation.getTargetContext().openFileOutput("native-audit.json",0)) { file.write(report.toString(2).getBytes(StandardCharsets.UTF_8)); }
    }

    private void emitReport(JSONObject report) {
        byte[] bytes = report.toString().getBytes(StandardCharsets.UTF_8); int total = (bytes.length + 1599) / 1600;
        for (int i = 0; i < total; i++) System.out.println("Native runtime audit part " + (i + 1) + "/" + total + ": " + Base64.encodeToString(Arrays.copyOfRange(bytes, i * 1600, Math.min(bytes.length, (i + 1) * 1600)), Base64.NO_WRAP));
    }

    private void verifyMemoryParserGuards() throws Exception {
        String root = "  *APP* UID 10212 ProcessRecord{aaa 100:com.wendao.poker/u0a212}\n    mConnections:\n      - ConnectionRecord{bbb u0 CR com.wendao.poker/org.chromium.content.app.SandboxedProcessService0:0:@abc}\n";
        String valid = "  *APP* UID 99001 ProcessRecord{bbb 101:com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0/u0a212i1}\n    user #0 uid=10212 ISOLATED uid=99001 gids={}\n    packageList={com.wendao.poker}\n    Services:\n      - ServiceRecord{ccc u0 com.wendao.poker/org.chromium.content.app.SandboxedProcessService0:0 c:com.wendao.poker}\n";
        String wrongPackage = valid.replace(" 101:", " 102:").replace("packageList={com.wendao.poker}", "packageList={com.wendao.poker2}");
        String wrongHost = valid.replace(" 101:", " 103:").replace("uid=10212 ISOLATED", "uid=10213 ISOLATED");
        String unbound = valid.replace(" 101:", " 104:").replace("SandboxedProcessService0:0", "SandboxedProcessService1:0");
        JSONArray selected = NativeProcessMemory.select(root + wrongPackage + wrongHost + unbound + valid, 100, "com.wendao.poker");
        assertEquals(2, selected.length()); assertEquals(101, selected.getJSONObject(1).getInt("pid"));
        try { NativeProcessMemory.select(root + wrongPackage + wrongHost + unbound, 100, "com.wendao.poker"); fail("Unrelated renderers must not satisfy the memory gate"); }
        catch (IllegalStateException expected) { }
        JSONObject memory = NativeProcessMemory.parseMemory("** MEMINFO in pid 101 [renderer] **\n TOTAL PSS: 123 TOTAL RSS: 456", 101);
        assertEquals(123L * 1024, memory.getLong("pssBytes")); assertEquals(456L * 1024, memory.getLong("rssBytes"));
        try { NativeProcessMemory.parseMemory("** MEMINFO in pid 999 [reused] **\n TOTAL PSS: 123 TOTAL RSS: 456", 101); fail("Mismatched PID must fail"); }
        catch (IllegalStateException expected) { }
        try { NativeProcessMemory.parseMemory("** MEMINFO in pid 101 [renderer] **\nPermission Denial", 101); fail("Missing totals must fail rather than read as zero"); }
        catch (IllegalStateException expected) { }
    }

    private JSONObject extendedSoak(String token) throws Exception {
        JSONObject soak = new JSONObject().put("requestedCycles", 15).put("completedCycles", 0).put("passed", false).put("runToken", token);
        JSONArray rounds = new JSONArray(); soak.put("rounds", rounds);
        try {
            soak.put("memoryBefore", NativeProcessMemory.collect(instrumentation)); saveCheckpoint(soak);
            long previousStarts = new JSONObject(js("window.__wendaoAudit.report()")).getLong("starts");
            for (int cycle = 1; cycle <= 15; cycle++) {
                if ("true".equals(js("document.querySelector('#audit-panel').hidden"))) tap("#audit-open");
                until("!document.querySelector('#audit-panel').hidden && !document.querySelector('#audit-run').disabled");
                js("window.__auditRunTrusted=null;document.querySelector('#audit-run').addEventListener('click',e=>window.__auditRunTrusted=e.isTrusted,{once:true})");
                tap("#audit-run"); until("window.__auditRunTrusted===true && document.querySelector('#audit-status').dataset.phase==='running'");
                untilFor("['complete','failed'].includes(document.querySelector('#audit-status').dataset.phase)", 110000, 750);
                JSONObject measurements = new JSONObject(js("JSON.parse(document.querySelector('#audit-report').textContent.slice(6))"));
                String status = new JSONArray(js("[document.querySelector('#audit-status').dataset.phase]")).getString(0);
                JSONObject round = new JSONObject().put("cycle", cycle).put("status", status).put("measurements", measurements);
                rounds.put(round); saveCheckpoint(soak);
                assertEquals("complete", status); assertTrue(measurements.getLong("elapsedMs") >= 65000);
                assertTrue(measurements.getInt("frames") >= 1000); assertTrue(measurements.getInt("busyFrames") >= 30); assertTrue(measurements.getInt("completedHands") >= 2);
                assertTrue(measurements.getLong("starts") > previousStarts); previousStarts = measurements.getLong("starts");
                assertEquals("[\"suspended\"]", measurements.getJSONArray("audioStates").toString());
                JSONObject memory = NativeProcessMemory.collect(instrumentation); round.put("memory", memory);
                soak.put("completedCycles", cycle); saveCheckpoint(soak);
                JSONObject progress = new JSONObject().put("runToken", token).put("cycle", cycle).put("hands", measurements.getInt("completedHands"))
                    .put("elapsedMs", measurements.getLong("elapsedMs")).put("p95Ms", measurements.getDouble("p95Ms")).put("maxMs", measurements.getDouble("maxMs"))
                    .put("gapsOver50Ms", measurements.getInt("gapsOver50Ms")).put("pssBytesSum", memory.getLong("pssBytesSum")).put("rssBytesSum", memory.getLong("rssBytesSum"))
                    .put("processes", memory.getJSONArray("processes"));
                Log.i("WendaoSoak", "ROUND " + progress.toString());
                Thread.sleep(2000);
            }
            soak.put("passed", true); saveCheckpoint(soak);
            JSONObject report = new JSONObject(rounds.getJSONObject(14).getJSONObject("measurements").toString());
            return report.put("soak", soak);
        } catch (Throwable error) {
            soak.put("error", error.toString()); saveCheckpoint(soak); emitReport(soak); throw error;
        }
    }

    private JSONObject sampleIdle() throws Exception {
        js("window.__wendaoAudit.reset()");
        Thread.sleep(16000);
        return new JSONObject(js("window.__wendaoAudit.report()"));
    }

    private JSONObject graphicsComparison() throws Exception {
        until("document.querySelector('#live-table').dataset.busy==='false'");
        JSONObject comparison = new JSONObject();
        comparison.put("scope", "Sequential idle-scene controls in the same emulator; no phone or GPU presentation claim");
        comparison.put("normalScene", sampleIdle());
        js("(()=>{const s=document.createElement('style');s.id='audit-without-grain';s.textContent='.game-shell:before{background-image:none!important}';document.head.append(s)})()");
        Thread.sleep(1000);
        comparison.put("withoutGrain", sampleIdle());
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().loadDataWithBaseURL(
            "https://localhost", "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='background:#13271e;color:#ddc893'>Native WebView frame control<script>window.control=[];let p=0;function f(n){if(p)control.push(n-p);p=n;requestAnimationFrame(f)}requestAnimationFrame(f)</script>",
            "text/html", "UTF-8", null));
        until("window.control && window.control.length>2");
        Thread.sleep(16000);
        comparison.put("minimalPage", new JSONObject(js("(()=>{const s=control.slice().sort((a,b)=>a-b);return {frames:s.length,p50Ms:s[Math.ceil(s.length*.5)-1],p95Ms:s[Math.ceil(s.length*.95)-1],gapsOver50Ms:s.filter(v=>v>50).length}})()")));
        return comparison;
    }

    @Test public void audioLifecycleAndSustainedFrames() throws Exception {
        assumeTrue("Explicit audit command only", "runtime-audit".equals(InstrumentationRegistry.getArguments().getString("phase")));
        assumeTrue("Emulator only", Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk") || Build.PRODUCT.contains("sdk"));
        verifyMemoryParserGuards();
        String cycles = InstrumentationRegistry.getArguments().getString("soakCycles", "1");
        assertTrue("Supported soak cycles: 1 or 15", cycles.equals("1") || cycles.equals("15"));
        String token = InstrumentationRegistry.getArguments().getString("auditRunToken", "local-audit");
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity = (MainActivity) instrumentation.startActivitySync(intent);
        try {
            until("window.__wendaoAudit && !document.querySelector('#app').inert && !document.querySelector('#start').disabled");
            assertEquals("0", js("window.__wendaoAudit.report().audioStates.length"));
            tap("#sound"); until("window.__wendaoAudit.report().audioStates.includes('running')");
            js("document.querySelector(!document.querySelector('#resume').hidden?'#resume':document.querySelector('#live-table').dataset.street==='complete'?'#next':'#start').click()");
            until("document.querySelector('#live-table').dataset.actor==='0' && document.querySelector('#live-table').dataset.busy==='false'");
            String hand = js("document.querySelector('#live-table').getAttribute('aria-label')");
            instrumentation.getTargetContext().startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Thread.sleep(1500);
            instrumentation.getTargetContext().startActivity(new Intent(instrumentation.getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
            until("!document.hidden && !document.querySelector('#resume').hidden && window.__wendaoAudit.report().audioStates.includes('suspended')");
            assertEquals(hand, js("document.querySelector('#live-table').getAttribute('aria-label')"));
            tap("#resume"); until("window.__wendaoAudit.report().audioStates.includes('running')");
            tap("#sound"); until("window.__wendaoAudit.report().audioStates.includes('suspended')");
            tap("#sound"); until("window.__wendaoAudit.report().audioStates.includes('running')");
            JSONObject report;
            if (cycles.equals("15")) report = extendedSoak(token);
            else {
            int memoryBefore = pss(); js("window.__wendaoAudit.reset()");
            long end = SystemClock.elapsedRealtime() + 65000;
            while (SystemClock.elapsedRealtime() < end) {
                js("(()=>{const t=document.querySelector('#live-table');if(t.dataset.busy==='true')return;if(t.dataset.street==='complete')document.querySelector('#next').click();else if(!document.querySelector('#resume').hidden)document.querySelector('#resume').click();else if(t.dataset.actor==='0'&&!document.querySelector('#call').disabled)document.querySelector('#call').click()})()");
                Thread.sleep(180);
            }
            tap("#sound"); until("window.__wendaoAudit.report().audioStates.includes('suspended')");
            report = new JSONObject(js("window.__wendaoAudit.report()"));
            report.put("appProcessPssStartKb",memoryBefore); report.put("appProcessPssEndKb",pss());
            report.put("memoryScope","app process PSS; excludes separate renderer processes; not a leak verdict");
            }
            report.put("environment", "Android API " + Build.VERSION.SDK_INT + " emulator").put("runToken", token).put("memoryParserGuardsPassed", true);
            assertTrue(report.getInt("elapsedMs") >= 65000); assertTrue(report.getInt("frames") >= 1000);
            assertTrue(report.getInt("busyFrames") >= 30); assertTrue(report.getInt("completedHands") >= 2);
            assertTrue(report.getInt("starts") > 3); assertTrue(report.getInt("hidden") > 0); assertTrue(report.getInt("suspends") > 0);
            boolean livePassed = true;
            if ("true".equals(InstrumentationRegistry.getArguments().getString("liveCoach"))) {
                report.put("loopbackCleartextAllowed", NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted("127.0.0.1"));
                js("window.__nativeCoachHealth=null;fetch('http://127.0.0.1:8787/health',{signal:AbortSignal.timeout(4000)}).then(async r=>window.__nativeCoachHealth={status:r.status,body:await r.text(),origin:location.origin}).catch(e=>window.__nativeCoachHealth={error:String(e),origin:location.origin})");
                until("window.__nativeCoachHealth");
                report.put("gatewayHealth",new JSONObject(js("window.__nativeCoachHealth")));
                js("document.querySelector('#coach-open').click();document.querySelector('[data-coach-topic=price]').click()");
                try { until("document.querySelector('#coach-source').textContent.includes('AI 解读')"); }
                catch (AssertionError error) { livePassed = false; }
                report.put("liveAI",new JSONObject().put("passed",livePassed).put("source",js("document.querySelector('#coach-source').textContent")).put("reply",js("document.querySelector('#coach-reply').textContent")));
            }
            if ("true".equals(InstrumentationRegistry.getArguments().getString("graphicsCompare"))) report.put("graphicsComparison", graphicsComparison());
            saveCheckpoint(report); emitReport(report);
            assertTrue("The real model must reply through the native mentor UI", livePassed);
        } finally { instrumentation.runOnMainSync(() -> activity.finish()); }
    }
}
