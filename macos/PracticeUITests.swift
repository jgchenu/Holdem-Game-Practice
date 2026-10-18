import XCTest
import AppKit

@MainActor
final class PracticeUITests: XCTestCase {
    // macOS WebKit exposes visible button text as title; aria-label can be
    // exposed separately as label. Keep the same real control and first click.
    private func button(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "title CONTAINS %@ OR label CONTAINS %@", text, text)).firstMatch
    }

    // Check actual captured card pixels, separately from the canvas accessibility label.
    private func lightCardPixels(_ bitmap: NSBitmapImageRep) -> Int {
        var count = 0
        for y in stride(from: bitmap.pixelsHigh * 64 / 100, to: bitmap.pixelsHigh * 95 / 100, by: 2) {
            for x in stride(from: bitmap.pixelsWide / 5, to: bitmap.pixelsWide * 4 / 5, by: 2) {
                guard let color = bitmap.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
                if color.alphaComponent > 0.9 && color.redComponent > 0.78 && color.greenComponent > 0.72 && color.blueComponent > 0.5 { count += 1 }
            }
        }
        return count
    }

    private func capturedCardPixels(_ table: XCUIElement) throws -> Int {
        let deadline = Date().addingTimeInterval(20)
        var pixels = 0
        repeat {
            let bitmap = try XCTUnwrap(NSBitmapImageRep(data: table.screenshot().pngRepresentation))
            pixels = lightCardPixels(bitmap)
            if pixels > 100 { break }
            Thread.sleep(forTimeInterval: 1)
        } while Date() < deadline
        return pixels
    }

    func testOrdinaryFirstTeaching() throws {
        continueAfterFailure = false
        let fixture = try XCTUnwrap(NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 100, pixelsHigh: 100,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0))
        for y in 0..<100 { for x in 0..<100 { fixture.setColor(NSColor(deviceRed: 0, green: 0, blue: 0, alpha: 1), atX: x, y: y) } }
        XCTAssertEqual(lightCardPixels(fixture), 0, "A blank dark canvas must fail the pixel probe")
        for y in 65..<90 { for x in 35..<65 { fixture.setColor(NSColor(deviceRed: 1, green: 1, blue: 1, alpha: 1), atX: x, y: y) } }
        XCTAssertGreaterThan(lightCardPixels(fixture), 100, "A visible light card region must be measurable")
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        let file = root.appendingPathComponent("artifacts/macos-ci-ui/runtime.json")
        let config = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any])
        let path = try XCTUnwrap(config["application"] as? String)
        let owned = root.appendingPathComponent("artifacts/macos-ci-ui/app/问道牌途.app").standardizedFileURL.path
        guard config["ci"] as? Bool == true,
              URL(fileURLWithPath: path).standardizedFileURL.path == owned,
              FileManager.default.fileExists(atPath: path) else {
            XCTFail("Only the isolated CI copy may be launched"); return
        }
        let app = XCUIApplication(url: URL(fileURLWithPath: path))
        addTeardownBlock { await MainActor.run { app.terminate() } }
        app.launch(); app.activate()
        let entry = button(app, containing: "从零学德州")
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: entry)
        let result = XCTWaiter.wait(for: [ready], timeout: 60)
        if result != .completed { print(app.debugDescription) }
        XCTAssertEqual(result, .completed)
        entry.click()
        let opened = app.buttons["关闭新手教学"].waitForExistence(timeout: 20)
        if !opened { print(app.debugDescription) }
        XCTAssertTrue(opened, "The ordinary macOS first teaching click must work without retry")
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = "macos-ci-ordinary-first-teaching"; image.lifetime = .keepAlways; add(image)
        app.buttons["关闭新手教学"].click()
        let start = button(app, containing: "入席修炼")
        let actionable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: start)
        XCTAssertEqual(XCTWaiter.wait(for: [actionable], timeout: 30), .completed)
        start.click()
        let table = app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
        let dealt = table.waitForExistence(timeout: 20)
        if !dealt { print(app.debugDescription) }
        XCTAssertTrue(dealt, "The ordinary native table must actually expose the dealt hand")
        let cards = XCTAttachment(screenshot: app.screenshot())
        cards.name = "macos-ci-ordinary-dealt-table"; cards.lifetime = .keepAlways; add(cards)
        let pixels = try capturedCardPixels(table)
        let settled = XCTAttachment(screenshot: app.screenshot())
        settled.name = "macos-ci-card-pixels-\(pixels)"; settled.lifetime = .keepAlways; add(settled)
        print("Native screenshot hero-card light pixels: \(pixels); does not measure GPU FPS or full visual quality")
        XCTAssertGreaterThan(pixels, 100, "Dealt hand state must have visible card pixels in the actual native screenshot")
        print("Native macOS ordinary UI check; not a browser substitute or phone performance result")
    }
    func testIsolatedRuntimeSoak() throws {
        #if MAC_SOAK
        continueAfterFailure = false
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        let configFile = root.appendingPathComponent("artifacts/macos-xctest-soak/runtime.json")
        let config = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: configFile)) as? [String: Any])
        let runID = try XCTUnwrap(config["runID"] as? String)
        let mode = try XCTUnwrap(config["mode"] as? String)
        guard ["soak", "renderer-probe"].contains(mode) else { XCTFail("Unknown native audit mode"); return }
        guard UUID(uuidString: runID) != nil else { XCTFail("Invalid owned run ID"); return }
        let owned = root.appendingPathComponent("artifacts/macos-soak-target/release/bundle/macos/问道牌途长测.app")
        guard config["application"] as? String == owned.path,
              Bundle(url: owned)?.bundleIdentifier == "com.wendao.poker.soak.desktop" else {
            XCTFail("Only the separate soak bundle may be launched"); return
        }
        let output = root.appendingPathComponent("artifacts/macos-xctest-soak/\(runID)")
        func write(_ name: String, _ value: [String: Any]) throws {
            try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]).write(to: output.appendingPathComponent(name), options: .atomic)
        }
        func acknowledged(_ name: String) {
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                FileManager.default.fileExists(atPath: output.appendingPathComponent(name).path)
            }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed, "Host memory sample must complete before the next round")
        }
        let app = XCUIApplication(url: owned)
        addTeardownBlock { await MainActor.run { app.terminate() } }
        app.launch(); app.activate()
        let open = button(app, containing: "运行验收")
        let actionable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: open)
        XCTAssertEqual(XCTWaiter.wait(for: [actionable], timeout: 60), .completed)
        let settings = app.buttons["体验设置"]
        let interfaceReady = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: settings)
        XCTAssertEqual(XCTWaiter.wait(for: [interfaceReady], timeout: 60), .completed, "The main interface must leave its startup input guard before sampling")
        let table = app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
        if table.exists && mode == "soak" {
            XCTAssertGreaterThan(try capturedCardPixels(table), 100, "Saved hand must actually be visible in the native screenshot")
        }
        if mode == "renderer-probe" {
            if !table.exists {
                let start = button(app, containing: "入席修炼")
                let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: start)
                XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
                start.click(); XCTAssertTrue(table.waitForExistence(timeout: 20))
            }
            let pause = button(app, containing: "暂停")
            if pause.exists && pause.isEnabled { pause.click() }
            let bitmap = try XCTUnwrap(NSBitmapImageRep(data: table.screenshot().pngRepresentation))
            let nativePixels = lightCardPixels(bitmap)
            let tableFrameBefore = NSStringFromRect(table.frame), appFrameBefore = NSStringFromRect(app.frame)
            let appStateBefore = app.state.rawValue
            for (name, screenshot) in [("app-before-render-probe", app.screenshot()), ("screen-before-render-probe", XCUIScreen.main.screenshot())] {
                let attachment = XCTAttachment(screenshot: screenshot)
                attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
            }
            open.click()
            let probe = button(app, containing: "检查画布渲染")
            XCTAssertTrue(probe.waitForExistence(timeout: 20)); probe.click()
            let state = app.staticTexts.matching(NSPredicate(format: "value CONTAINS %@ OR label CONTAINS %@", "DRAWSTATE ", "DRAWSTATE ")).firstMatch
            let observed = state.waitForExistence(timeout: 20)
            if !observed { print(app.debugDescription) }
            XCTAssertTrue(observed)
            let text = [state.value as? String, state.label].compactMap { $0 }.first { $0.contains("DRAWSTATE ") }
            let start = try XCTUnwrap(text?.range(of: "DRAWSTATE ")?.upperBound)
            let suffix = try XCTUnwrap(text).suffix(from: start)
            let end = try XCTUnwrap(suffix.firstIndex(of: "}"))
            let facts = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(suffix[...end].utf8)) as? [String: Any])
            let record = XCTAttachment(data: try JSONSerialization.data(withJSONObject: facts), uniformTypeIdentifier: "public.json")
            record.name = "actual-renderer-probe-facts"; record.lifetime = .keepAlways; add(record)
            let after = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            after.name = "screen-with-labeled-backbuffer-readback"; after.lifetime = .keepAlways; add(after)
            button(app, containing: "收起验收").click()
            let restored = try XCTUnwrap(NSBitmapImageRep(data: table.screenshot().pngRepresentation))
            let original = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            original.name = "screen-original-canvas-after-readback"; original.lifetime = .keepAlways; add(original)
            try write("probe.json", ["runID": runID, "facts": facts, "nativeCardPixelsBeforeProbe": nativePixels,
                "nativeCardPixelsAfterReadback": lightCardPixels(restored), "tableFrameBeforeProbe": tableFrameBefore,
                "appFrameBeforeProbe": appFrameBefore, "appStateBeforeProbe": appStateBefore])
            print("Renderer facts collected; does not turn a failed ordinary screenshot into a pass")
            return
        }
        let initial = XCTAttachment(screenshot: app.screenshot())
        initial.name = "macos-soak-initial-native-window"; initial.lifetime = .keepAlways; add(initial)
        open.click()
        let continuous = button(app, containing: "连续牌局验收")
        XCTAssertTrue(continuous.waitForExistence(timeout: 10))
        try write("ready.json", ["runID": runID])
        acknowledged("baseline.ack")
        for cycle in 1...15 {
            let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: continuous)
            XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 10), .completed)
            continuous.click()
            let began = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false OR enabled == false OR hittable == false"), object: continuous)
            XCTAssertEqual(XCTWaiter.wait(for: [began], timeout: 10), .completed, "Round must actually begin")
            let finished = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: continuous)
            XCTAssertEqual(XCTWaiter.wait(for: [finished], timeout: 110), .completed)
            let status = app.staticTexts.matching(NSPredicate(format: "value CONTAINS %@ OR label CONTAINS %@", "连续验收完成", "连续验收完成")).firstMatch
            XCTAssertTrue(status.exists, "A stopped or hidden round must never pass")
            let summary = app.staticTexts.matching(NSPredicate(format: "value CONTAINS %@ OR label CONTAINS %@", "MEASURE ", "MEASURE ")).firstMatch
            let text = [summary.value as? String, summary.label].compactMap { $0 }.first { $0.contains("MEASURE ") }
            let start = try XCTUnwrap(text?.range(of: "MEASURE ")?.upperBound)
            let suffix = try XCTUnwrap(text).suffix(from: start)
            // MEASURE is flat JSON, separate from the longer, potentially truncated AUDIT.
            let end = try XCTUnwrap(suffix.firstIndex(of: "}"))
            let sample = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(suffix[...end].utf8)) as? [String: Any])
            try write("round-\(cycle).json", ["runID": runID, "cycle": cycle, "summary": sample])
            acknowledged("round-\(cycle).ack")
        }
        button(app, containing: "收起验收").click()
        XCTAssertTrue(table.waitForExistence(timeout: 20))
        XCTAssertGreaterThan(try capturedCardPixels(table), 100, "Final hand must actually render")
        let beforeRestart = table.label
        app.terminate(); app.launch(); app.activate()
        XCTAssertTrue(table.waitForExistence(timeout: 30))
        XCTAssertEqual(table.label, beforeRestart, "The sampled hand must survive a real native process restart")
        XCTAssertGreaterThan(try capturedCardPixels(table), 100, "Restored hand must actually render")
        let last = XCTAttachment(screenshot: app.screenshot())
        last.name = "macos-soak-final-restored-native-window"; last.lifetime = .keepAlways; add(last)
        #else
        throw XCTSkip("Only the isolated native soak runner selects this test")
        #endif
    }

}
