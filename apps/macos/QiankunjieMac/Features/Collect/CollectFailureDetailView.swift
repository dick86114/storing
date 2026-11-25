import AppKit
import QiankunjieCore
import QiankunjieDesignSystem
import SwiftUI
import UniformTypeIdentifiers

struct CollectFailureDetailView: View {
    let job: CollectJob
    let onClose: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    @State private var exportError: String?

    private var diagnostics: CollectFailureDiagnostics { CollectFailureDiagnostics(job: job) }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ThinScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(diagnostics.displayTitle)
                            .qiankunjieFont(.titleLarge)
                        if let displayURL = diagnostics.displayURL, let link = CollectTaskLink.url(for: job) {
                            HStack(spacing: 8) {
                                Link(destination: link) {
                                    Label("用默认浏览器打开", systemImage: "safari")
                                }
                                .accessibilityHint("在系统默认浏览器中打开任务链接")
                                Button("复制链接", systemImage: "doc.on.doc") {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(link.absoluteString, forType: .string)
                                }
                            }
                            Text(displayURL)
                                .qiankunjieFont(.bodyMedium)
                                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                                .textSelection(.enabled)
                        }
                    }
                    .textSelection(.enabled)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("失败原因").qiankunjieFont(.titleMedium).accessibilityAddTraits(.isHeader)
                        diagnosticText(diagnostics.summary)
                        if let hint = diagnostics.hint {
                            diagnosticText(hint)
                                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        }
                    }

                    if !diagnostics.details.isEmpty, diagnostics.details.joined(separator: "\n") != diagnostics.logText {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("抓取详情").qiankunjieFont(.titleMedium).accessibilityAddTraits(.isHeader)
                            ForEach(Array(diagnostics.details.enumerated()), id: \.offset) { item in
                                diagnosticText(item.element)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("错误日志").qiankunjieFont(.titleMedium).accessibilityAddTraits(.isHeader)
                        Text(diagnostics.logText)
                            .qiankunjieFont(.bodyMedium)
                            .monospaced()
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(
                                QiankunjieColors.surfaceVariant(for: colorScheme),
                                in: RoundedRectangle(cornerRadius: QiankunjieRadius.control)
                            )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("任务信息")
                            .qiankunjieFont(.titleMedium)
                            .accessibilityAddTraits(.isHeader)
                        Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 6) {
                            ForEach(diagnostics.metadata, id: \.label) { field in
                                GridRow {
                                    Text(field.label)
                                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                                    Text(field.value).textSelection(.enabled)
                                }
                            }
                        }
                        .qiankunjieFont(.labelMedium)
                    }
                }
                .frame(maxWidth: 760, alignment: .leading)
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
        .background(QiankunjieColors.background(for: colorScheme))
        .modifier(CollectTaskLinkContextMenu(job: job))
        .alert("无法导出错误日志", isPresented: Binding(
            get: { exportError != nil },
            set: { if !$0 { exportError = nil } }
        )) {
            Button("好", role: .cancel) { exportError = nil }
        } message: {
            Text(exportError ?? "")
        }
    }

    private var header: some View {
        HStack {
            Label("采集失败", systemImage: "exclamationmark.triangle.fill")
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(colorScheme == .dark ? QiankunjieColors.darkError : QiankunjieColors.lightError)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button(action: exportLog) {
                Label("导出错误日志", systemImage: "square.and.arrow.up")
            }
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.borderless)
            .help("关闭失败详情")
            .accessibilityLabel("关闭失败详情")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private func diagnosticText(_ text: String) -> some View {
        Text(text)
            .qiankunjieFont(.bodyMedium)
            .textSelection(.enabled)
    }

    private func exportLog() {
        let report = diagnostics.exportText(
            appVersion: QiankunjieMacMetadata.appVersion,
            systemVersion: ProcessInfo.processInfo.operatingSystemVersionString
        )
        let panel = NSSavePanel()
        panel.nameFieldStringValue = diagnostics.suggestedFilename
        panel.allowedContentTypes = [.plainText]
        panel.canCreateDirectories = true
        guard panel.runModal() == .OK, let destination = panel.url else { return }

        do {
            try Data(report.utf8).write(to: destination, options: .atomic)
            NSWorkspace.shared.activateFileViewerSelecting([destination])
        } catch {
            exportError = error.localizedDescription
        }
    }
}
