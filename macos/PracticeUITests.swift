import XCTest

@MainActor
final class PracticeUITests: XCTestCase {
    func testOrdinaryFirstTeaching() throws {
        continueAfterFailure = false
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
        app.launch()
        defer { app.terminate() }
        let entry = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "从零学德州")).firstMatch
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
        let start = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "入席修炼")).firstMatch
        let actionable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true AND hittable == true"), object: start)
        XCTAssertEqual(XCTWaiter.wait(for: [actionable], timeout: 30), .completed)
        start.click()
        let table = app.images.matching(NSPredicate(format: "label CONTAINS %@", "你的底牌")).firstMatch
        let dealt = table.waitForExistence(timeout: 20)
        if !dealt { print(app.debugDescription) }
        XCTAssertTrue(dealt, "The ordinary native table must actually expose the dealt hand")
        let cards = XCTAttachment(screenshot: app.screenshot())
        cards.name = "macos-ci-ordinary-dealt-table"; cards.lifetime = .keepAlways; add(cards)
        print("Native macOS ordinary UI check; not a browser substitute or phone performance result")
    }
}
