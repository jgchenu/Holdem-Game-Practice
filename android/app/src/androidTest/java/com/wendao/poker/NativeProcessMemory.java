package com.wendao.poker;

import android.app.Instrumentation;
import android.os.ParcelFileDescriptor;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/** Test-only system diagnostics; never infer WebView ownership from its name alone. */
final class NativeProcessMemory {
    private static final Pattern HEADER = Pattern.compile("(?m)^  \\*APP\\* UID (\\d+) ProcessRecord\\{\\S+ (\\d+):([^/]+)/[^}]+\\}\\r?$");
    private static final class Entry {
        int uid, pid, start, end; String name, body;
    }

    static JSONArray select(String dump, int rootPid, String packageName) throws Exception {
        ArrayList<Entry> entries = new ArrayList<>();
        Matcher headers = HEADER.matcher(dump);
        while (headers.find()) {
            Entry e = new Entry(); e.uid = Integer.parseInt(headers.group(1)); e.pid = Integer.parseInt(headers.group(2));
            e.name = headers.group(3); e.start = headers.start(); e.end = headers.end(); entries.add(e);
        }
        Entry root = null;
        for (int i = 0; i < entries.size(); i++) {
            Entry e = entries.get(i); int end = i + 1 < entries.size() ? entries.get(i + 1).start : dump.length();
            int isolated = dump.indexOf("\n  Isolated process list", e.end);
            if (isolated >= 0 && isolated < end) end = isolated;
            e.body = dump.substring(e.end, end);
            if (e.pid == rootPid && e.name.equals(packageName)) root = e;
        }
        if (root == null) throw new IllegalStateException("Missing actual app root in ActivityManager");
        Pattern component = Pattern.compile(Pattern.quote(packageName) + "/org\\.chromium\\.content\\.app\\.SandboxedProcessService\\d+:\\d+(?=:@|\\s|})");
        Set<String> bound = new HashSet<>(); Matcher connections = component.matcher(root.body);
        while (connections.find()) bound.add(connections.group());
        if (bound.isEmpty()) throw new IllegalStateException("App has no bound WebView sandbox service");
        JSONArray selected = new JSONArray().put(new JSONObject().put("pid", root.pid).put("uid", root.uid).put("name", root.name).put("role", "app"));
        for (Entry e : entries) {
            if (!e.name.contains(":sandboxed_process")) continue;
            Matcher packages = Pattern.compile("(?m)^    packageList=\\{([^}]*)}").matcher(e.body);
            boolean owns = false;
            if (packages.find()) for (String name : packages.group(1).split(",\\s*")) if (name.equals(packageName)) owns = true;
            if (!owns || !Pattern.compile("(?m)^    user #\\d+ uid=" + root.uid + " ISOLATED uid=" + e.uid + "(?:\\s|$)").matcher(e.body).find()) continue;
            Matcher services = component.matcher(e.body); String binding = null;
            while (services.find()) if (bound.contains(services.group())) { binding = services.group(); break; }
            if (binding != null) selected.put(new JSONObject().put("pid", e.pid).put("uid", e.uid).put("name", e.name).put("role", "bound-WebView-renderer").put("boundService", binding));
        }
        if (selected.length() < 2) throw new IllegalStateException("No renderer with matching package, host UID and service binding");
        return selected;
    }

    static JSONObject parseMemory(String text, int expectedPid) throws Exception {
        Matcher pid = Pattern.compile("\\*\\* MEMINFO in pid (\\d+) ").matcher(text);
        if (!pid.find() || Integer.parseInt(pid.group(1)) != expectedPid) throw new IllegalStateException("Missing or mismatched memory PID");
        Matcher pss = Pattern.compile("TOTAL PSS:\\s*(\\d+)").matcher(text), rss = Pattern.compile("TOTAL RSS:\\s*(\\d+)").matcher(text);
        if (!pss.find() || !rss.find()) throw new IllegalStateException("Memory totals unavailable; do not substitute zero");
        long pssBytes = Long.parseLong(pss.group(1)) * 1024L, rssBytes = Long.parseLong(rss.group(1)) * 1024L;
        if (pssBytes <= 0 || rssBytes <= 0) throw new IllegalStateException("Active process memory totals must be measured, not zero");
        return new JSONObject().put("pssBytes", pssBytes).put("rssBytes", rssBytes);
    }

    private static String shell(Instrumentation instrumentation, String command) throws Exception {
        ParcelFileDescriptor descriptor = instrumentation.getUiAutomation().executeShellCommand(command);
        try (ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int size;
            while ((size = input.read(buffer)) != -1) {
                output.write(buffer, 0, size);
                if (output.size() > 2 * 1024 * 1024) throw new IllegalStateException("System diagnostic exceeds bound");
            }
            return output.toString("UTF-8");
        }
    }

    static JSONObject collect(Instrumentation instrumentation) throws Exception {
        String packageName = instrumentation.getTargetContext().getPackageName();
        if (!packageName.equals("com.wendao.poker")) throw new IllegalStateException("Only our test app can be measured");
        int rootPid = android.os.Process.myPid();
        String command = "dumpsys activity processes " + packageName;
        JSONArray group = select(shell(instrumentation, command), rootPid, packageName);
        long pss = 0, rss = 0;
        for (int i = 0; i < group.length(); i++) {
            JSONObject process = group.getJSONObject(i);
            JSONObject memory = parseMemory(shell(instrumentation, "dumpsys meminfo -s " + process.getInt("pid")), process.getInt("pid"));
            process.put("pssBytes", memory.getLong("pssBytes")).put("rssBytes", memory.getLong("rssBytes"));
            pss += memory.getLong("pssBytes"); rss += memory.getLong("rssBytes");
        }
        JSONArray after = select(shell(instrumentation, command), rootPid, packageName);
        Set<Integer> beforePids = new HashSet<>(), afterPids = new HashSet<>();
        for (int i = 0; i < group.length(); i++) beforePids.add(group.getJSONObject(i).getInt("pid"));
        for (int i = 0; i < after.length(); i++) afterPids.add(after.getJSONObject(i).getInt("pid"));
        if (!beforePids.equals(afterPids)) throw new IllegalStateException("Process cohort changed during memory sampling");
        return new JSONObject().put("atUnixMs", System.currentTimeMillis()).put("complete", true).put("processes", group).put("pssBytesSum", pss).put("rssBytesSum", rss)
            .put("scope", "App plus isolated WebView renderer matched by package, host UID and bound service; excludes shared WebView provider/zygote. dumpsys meminfo system sampling, no explicit heap dump/GC request; RSS can double-count shared pages, not phone/GPU memory or a leak verdict.");
    }
}
