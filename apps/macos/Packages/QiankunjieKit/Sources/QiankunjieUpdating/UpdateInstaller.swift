import Foundation

/// 写入并启动分离安装脚本；脚本等待当前进程退出后再替换应用。
public struct UpdateInstaller: Sendable {
    private let destination: URL
    private let currentProcessID: Int32

    public init(
        destination: URL = Bundle.main.bundleURL,
        currentProcessID: Int32 = ProcessInfo.processInfo.processIdentifier
    ) {
        self.destination = destination
        self.currentProcessID = currentProcessID
    }

    public func install(_ update: DownloadedUpdate) throws {
        let mountURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("qiankunjie-update-mount-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: mountURL, withIntermediateDirectories: true)

        do {
            try run(
                "/usr/bin/hdiutil",
                arguments: [
                    "attach", update.fileURL.path,
                    "-readonly", "-nobrowse", "-mountpoint", mountURL.path,
                ]
            )
            guard
                let contents = try? FileManager.default.contentsOfDirectory(atPath: mountURL.path),
                let appDirectoryName = contents.first(where: { $0.hasSuffix(".app") }),
                FileManager.default.qiankunjieIsDirectory(atPath: mountURL.appendingPathComponent(appDirectoryName).path)
            else {
                try? run("/usr/bin/hdiutil", arguments: ["detach", mountURL.path, "-force"])
                throw UpdateServiceError.invalidRelease
            }

            let script = Self.installScript()
            let scriptURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("qiankunjie-install-\(UUID().uuidString).sh")
            try script.data(using: .utf8)?.write(to: scriptURL)
            try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: scriptURL.path)

            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/sh")
            process.arguments = [scriptURL.path] + Self.makeArguments(
                source: mountURL.appendingPathComponent(appDirectoryName).path,
                destination: destination.path,
                pid: Int(currentProcessID),
                version: update.version
            )
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            try process.run()
        } catch {
            try? run("/usr/bin/hdiutil", arguments: ["detach", mountURL.path, "-force"])
            throw error
        }
    }

    static func makeArguments(source: String, destination: String, pid: Int, version: String) -> [String] {
        [
            source,
            destination,
            String(max(pid, 0)),
            version,
        ]
    }

    static func installScript() -> String {
        """
        #!/bin/sh
        set -eu

        if [ "$#" -ne 4 ]; then
          exit 10
        fi

        APP="$1"
        SOURCE="$2"
        CURRENT_PID="$3"
        EXPECTED="$4"
        case "$CURRENT_PID" in
          ''|*[!0-9]*)
            exit 11
            ;;
        esac
        BACKUP="${APP}.backup-$$"
        STAGING="${TMPDIR:-/tmp}/qiankunjie-update-$$"
        NEW_APP="$STAGING/乾坤戒.app"
        RESTORE_NEEDED=0

        restore_backup() {
          rm -rf "$APP"
          if [ -d "$BACKUP" ]; then
            mv "$BACKUP" "$APP"
          fi
        }

        cleanup_mount() {
          /usr/bin/hdiutil detach "$(dirname "$SOURCE")" -force >/dev/null 2>&1 || true
          rm -rf "$STAGING"
        }

        restore_on_exit() {
          if [ "$RESTORE_NEEDED" -ne 0 ]; then
            restore_backup
          fi
          cleanup_mount
        }

        trap restore_on_exit EXIT HUP INT TERM

        while kill -0 "$CURRENT_PID" 2>/dev/null; do
          sleep 1
        done

        rm -rf "$STAGING"
        mkdir -p "$STAGING"
        if [ -d "$APP" ]; then
          mv "$APP" "$BACKUP"
          RESTORE_NEEDED=1
        fi
        ditto "$SOURCE" "$NEW_APP"
        mv "$NEW_APP" "$APP"

        ACTUAL=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")
        if [ "$ACTUAL" != "$EXPECTED" ]; then
          exit 12
        fi

        if ! open "$APP"; then
          exit 13
        fi
        sleep 2
        if ! pgrep -f "$APP/Contents/MacOS/" >/dev/null 2>&1; then
          exit 14
        fi

        RESTORE_NEEDED=0
        rm -rf "$BACKUP" "$STAGING"
        rm -f "$0"
        """
    }

    private func run(_ executable: String, arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw UpdateServiceError.installFailed
        }
    }
}

extension FileManager {
    func qiankunjieIsDirectory(atPath path: String) -> Bool {
        var isDirectory: ObjCBool = false
        return fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}
