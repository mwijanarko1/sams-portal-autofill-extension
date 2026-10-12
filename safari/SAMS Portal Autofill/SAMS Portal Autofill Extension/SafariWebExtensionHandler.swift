//
//  SafariWebExtensionHandler.swift
//  SAMS Portal Autofill Extension
//
//  Created by Mikhail on 12/10/2026.
//

import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    // Safari requires this principal class, but the web extension does not request
    // nativeMessaging. Student data must never reach native code, so any request is
    // refused without reading, logging, or echoing its contents.
    func beginRequest(with context: NSExtensionContext) {
        let error = NSError(domain: "SAMSPortalAutofill.NativeMessaging", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Native messaging is not supported.",
        ])
        context.cancelRequest(withError: error)
    }

}
