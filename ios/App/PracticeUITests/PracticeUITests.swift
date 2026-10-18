import XCTest

@MainActor
final class PracticeUITests: XCTestCase {
    private func button(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func table(_ app: XCUIApplication) -> XCUIElement {
        app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
    }

    private func requireActionable(_ element: XCUIElement, timeout: TimeInterval = 20) {
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"),
            object: element
        )
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: timeout), .completed)
    }

    func testNativeBeginnerGuidePersistsWithoutStartingPractice() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        let coldStart = Date()
        app.launch()
        // Exercise the primary first-time-player entry in the first process.
        // Do not tap merely because a WebKit accessibility node has appeared.
        let mentor = app.buttons["新手教学"]
        requireActionable(mentor, timeout: 60)
        let learn = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "从零学德州", "复习新手教学")).firstMatch
        // A reused local test simulator may already have a saved practice hand;
        // fresh CI installs exercise the primary entry without clearing saves.
        let entry = learn.exists ? learn : mentor
        requireActionable(entry)
        print("Native guide entry actionable: \(Date().timeIntervalSince(coldStart))s; simulator functional check, not a phone performance result")
        entry.tap()
        XCTAssertTrue(app.buttons["关闭新手教学"].waitForExistence(timeout: 20), "The first tap must open the guide without retrying or relaunching")
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
}
