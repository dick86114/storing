import Foundation
import QiankunjieAuth
import Testing
@testable import QiankunjieMac

struct MacAuthDeviceProviderTests {
    @Test func 设备信息使用包版本和稳定安装标识() throws {
        let (defaults, suiteName) = try 临时偏好存储()
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let first = MacAuthDeviceProvider(
            infoDictionary: ["CFBundleShortVersionString": "7.8.9"],
            defaults: defaults
        ).currentDevice
        let second = MacAuthDeviceProvider(
            infoDictionary: ["CFBundleShortVersionString": "7.8.9"],
            defaults: defaults
        ).currentDevice

        #expect(first.appVersion == "7.8.9")
        #expect(!first.id.isEmpty)
        #expect(second == first)
        #expect(
            defaults.string(forKey: MacAuthDeviceProvider.installationIDKey)
                == first.id
        )
    }

    @Test func 缺少短版本时回退构建版本() throws {
        let (defaults, suiteName) = try 临时偏好存储()
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let provider = MacAuthDeviceProvider(
            infoDictionary: ["CFBundleVersion": "123"],
            defaults: defaults
        )

        #expect(provider.currentDevice.appVersion == "123")
    }
}

private func 临时偏好存储() throws -> (defaults: UserDefaults, suiteName: String) {
    let suiteName = "com.idickies.storing.macos.tests.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        throw NSError(
            domain: "MacAuthDeviceProviderTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "无法创建临时偏好存储"]
        )
    }
    return (defaults, suiteName)
}
