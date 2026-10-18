import UIKit
import Capacitor

// SplashScreen.hide resolves when the fade is scheduled. Observe the actual
// UIKit handover without forcing interaction on while the overlay is present.
@objc(PracticeStartupPlugin)
public final class PracticeStartupPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PracticeStartupPlugin"
    public let jsName = "PracticeStartup"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "waitForLaunchReady", returnType: CAPPluginReturnPromise)]

    @objc public func waitForLaunchReady(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { call.reject("Launch bridge was released"); return }
            self.checkReadiness(call, started: ProcessInfo.processInfo.systemUptime)
        }
    }

    private func checkReadiness(_ call: CAPPluginCall, started: TimeInterval) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard let webView = bridge?.webView else { call.reject("Launch WebView is unavailable"); return }
        var interactive = webView.window != nil
        var ancestor: UIView? = webView
        while let view = ancestor {
            interactive = interactive && view.isUserInteractionEnabled
            ancestor = view.superview
        }
        let elapsed = ProcessInfo.processInfo.systemUptime - started
        if interactive {
            call.resolve(["interactionReady": true, "nativeWaitMs": Int(elapsed * 1000)])
        } else if elapsed >= 10 {
            call.reject("Native launch handover timed out")
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(16)) { [weak self] in
                guard let self else { call.reject("Launch bridge was released"); return }
                self.checkReadiness(call, started: started)
            }
        }
    }
}

final class PracticeBridgeViewController: CAPBridgeViewController {
    #if STARTUP_TRACE
    private let startupTraceQueue = DispatchQueue(label: "com.wendao.poker.startup-trace", qos: .utility)
    #endif
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(PracticeStartupPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Game controls should receive touch-down immediately. Keep normal
        // scroll cancellation so dragging a lesson sheet still scrolls it.
        webView?.scrollView.delaysContentTouches = false
        #if STARTUP_TRACE
        webView?.scrollView.panGestureRecognizer.addTarget(self, action: #selector(traceOuterPan(_:)))
        recordNativeInput(["event": "observer-ready", "canCancelContentTouches": webView?.scrollView.canCancelContentTouches ?? false])
        #endif
    }

    #if STARTUP_TRACE
    // Observe the existing recognizer only. Never replace its delegate, add a
    // competing recognizer, or change cancellation/scrolling to pass a test.
    @objc private func traceOuterPan(_ pan: UIPanGestureRecognizer) {
        guard pan.state == .began || pan.state == .ended || pan.state == .cancelled,
              let scroll = webView?.scrollView else { return }
        let translation = pan.translation(in: scroll)
        recordNativeInput(["event": "outer-pan", "state": pan.state.rawValue,
            "translation": [translation.x, translation.y], "offset": [scroll.contentOffset.x, scroll.contentOffset.y],
            "content": [scroll.contentSize.width, scroll.contentSize.height], "bounds": [scroll.bounds.width, scroll.bounds.height]])
    }

    private func recordNativeInput(_ values: [String: Any]) {
        var record = values
        record["pid"] = ProcessInfo.processInfo.processIdentifier
        record["uptimeMs"] = Int(ProcessInfo.processInfo.systemUptime * 1000)
        record["atUnixMs"] = Int(Date().timeIntervalSince1970 * 1000)
        guard var data = try? JSONSerialization.data(withJSONObject: record) else { return }
        data.append(10)
        // Keep file IO off the input thread. Only this test app's own cache is
        // written, and the helper is not compiled into ordinary builds.
        startupTraceQueue.async {
            do {
                let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
                let file = folder.appendingPathComponent("wendao-native-input.jsonl")
                if !FileManager.default.fileExists(atPath: file.path) {
                    FileManager.default.createFile(atPath: file.path, contents: nil)
                }
                let handle = try FileHandle(forWritingTo: file)
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: data)
            } catch {
                NSLog("Wendao native input recording failed: \(error)")
            }
        }
    }
    #endif
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = PracticeBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
