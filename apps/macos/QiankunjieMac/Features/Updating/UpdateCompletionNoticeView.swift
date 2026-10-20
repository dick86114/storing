import AppKit
import QiankunjieDesignSystem
import QiankunjieUpdating
import SwiftUI

enum UpdateNoticePresentation: Equatable, Sendable {
    case updateCompleted
    case currentVersion

    func heading(version: String) -> String {
        switch self {
        case .updateCompleted:
            "已更新到 v\(version)"
        case .currentVersion:
            "当前版本 v\(version)"
        }
    }

    var windowTitle: String {
        switch self {
        case .updateCompleted:
            "更新完成"
        case .currentVersion:
            "版本更新内容"
        }
    }
}

enum UpdateNoticeMetrics {
    static let size = CGSize(width: 620, height: 500)
    static let notesHeight: CGFloat = 270
}

enum UpdateReleaseNoteLineKind: Equatable, Sendable {
    case heading
    case bullet
    case paragraph
}

struct UpdateReleaseNoteLine: Identifiable, Equatable, Sendable {
    let id: Int
    let kind: UpdateReleaseNoteLineKind
    let text: String
}

enum UpdateReleaseNotesFormatter {
    static func lines(from notes: String) -> [UpdateReleaseNoteLine] {
        let plainText = plainText(from: notes)
        let rawLines = plainText
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")

        var result: [UpdateReleaseNoteLine] = []
        for rawLine in rawLines {
            let trimmed = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }

            let kind: UpdateReleaseNoteLineKind
            let content: String
            if trimmed.hasPrefix("#") {
                kind = .heading
                content = trimmed.replacingOccurrences(
                    of: #"^#{1,6}\s*"#,
                    with: "",
                    options: .regularExpression
                )
            } else if let bullet = bulletText(from: trimmed) {
                kind = .bullet
                content = bullet
            } else {
                kind = .paragraph
                content = trimmed
            }

            let readable = inlinePlainText(content)
            guard !readable.isEmpty else { continue }
            result.append(UpdateReleaseNoteLine(id: result.count, kind: kind, text: readable))
        }
        return result
    }

    private static func bulletText(from line: String) -> String? {
        let patterns = [#"^[-*+]\s+"#, #"^\d+[.)、]\s*"#]
        for pattern in patterns {
            if line.range(of: pattern, options: .regularExpression) != nil {
                return line.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
            }
        }
        return nil
    }

    private static func inlinePlainText(_ text: String) -> String {
        guard let attributed = try? AttributedString(
            markdown: text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) else {
            return text
        }
        return String(attributed.characters).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func plainText(from notes: String) -> String {
        guard notes.contains("<"), notes.contains(">"), let data = notes.data(using: .utf8) else {
            return notes
        }
        if let attributed = try? NSAttributedString(
            data: data,
            options: [.documentType: NSAttributedString.DocumentType.html],
            documentAttributes: nil
        ) {
            return attributed.string
        }
        return notes.replacingOccurrences(
            of: #"<[^>]+>"#,
            with: "\n",
            options: .regularExpression
        )
    }
}

struct UpdateCompletionNoticeView: View {
    @Environment(\.colorScheme) private var colorScheme

    let notice: UpdateCompletionNotice
    let presentation: UpdateNoticePresentation
    let loadNotes: (@Sendable () async -> String?)?
    let onOpenFullNotes: () -> Void
    let onDismiss: () -> Void

    @State private var displayedNotes: String
    @State private var isLoadingNotes: Bool
    @State private var notesError: String?

    init(
        notice: UpdateCompletionNotice,
        presentation: UpdateNoticePresentation,
        loadNotes: (@Sendable () async -> String?)? = nil,
        onOpenFullNotes: @escaping () -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.notice = notice
        self.presentation = presentation
        self.loadNotes = loadNotes
        self.onOpenFullNotes = onOpenFullNotes
        self.onDismiss = onDismiss
        _displayedNotes = State(initialValue: notice.notes)
        _isLoadingNotes = State(initialValue: notice.notes.isEmpty && loadNotes != nil)
    }

    var body: some View {
        GlassSurface(
            role: .chrome,
            cornerRadius: QiankunjieRadius.modal,
            tint: QiankunjieColors.surface(for: colorScheme)
        ) {
            VStack(spacing: 0) {
                dragStrip

                VStack(alignment: .leading, spacing: 18) {
                    header
                    versionSummary
                    notesCard
                    Spacer(minLength: 0)
                    actions
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 22)
            }
        }
        .frame(width: UpdateNoticeMetrics.size.width, height: UpdateNoticeMetrics.size.height)
        .tint(QiankunjieColors.accent(for: colorScheme))
        .onExitCommand(perform: onDismiss)
        .task(id: notice.version) {
            await loadNotesIfNeeded()
        }
    }

    private var dragStrip: some View {
        ZStack {
            UpdateCompletionDragHandle()
                .accessibilityHidden(true)

            Capsule()
                .fill(QiankunjieColors.outline(for: colorScheme).opacity(0.9))
                .frame(width: 34, height: 4)
                .padding(.top, 8)
                .allowsHitTesting(false)
        }
        .frame(height: 28)
        .contentShape(Rectangle())
    }

    private var header: some View {
        HStack(spacing: 12) {
            BrandAssetName.brandLogo.image
                .resizable()
                .scaledToFit()
                .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text(presentation.heading(version: notice.version))
                    .qiankunjieFont(.titleLarge)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))

                Text("乾坤戒 macOS")
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 12)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .frame(width: 26, height: 26)
                    .background {
                        Circle()
                            .fill(QiankunjieColors.surfaceVariant(for: colorScheme))
                    }
            }
            .buttonStyle(.plain)
            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            .help("关闭")
            .accessibilityLabel("关闭版本更新内容")
        }
    }

    private var versionSummary: some View {
        HStack(spacing: 10) {
            Label(versionTransition, systemImage: "shippingbox.fill")
                .qiankunjieFont(.labelLarge)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background {
                    Capsule()
                        .fill(QiankunjieColors.accent(for: colorScheme).opacity(colorScheme == .dark ? 0.16 : 0.11))
                }

            if let publishedAt = notice.publishedAt {
                Text(Self.dateFormatter.string(from: publishedAt))
                    .qiankunjieFont(.labelMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }

            Spacer(minLength: 0)
        }
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "doc.text")
                    .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                Text("更新内容")
                    .qiankunjieFont(.labelLarge)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                Spacer()
                if isLoadingNotes {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            Divider()
                .overlay(QiankunjieColors.outline(for: colorScheme))

            notesContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(16)
        .frame(height: UpdateNoticeMetrics.notesHeight, alignment: .topLeading)
        .background {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .fill(QiankunjieColors.surfaceVariant(for: colorScheme).opacity(colorScheme == .dark ? 0.72 : 0.58))
        }
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.panel, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme).opacity(0.9))
        }
    }

    @ViewBuilder
    private var notesContent: some View {
        if isLoadingNotes {
            HStack(spacing: 9) {
                ProgressView()
                    .controlSize(.small)
                Text("正在获取更新日志…")
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
            }
        } else if let notesError {
            VStack(alignment: .leading, spacing: 10) {
                Text(notesError)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                if loadNotes != nil {
                    Button("重新获取") {
                        Task { await retryLoadNotes() }
                    }
                }
            }
        } else if displayedNotes.isEmpty {
            Text("本次更新未提供详细说明。")
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(UpdateReleaseNotesFormatter.lines(from: displayedNotes)) { line in
                        releaseNoteRow(line)
                    }
                }
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Spacer(minLength: 0)

            Button("查看完整更新", action: onOpenFullNotes)
                .buttonStyle(.bordered)

            Button("知道了", action: onDismiss)
                .buttonStyle(.borderedProminent)
                .tint(QiankunjieColors.accent(for: colorScheme))
                .keyboardShortcut(.defaultAction)
        }
    }

    private var versionTransition: String {
        if let previousVersion = notice.previousVersion, !previousVersion.isEmpty {
            return "v\(previousVersion) → v\(notice.version)"
        }
        return "当前安装 v\(notice.version)"
    }

    @ViewBuilder
    private func releaseNoteRow(_ line: UpdateReleaseNoteLine) -> some View {
        switch line.kind {
        case .heading:
            Text(line.text)
                .qiankunjieFont(.titleMedium)
                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                .padding(.top, line.id == 0 ? 0 : 4)
        case .bullet:
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Circle()
                    .fill(QiankunjieColors.accent(for: colorScheme))
                    .frame(width: 5, height: 5)
                Text(line.text)
                    .qiankunjieFont(.bodyMedium)
                    .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
        case .paragraph:
            Text(line.text)
                .qiankunjieFont(.bodyMedium)
                .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func loadNotesIfNeeded() async {
        guard displayedNotes.isEmpty, let loadNotes else { return }
        isLoadingNotes = true
        notesError = nil
        let loaded = await loadNotes()
        isLoadingNotes = false
        if let loaded, !loaded.isEmpty {
            displayedNotes = loaded
        } else {
            notesError = "更新日志暂时无法加载。"
        }
    }

    private func retryLoadNotes() async {
        notesError = nil
        await loadNotesIfNeeded()
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年M月d日发布"
        return formatter
    }()
}

private struct UpdateCompletionDragHandle: NSViewRepresentable {
    func makeNSView(context: Context) -> DraggableView {
        DraggableView()
    }

    func updateNSView(_ nsView: DraggableView, context: Context) {}

    final class DraggableView: NSView {
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
            true
        }

        override func mouseDown(with event: NSEvent) {
            window?.performDrag(with: event)
        }
    }
}

private final class UpdateCompletionNoticeWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

@MainActor
final class UpdateCompletionNoticeWindowController: NSObject, NSWindowDelegate {
    static let shared = UpdateCompletionNoticeWindowController()

    private var window: NSWindow?

    @discardableResult
    func presentPendingUpdateCompletionNoticeIfNeeded(defaults: UserDefaults = .standard) -> Bool {
        guard let notice = UpdateCompletionNotice.consume(defaults: defaults) else {
            return false
        }
        present(notice, presentation: .updateCompleted)
        return true
    }

    func presentCurrentVersion(version: String = QiankunjieMacMetadata.appVersion) {
        let cachedNotes = UpdateLogCache().read(currentVersion: version)
        let notice = UpdateCompletionNotice.currentVersion(
            version: version,
            notes: cachedNotes ?? ""
        )
        let service = GitHubUpdateService(currentVersion: version)
        let loadNotes: (@Sendable () async -> String?)?
        if cachedNotes == nil {
            loadNotes = { @Sendable in
                try? await service.fetchUpdateLog(for: version)
            }
        } else {
            loadNotes = nil
        }

        present(
            notice,
            presentation: .currentVersion,
            loadNotes: loadNotes
        )
    }

    func present(
        _ notice: UpdateCompletionNotice,
        presentation: UpdateNoticePresentation = .updateCompleted,
        loadNotes: (@Sendable () async -> String?)? = nil
    ) {
        if let window {
            window.close()
            self.window = nil
        }

        let rootView = UpdateCompletionNoticeView(
            notice: notice,
            presentation: presentation,
            loadNotes: loadNotes,
            onOpenFullNotes: {
                NSWorkspace.shared.open(notice.releaseURL)
            },
            onDismiss: { [weak self] in
                self?.close()
            }
        )
        let hostingController = NSHostingController(rootView: rootView)
        hostingController.sizingOptions = []
        let window = UpdateCompletionNoticeWindow(
            contentRect: NSRect(origin: .zero, size: UpdateNoticeMetrics.size),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.title = presentation.windowTitle
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.hidesOnDeactivate = false
        window.isMovableByWindowBackground = true
        window.isReleasedWhenClosed = false
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.delegate = self
        window.contentViewController = hostingController
        window.setContentSize(UpdateNoticeMetrics.size)
        centerWindowOnCurrentScreen(window)
        self.window = window

        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        window.makeFirstResponder(window.contentView)
        NSApp.activate(ignoringOtherApps: true)
    }

    func close() {
        window?.close()
    }

    private func centerWindowOnCurrentScreen(_ window: NSWindow) {
        let screen = NSScreen.screens.first { $0.frame.contains(NSEvent.mouseLocation) }
            ?? NSScreen.main
        guard let screen else { return }
        window.setFrameOrigin(
            NSPoint(
                x: screen.visibleFrame.midX - window.frame.width / 2,
                y: screen.visibleFrame.midY - window.frame.height / 2
            )
        )
    }
}
