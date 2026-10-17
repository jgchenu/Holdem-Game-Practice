package com.wendao.poker;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/** Runs against the installed native WebView and Preferences bridge, not a desktop browser. */
@RunWith(AndroidJUnit4.class)
public class PracticeInstrumentedTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private MainActivity activity;

    private void launch() {
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity = (MainActivity) instrumentation.startActivitySync(intent);
    }

    private String js(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(script, result -> {
            value.set(result); done.countDown();
        }));
        assertTrue("WebView JavaScript callback timed out", done.await(5, TimeUnit.SECONDS));
        return value.get();
    }

    private void until(String predicate) throws Exception {
        long deadline = System.currentTimeMillis() + 20000;
        while (System.currentTimeMillis() < deadline) {
            if ("true".equals(js("Boolean(" + predicate + ")"))) return;
            Thread.sleep(60);
        }
        fail("Native WebView condition timed out: " + predicate);
    }

    private void idle() throws Exception {
        until("document.querySelector('#live-table')?.dataset.busy === 'false'");
    }

    @Test public void nativeGameplayPersistsAcrossActivityRecreation() throws Exception {
        // This test owns emulator data only; never overwrite a person's practice session on a phone.
        assumeTrue("Isolated native tests require an emulator", Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk") || Build.PRODUCT.contains("sdk"));
        Context context = instrumentation.getTargetContext();
        context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
            .putString("wendao:practice:v1", "null")
            .putString("wendao:preferences:v1", "{\"sound\":false,\"reducedMotion\":true,\"quality\":\"balanced\"}")
            .commit();
        launch();
        try {
            until("document.querySelector('#start') && !document.querySelector('#start').disabled");
            js("document.querySelector('#start').click()");
            idle();
            until("document.querySelector('#live-table').dataset.actor === '0'");
            assertEquals("true", js("document.querySelector('#call').getBoundingClientRect().bottom <= innerHeight"));
            String before = js("JSON.stringify({label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent})");
            assertNotNull(context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).getString("wendao:practice:v1", null));

            instrumentation.runOnMainSync(() -> activity.finish());
            instrumentation.waitForIdleSync();
            launch();
            idle();
            until("document.querySelector('#resume') && !document.querySelector('#resume').hidden");
            assertEquals(before, js("JSON.stringify({label:document.querySelector('#live-table').getAttribute('aria-label'),wallet:document.querySelector('#wallet').textContent})"));
            js("document.querySelector('#resume').click()"); idle();
            js("document.querySelector('#raise').click()");
            until("document.querySelector('#raise-dialog').open");
            assertEquals("true", js("document.querySelector('#raise-confirm').getBoundingClientRect().bottom <= innerHeight"));
            js("document.querySelector('#raise-dialog').close()");
            int actions = 0;
            while (!"\"complete\"".equals(js("document.querySelector('#live-table').dataset.street"))) {
                assertTrue("Practice hand must terminate", ++actions < 40);
                until("!document.querySelector('#call').disabled");
                js("document.querySelector('#call').click()"); idle();
            }
            js("document.querySelector('#review').click()");
            until("document.querySelector('#review-dialog').open");
            assertEquals("true", js("document.querySelectorAll('.action-history li').length > 0"));
        } finally {
            instrumentation.runOnMainSync(() -> activity.finish());
        }
    }
}
