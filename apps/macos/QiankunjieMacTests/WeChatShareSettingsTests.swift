import Foundation
import Testing
@testable import QiankunjieMac

struct WeChatShareSettingsTests {
    @Test func pluginkit输出中只有加号前缀代表扩展已启用() {
        let identifier = "com.idickies.storing.macos.share"

        #expect(
            WeChatShareSettingsModel.isEnabled(
                inPluginkitOutput: "+    \(identifier)(0.1.0)\n",
                identifier: identifier
            )
        )
        #expect(
            !WeChatShareSettingsModel.isEnabled(
                inPluginkitOutput: "     \(identifier)(0.1.0)\n",
                identifier: identifier
            )
        )
        #expect(
            !WeChatShareSettingsModel.isEnabled(
                inPluginkitOutput: "-    \(identifier)(0.1.0)\n",
                identifier: identifier
            )
        )
        #expect(
            !WeChatShareSettingsModel.isEnabled(
                inPluginkitOutput: "+    com.other.app.share(1.0)\n",
                identifier: identifier
            )
        )
    }

    @Test func 分享扩展标识由当前应用派生() {
        #expect(
            WeChatShareSettingsModel.extensionIdentifier
                == (Bundle.main.bundleIdentifier ?? "com.idickies.storing.macos") + ".share"
        )
        #expect(WeChatShareSettingsModel.extensionBundleURL.lastPathComponent == "storing.appex")
    }

    @Test func 开关切换使用带标识参数的pluginkit调用() {
        let identifier = "com.idickies.storing.macos.share"

        #expect(
            WeChatShareSettingsModel.setArguments(enabled: true, identifier: identifier)
                == ["-e", "use", "-i", identifier]
        )
        #expect(
            WeChatShareSettingsModel.setArguments(enabled: false, identifier: identifier)
                == ["-e", "ignore", "-i", identifier]
        )
    }
}
