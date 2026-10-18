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
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(PracticeStartupPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Game controls should receive touch-down immediately. Keep normal
        // scroll cancellation so dragging a lesson sheet still scrolls it.
        webView?.scrollView.delaysContentTouches = false
    }
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
