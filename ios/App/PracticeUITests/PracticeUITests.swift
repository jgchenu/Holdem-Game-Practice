import XCTest

@MainActor
final class PracticeUITests: XCTestCase {
    private func button(_ app: XCUIApplication, containing text: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func table(_ app: XCUIApplication) -> XCUIElement {
        app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
    }

    func testNativePracticeMentorAndRelaunchPersistence() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.wendao.poker")
        app.launch()
        let mentor = app.buttons["请教青玄师父"]
        XCTAssertTrue(mentor.waitForExistence(timeout: 20))
        let start = button(app, containing: "入席修炼")
        let resume = button(app, containing: "继续修炼")
        if start.exists { start.tap() }
        else if resume.exists { resume.tap() }

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
}
