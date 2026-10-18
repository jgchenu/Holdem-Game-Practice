package com.wendao.poker;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Build;
import android.os.Debug;
import android.os.SystemClock;
import android.security.NetworkSecurityPolicy;
import android.view.InputDevice;
import android.view.MotionEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
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
        long end = SystemClock.elapsedRealtime() + 20000;
        while (SystemClock.elapsedRealtime() < end) { if ("true".equals(js("Boolean(" + predicate + ")"))) return; Thread.sleep(80); }
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
            int memoryBefore = pss(); js("window.__wendaoAudit.reset()");
            long end = SystemClock.elapsedRealtime() + 65000;
            while (SystemClock.elapsedRealtime() < end) {
                js("(()=>{const t=document.querySelector('#live-table');if(t.dataset.busy==='true')return;if(t.dataset.street==='complete')document.querySelector('#next').click();else if(!document.querySelector('#resume').hidden)document.querySelector('#resume').click();else if(t.dataset.actor==='0'&&!document.querySelector('#call').disabled)document.querySelector('#call').click()})()");
                Thread.sleep(180);
            }
            tap("#sound"); until("window.__wendaoAudit.report().audioStates.includes('suspended')");
            JSONObject report = new JSONObject(js("window.__wendaoAudit.report()"));
            report.put("environment", "Android API " + Build.VERSION.SDK_INT + " emulator");
            report.put("appProcessPssStartKb",memoryBefore); report.put("appProcessPssEndKb",pss());
            report.put("memoryScope","app process PSS; excludes separate renderer processes; not a leak verdict");
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
            try (FileOutputStream file = instrumentation.getTargetContext().openFileOutput("native-audit.json",0)) { file.write(report.toString(2).getBytes(StandardCharsets.UTF_8)); }
            System.out.println("Native runtime audit: " + report.toString());
            assertTrue("The real model must reply through the native mentor UI", livePassed);
        } finally { instrumentation.runOnMainSync(() -> activity.finish()); }
    }
}
