import Foundation
import QiankunjieCore

enum QiankunjieMacMetadata {
    static let displayName = "乾坤戒"
    static let bundleIdentifier = "com.idickies.storing.macos"
    static let nativeModule = QiankunjieCoreModule.moduleName

    static var appVersion: String {
        let infoDictionary = Bundle.main.infoDictionary
        if let shortVersion = infoDictionary?["CFBundleShortVersionString"] as? String,
           !shortVersion.isEmpty {
            return shortVersion
        }
        if let buildVersion = infoDictionary?["CFBundleVersion"] as? String,
           !buildVersion.isEmpty {
            return buildVersion
        }
        return "0"
    }
}
