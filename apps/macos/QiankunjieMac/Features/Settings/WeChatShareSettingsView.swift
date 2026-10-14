import AppKit
import Observation
import QiankunjieDesignSystem
import QiankunjieWeChat
import SwiftUI

/// 微信转发入口的状态管理：检测分享扩展是否启用，并引导用户完成开启。
@MainActor
@Observable
final class WeChatShareSettingsModel {
    private(set) var isExtensionInstalled = false
    private(set) var isExtensionEnabled: Bool?
    private(set) var pendingBatchCount = 0
    private(set) var isSwitching = false
    private(set) var switchFailed = false
    private let inbox: WeChatInbox

    init(inbox: WeChatInbox = .standard()) {
        self.inbox = inbox
    }

    /// 分享扩展的 Bundle ID 由主程序 ID 派生，Debug 与正式版互不干扰。
    nonisolated static var extensionIdentifier: String {
        (Bundle.main.bundleIdentifier ?? "com.idickies.storing.macos") + ".share"
    }

    nonisolated static var extensionBundleURL: URL {
        Bundle.main.bundleURL.appendingPathComponent("Contents/PlugIns/storing.appex", isDirectory: true)
    }

    /// 解析 `pluginkit -m` 输出：`+` 前缀表示启用，`-` 或无前缀表示未启用。
    nonisolated static func isEnabled(inPluginkitOutput output: String, identifier: String) -> Bool {
        for line in output.split(separator: "\n") {
            guard line.contains(identifier) else { continue }
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            return trimmed.hasPrefix("+")
        }
        return false
    }

    nonisolated static func setArguments(enabled: Bool, identifier: String) -> [String] {
        ["-e", enabled ? "use" : "ignore", "-i", identifier]
    }

    func refresh() {
        isExtensionInstalled = FileManager.default.fileExists(atPath: Self.extensionBundleURL.path)
        pendingBatchCount = inbox.readyBatchDirectories().count
        Task {
            let enabled = await Self.queryExtensionEnabled()
            isExtensionEnabled = enabled
        }
    }

    func setEnabled(_ enabled: Bool) {
        guard !isSwitching else { return }
        isSwitching = true
        switchFailed = false
        Task {
            await Self.runPluginkit(Self.setArguments(enabled: enabled, identifier: Self.extensionIdentifier))
            let actual = await Self.queryExtensionEnabled()
            isExtensionEnabled = actual
            isSwitching = false
            // pluginkit -e 无论 pkd 是否接受都返回 0，回读结果才是真相。
            switchFailed = actual != enabled
        }
    }

    func openSystemSettings() {
        NSWorkspace.shared.open(
            URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension")!
        )
    }

    nonisolated private static func queryExtensionEnabled() async -> Bool {
        let output = await runPluginkit(["-m", "-i", extensionIdentifier])
        return isEnabled(inPluginkitOutput: output, identifier: extensionIdentifier)
    }

    nonisolated private static func runPluginkit(_ arguments: [String]) async -> String {
        await Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/pluginkit")
            process.arguments = arguments
            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = Pipe()
            do {
                try process.run()
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                return String(data: data, encoding: .utf8) ?? ""
            } catch {
                return ""
            }
        }.value
    }
}

struct WeChatShareSettingsView: View {
    @State private var model = WeChatShareSettingsModel()
    @Environment(\.colorScheme) private var colorScheme

    private var toggleBinding: Binding<Bool> {
        Binding(
            get: { model.isExtensionEnabled == true },
            set: { model.setEnabled($0) }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SettingsRow(title: "微信「转发到其他应用」入口", subtitle: rowSubtitle) {
                if model.isExtensionInstalled {
                    Toggle("微信「转发到其他应用」入口", isOn: toggleBinding)
                        .toggleStyle(.switch)
                        .labelsHidden()
                        .disabled(model.isSwitching)
                } else {
                    Text(statusText)
                        .qiankunjieFont(.labelMedium)
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }

            if model.switchFailed {
                Label("开关未能生效，请到系统设置 → 通用 → 登录项与扩展 → 共享里手动打开乾坤戒。", systemImage: "exclamationmark.triangle")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(.orange)
            }

            if model.pendingBatchCount > 0 {
                Text("有 \(model.pendingBatchCount) 批微信转发等待保存，服务端更新后会自动完成上传。")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        }
        .onAppear {
            model.refresh()
        }
    }

    /// 说明只在未启用状态出现在行内，避免与引导文案重复。
    private var rowSubtitle: String? {
        guard model.isExtensionInstalled else { return statusText }
        return model.isExtensionEnabled == true
            ? "在微信中多选聊天记录后转发到乾坤戒即可保存。"
            : statusText + "，开启后可在微信里直接转发。"
    }

    private var statusText: String {
        if !model.isExtensionInstalled {
            return "当前版本未包含"
        }
        if model.isExtensionEnabled == nil {
            return "检查中…"
        }
        return "未启用"
    }
}
