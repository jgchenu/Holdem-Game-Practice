import XCTest

@MainActor
final class PracticeUITests: XCTestCase {
    private func button(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func table(_ app: XCUIApplication) -> XCUIElement {
        app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
    }

    private func captureBootState(_ app: XCUIApplication, name: String) {
        let state = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "BOOTSTATE ")).firstMatch
        if state.exists {
            let record = XCTAttachment(data: Data(state.label.utf8), uniformTypeIdentifier: "public.plain-text")
            record.name = name + "-state"; record.lifetime = .keepAlways; add(record)
        }
    }

    private func captureStartup(_ app: XCUIApplication, name: String) {
        captureBootState(app, name: name)
        let diagnostic = app.buttons["启动诊断"]
        if diagnostic.exists && diagnostic.isHittable {
            diagnostic.tap()
            let trace = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "STARTUP ")).firstMatch
            if trace.waitForExistence(timeout: 10) {
                let record = XCTAttachment(data: Data(trace.label.utf8), uniformTypeIdentifier: "public.plain-text")
                record.name = name + "-input-trace"; record.lifetime = .keepAlways; add(record)
            }
        }
    }

    private func requireNativeGeometry(_ app: XCUIApplication) {
        let window = app.windows.firstMatch
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard window.exists else { return false }
            let frame = window.frame
            return frame.minX.isFinite && frame.minY.isFinite && frame.width > 0 && frame.height > 0
        }, object: nil)
        let result = XCTWaiter.wait(for: [ready], timeout: 60)
        if result == .completed { print("Native first window geometry: \(window.frame)") }
        // Keep startup diagnostics text-only. A device screenshot request in
        // the first WebKit navigation can itself time out before the first tap.
        // Actual guide screenshots remain after the successful real interaction.
        captureBootState(app, name: result == .completed ? "ios-first-window-geometry" : "ios-invalid-native-window-geometry")
        XCTAssertEqual(result, .completed, "The first process needs a finite native window before querying hit points")
    }

    private func requirePracticeStartup(_ app: XCUIApplication, timeout: TimeInterval) {
        let state = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "BOOTSTATE ")).firstMatch
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard state.exists else { return false }
            let label = state.label
            return label.contains("\"phase\":\"ready\"") && label.contains("\"inert\":false")
        }, object: nil)
        let result = XCTWaiter.wait(for: [ready], timeout: timeout)
        captureBootState(app, name: "ios-before-first-guide-tap")
        XCTAssertEqual(result, .completed, "The first process must finish the real startup; no force-enabling controls")
    }

    private func requireActionable(_ element: XCUIElement, timeout: TimeInterval = 20, in app: XCUIApplication? = nil) {
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"),
            object: element
        )
        let result = XCTWaiter.wait(for: [ready], timeout: timeout)
        if result != .completed, let app { captureStartup(app, name: "ios-entry-not-actionable") }
        XCTAssertEqual(result, .completed)
    }

    func testNativeBeginnerGuidePersistsWithoutStartingPractice() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        let coldStart = Date()
        app.launch()
        let readinessStart = Date()
        requireNativeGeometry(app)
        requirePracticeStartup(app, timeout: max(1, 60 - Date().timeIntervalSince(readinessStart)))
        // Exercise the primary first-time-player entry in the first process.
        // Do not tap merely because a WebKit accessibility node has appeared.
        let mentor = app.buttons["新手教学"]
        let learn = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "从零学德州", "复习新手教学")).firstMatch
        // A reused local test simulator may already have a saved practice hand;
        // fresh CI installs exercise the primary entry without clearing saves.
        let entry = learn.exists ? learn : mentor
        requireActionable(entry, in: app)
        print("Native guide entry actionable: \(Date().timeIntervalSince(coldStart))s; simulator functional check, not a phone performance result")
        entry.tap()
        let opened = app.buttons["关闭新手教学"].waitForExistence(timeout: 20)
        if !opened { captureStartup(app, name: "ios-first-guide-tap-not-open") }
        XCTAssertTrue(opened, "The first tap must open the guide without retrying or relaunching")
        if app.buttons["再跟师父学一遍"].exists {
            requireActionable(app.buttons["再跟师父学一遍"])
            app.buttons["再跟师父学一遍"].tap()
        }
        for _ in 0..<12 {
            if !app.buttons["← 上一步"].exists { break }
            requireActionable(app.buttons["← 上一步"])
            app.buttons["← 上一步"].tap()
        }
        let first = button(app, containing: "师父带我学第一手")
        requireActionable(first)
        first.tap()
        let hole = button(app, containing: "点击你的两张底牌")
        requireActionable(hole)
        hole.tap()
        let guide = button(app, containing: "九种牌型图鉴")
        app.swipeUp()
        requireActionable(guide)
        guide.tap()
        let example = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "四条示例：")).firstMatch
        XCTAssertTrue(example.waitForExistence(timeout: 10), "The native guide must expose the actual five-card example")
        for _ in 0..<3 {
            if example.frame.height >= 54 && example.frame.minY > app.frame.minY + 130 && example.frame.maxY < app.buttons["明白了，继续 →"].frame.minY { break }
            app.swipeUp()
        }
        XCTAssertGreaterThan(example.frame.minY, app.frame.minY + 130)
        XCTAssertGreaterThanOrEqual(example.frame.height, 54, "The card row must be fully visible rather than a clipped accessibility frame")
        XCTAssertLessThan(example.frame.maxY, app.buttons["明白了，继续 →"].frame.minY, "All five cards must fit above the fixed teaching action")
        let closeGuide = app.buttons["关闭新手教学"]
        XCTAssertGreaterThanOrEqual(closeGuide.frame.height, 44)
        if app.statusBars.firstMatch.exists {
            XCTAssertGreaterThanOrEqual(closeGuide.frame.minY, app.statusBars.firstMatch.frame.maxY)
        }
        let guideImage = XCTAttachment(screenshot: app.screenshot())
        guideImage.name = "ios-native-hand-guide"; guideImage.lifetime = .keepAlways; add(guideImage)
        requireActionable(app.buttons["明白了，继续 →"])
        app.buttons["明白了，继续 →"].tap()
        XCTAssertTrue(app.staticTexts["桌子中间的灵石池"].waitForExistence(timeout: 10))
        app.buttons["关闭新手教学"].tap()
        app.terminate()
        app.launch()
        requireActionable(app.buttons["新手教学"], timeout: 60)
        app.buttons["新手教学"].tap()
        XCTAssertTrue(app.staticTexts["桌子中间的灵石池"].waitForExistence(timeout: 10), "The native Preferences store must restore the beginner step")
        XCTAssertLessThanOrEqual(app.buttons["明白了，继续 →"].frame.maxY, app.frame.maxY - 16)
        let evidence = XCTAttachment(screenshot: app.screenshot())
        evidence.name = "ios-native-beginner-restored"
        evidence.lifetime = .keepAlways
        add(evidence)
    }

    func testNativePracticeMentorAndRelaunchPersistence() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        let coldStart = Date()
        app.launch()
        let initial = XCTAttachment(screenshot: app.screenshot())
        initial.name = "ios-cold-start-initial"
        initial.lifetime = .keepAlways
        add(initial)
        let mentor = app.buttons["请教青玄师父"]
        // A fresh CI simulator's first WebKit navigation took ~26s in the
        // retained native log. Keep functional readiness separate from the
        // device startup performance acceptance gate; do not restart the app.
        let ready = mentor.waitForExistence(timeout: 60)
        let startup = XCTAttachment(screenshot: app.screenshot())
        startup.name = ready ? "ios-cold-start-ready" : "ios-cold-start-not-ready"
        startup.lifetime = .keepAlways
        add(startup)
        print("Native first-page readiness: \(Date().timeIntervalSince(coldStart))s; simulator functional check, not a phone performance result")
        XCTAssertTrue(ready, "The first native process must render the practice UI without a relaunch")
        let start = button(app, containing: "入席修炼")
        let resume = button(app, containing: "继续修炼")
        let entry = start.exists ? start : resume
        // The DOM appears before Phaser has finished creating its renderer.
        // A disabled entry ignores taps; require the actual actionable state.
        let actionable = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"),
            object: entry
        )
        XCTAssertEqual(XCTWaiter.wait(for: [actionable], timeout: 60), .completed,
                       "The first native process must finish preparing the table before entering")
        print("Native entry actionable: \(Date().timeIntervalSince(coldStart))s; simulator functional check, not a phone performance result")
        let actionReady = XCTAttachment(screenshot: app.screenshot())
        actionReady.name = "ios-cold-start-action-ready"
        actionReady.lifetime = .keepAlways
        add(actionReady)
        entry.tap()

        XCTAssertTrue(table(app).waitForExistence(timeout: 20))
        mentor.tap()
        XCTAssertTrue(app.staticTexts["规则计算 · 本地"].waitForExistence(timeout: 10))
        app.buttons["衡量价格"].tap()
        XCTAssertTrue(app.staticTexts["AI 服务尚未配置 · 本地指引"].waitForExistence(timeout: 10))
        let evidence = XCTAttachment(screenshot: app.screenshot())
        evidence.name = "ios-native-mentor"
        evidence.lifetime = .keepAlways
        add(evidence)
        app.buttons["关闭师父"].tap()

        let before = table(app).label
        XCTAssertTrue(before.contains("你的底牌"))
        app.terminate()
        app.launch()
        XCTAssertTrue(table(app).waitForExistence(timeout: 20))
        XCTAssertEqual(table(app).label, before, "A real native process relaunch must preserve the same hand")
        let restored = XCTAttachment(screenshot: app.screenshot())
        restored.name = "ios-native-process-restored"
        restored.lifetime = .keepAlways
        add(restored)
    }

    func testNativeTrialProgressSurvivesRelaunch() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        app.launch()
        XCTAssertTrue(button(app, containing: "进入修炼阁").waitForExistence(timeout: 20))
        button(app, containing: "进入修炼阁").tap()
        let courses: [(String, [String])] = [
            ("识牌 · 七选五", ["一对", "平分底池"]),
            ("知进退 · 正确行动", ["过牌", "40"]),
            ("观位 · 后发先知", ["大盲位左侧第一位", "能先看到更多人的行动"])
        ]
        for (title, answers) in courses {
            let lesson = button(app, containing: title)
            XCTAssertTrue(lesson.waitForExistence(timeout: 10))
            if !lesson.isHittable { app.swipeUp() }
            lesson.tap()
            for (index, answer) in answers.enumerated() {
                button(app, containing: answer).tap()
                app.buttons[index == 0 ? "下一道课程练习" : "保存本课进度"].tap()
            }
        }
        let trial = button(app, containing: "静观 · 免费过牌")
        if !trial.isHittable { app.swipeUp() }
        XCTAssertTrue(trial.isEnabled)
        trial.tap()
        XCTAssertTrue(app.buttons["试炼过牌"].waitForExistence(timeout: 10))
        if !app.buttons["试炼过牌"].isHittable { app.swipeUp() }
        app.buttons["试炼过牌"].tap()
        XCTAssertTrue(app.staticTexts["试炼达成"].waitForExistence(timeout: 10))
        XCTAssertLessThanOrEqual(app.buttons["收起试炼"].frame.maxY, app.frame.maxY - 24, "Completion controls must be visible above the bottom safe area without another swipe")
        let evidence = XCTAttachment(screenshot: app.screenshot())
        evidence.name = "ios-native-trial"
        evidence.lifetime = .keepAlways
        add(evidence)
        app.buttons["收起试炼"].tap()
        XCTAssertTrue(button(app, containing: "静观 · 免费过牌").label.contains("已达成"))
        app.terminate()
        app.launch()
        XCTAssertTrue(button(app, containing: "进入修炼阁").waitForExistence(timeout: 20))
        button(app, containing: "进入修炼阁").tap()
        XCTAssertTrue(button(app, containing: "静观 · 免费过牌").waitForExistence(timeout: 10))
        XCTAssertTrue(button(app, containing: "静观 · 免费过牌").label.contains("已达成"), "Native process relaunch must hydrate the trial seal from Preferences")
    }

    func testNativeRuntimeAudioAndFrames() throws {
        #if !NATIVE_AUDIT
        throw XCTSkip("Run npm run audit:ios to opt into the native runtime audit")
        #else
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        app.launch()
        requireActionable(app.buttons["运行验收"], timeout: 60)
        requireActionable(app.buttons["新手教学"], timeout: 60)
        let sample = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "AUDIT ")).firstMatch
        func auditContains(_ text: String) {
            app.buttons["运行验收"].tap()
            let match = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label CONTAINS %@", text), object: sample)
            XCTAssertEqual(XCTWaiter.wait(for: [match], timeout: 20), .completed)
        }
        app.buttons["运行验收"].tap()
        XCTAssertTrue(sample.waitForExistence(timeout: 10))
        XCTAssertTrue(sample.label.contains("\"audioStates\":[]"), "Audio must remain lazy before a trusted sound gesture")
        app.switches["开启音效"].tap()
        auditContains("\"audioStates\":[\"running\"]")
        app.buttons["收起验收"].tap()
        let start = button(app, containing: "入席修炼")
        let resume = button(app, containing: "继续修炼")
        let next = button(app, containing: "下一手")
        let entry = resume.exists ? resume : start.exists ? start : next
        requireActionable(entry)
        entry.tap()
        let call = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "跟注", "过牌")).firstMatch
        requireActionable(call)
        let before = table(app).label
        XCUIDevice.shared.press(.home)
        let background = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "state == %ld OR state == %ld", XCUIApplication.State.runningBackground.rawValue, XCUIApplication.State.runningBackgroundSuspended.rawValue),
            object: app
        )
        XCTAssertEqual(XCTWaiter.wait(for: [background], timeout: 10), .completed, "The real app must reach a native background state")
        app.activate()
        requireActionable(resume)
        XCTAssertEqual(table(app).label, before, "Backgrounding must preserve the hand at the hero's turn")
        auditContains("\"audioStates\":[\"suspended\"]")
        app.buttons["收起验收"].tap()
        resume.tap()
        auditContains("\"audioStates\":[\"running\"]")
        app.switches["关闭音效"].tap()
        auditContains("\"audioStates\":[\"suspended\"]")
        app.switches["开启音效"].tap()
        auditContains("\"audioStates\":[\"running\"]")
        #if NATIVE_SOAK
        let initialSample = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(String(sample.label.dropFirst("AUDIT ".count)).utf8)) as? [String: Any])
        var previousStarts = try XCTUnwrap(initialSample["starts"] as? Int)
        let continuous = app.buttons["连续牌局验收"]
        for cycle in 1...15 {
            requireActionable(continuous)
            continuous.tap()
            let began = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false OR enabled == false OR hittable == false"), object: continuous)
            XCTAssertEqual(XCTWaiter.wait(for: [began], timeout: 10), .completed, "The continuous round must actually start")
            requireActionable(continuous, timeout: 110)
            XCTAssertTrue(app.staticTexts["连续验收完成；帧时间是否达标请单独看数据"].exists)
            let text = String(sample.label.dropFirst("AUDIT ".count))
            var result = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
            XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["elapsedMs"] as? Int), 65000)
            XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["frames"] as? Int), 1000)
            XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["completedHands"] as? Int), 2)
            let starts = try XCTUnwrap(result["starts"] as? Int)
            XCTAssertGreaterThan(starts, previousStarts); previousStarts = starts
            XCTAssertEqual(result["audioStates"] as? [String], ["suspended"])
            result["cycle"] = cycle
            let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
            let record = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
            record.name = "ios-soak-round-\(cycle)"; record.lifetime = .keepAlways; add(record)
            print("IOS_SOAK_ROUND \(String(decoding: data, as: UTF8.self))")
            // A short pause also gives a host-side process sampler a settled
            // boundary between rounds. It is outside the frozen frame sample.
            RunLoop.current.run(until: Date().addingTimeInterval(2))
        }
        #else
        app.buttons["重置采样"].tap()
        app.buttons["收起验收"].tap()
        let end = Date().addingTimeInterval(65)
        while Date() < end {
            if next.exists && next.isEnabled && next.isHittable { next.tap() }
            else if call.exists && call.isEnabled && call.isHittable { call.tap() }
            else { RunLoop.current.run(until: Date().addingTimeInterval(0.15)) }
        }
        app.switches["关闭音效"].tap()
        #endif
        auditContains("\"audioStates\":[\"suspended\"]")
        let text = String(sample.label.dropFirst("AUDIT ".count))
        let result = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        let evidence = XCTAttachment(data: Data(text.utf8), uniformTypeIdentifier: "public.json")
        evidence.name = "ios-native-runtime-audit"; evidence.lifetime = .keepAlways; add(evidence)
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["elapsedMs"] as? Int), 65000)
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["frames"] as? Int), 1000)
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["busyFrames"] as? Int), 30)
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(result["completedHands"] as? Int), 2)
        // WKWebView may keep document.hidden false while Capacitor reports the
        // actual native background transition. Require that real bridge event.
        XCTAssertGreaterThan(try XCTUnwrap(result["suspends"] as? Int), 0)
        #if NATIVE_LIVE_AI
        app.buttons["收起验收"].tap()
        app.buttons["请教青玄师父"].tap()
        app.buttons["衡量价格"].tap()
        XCTAssertTrue(app.staticTexts["AI 解读 · 可能有误，请结合程序事实判断"].waitForExistence(timeout: 20))
        #endif
        #endif
    }
}
