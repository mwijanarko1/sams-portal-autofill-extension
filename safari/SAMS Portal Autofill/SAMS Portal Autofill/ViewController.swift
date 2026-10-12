//
//  ViewController.swift
//  SAMS Portal Autofill
//
//  Created by Mikhail on 12/10/2026.
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "com.example.dev.SAMSPortalAutofill.Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] (state, error) in
            DispatchQueue.main.async {
                guard let webView = self?.webView else {
                    return
                }
                guard let state = state, error == nil else {
                    webView.evaluateJavaScript("showError('state')")
                    return
                }
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show(\(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.body as? String == "open-preferences" else {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { [weak self] error in
            DispatchQueue.main.async {
                // Stay open on failure so the operator can read the manual steps.
                guard error == nil else {
                    self?.webView.evaluateJavaScript("showError('open-settings')")
                    return
                }
                NSApplication.shared.terminate(nil)
            }
        }
    }

}
