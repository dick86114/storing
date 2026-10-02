import AppKit
import Foundation

/// 监听 Ready 目录。目录事件负责主应用运行时的实时通知；
/// 唤醒与激活重扫覆盖系统睡眠或事件丢失的场景。
@MainActor
public final class WeChatInboxWatcher {
    private let inbox: WeChatInbox
    private let onChange: () -> Void
    private var source: DispatchSourceFileSystemObject?
    private var descriptor: CInt = -1
    private var debounce: Task<Void, Never>?
    private var observers: [NSObjectProtocol] = []

    public init(inbox: WeChatInbox, onChange: @escaping () -> Void) {
        self.inbox = inbox
        self.onChange = onChange
    }

    deinit {
        source?.cancel()
    }

    public func start() {
        try? inbox.prepareDirectories()
        inbox.pruneStaging()

        observers.append(
            NotificationCenter.default.addObserver(
                forName: NSApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.schedule() }
            }
        )
        observers.append(
            NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didWakeNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.schedule() }
            }
        )

        startDirectorySource()
        schedule()
    }

    public func stop() {
        source?.cancel()
        source = nil
        descriptor = -1
        debounce?.cancel()
        debounce = nil
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
        }
        observers.removeAll()
    }

    /// 监听 Ready 目录本身：批次提交是一次 rename into，事件落在目录上而不是内部文件上。
    private func startDirectorySource() {
        let descriptor = open(inbox.ready.path, O_EVTONLY)
        guard descriptor >= 0 else { return }
        self.descriptor = descriptor

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: descriptor,
            eventMask: [.write, .rename, .delete],
            queue: .main
        )
        source.setEventHandler { [weak self] in
            MainActor.assumeIsolated {
                let data = source.data
                if data.contains(.delete) || data.contains(.rename) {
                    self?.restartDirectorySource()
                }
                self?.schedule()
            }
        }
        source.setCancelHandler { [descriptor] in
            close(descriptor)
        }
        source.resume()
        self.source = source
    }

    private func restartDirectorySource() {
        source?.cancel()
        source = nil
        descriptor = -1
        startDirectorySource()
    }

    /// 一次 rename 可能触发多个事件，合并为一次扫描。
    private func schedule() {
        debounce?.cancel()
        debounce = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(120))
            guard !Task.isCancelled else { return }
            self?.onChange()
        }
    }
}
