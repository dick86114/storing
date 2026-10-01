import Foundation
import Testing
@testable import QiankunjieUpdating

@Test func installScriptBacksUpBeforeReplacing() {
    let script = UpdateInstaller.installScript()

    let backupRange = script.range(of: #"mv "$APP" "$BACKUP""#)
    let copyRange = script.range(of: #"ditto "$SOURCE" "$NEW_APP""#)
    let replaceRange = script.range(of: #"mv "$NEW_APP" "$APP""#)
    let versionRange = script.range(of: "CFBundleShortVersionString")
    let launchRange = script.range(of: #"open "$APP""#)
    let restoreRange = script.range(of: "restore_backup")

    #expect(script.contains("backup"))
    #expect(script.contains("mv"))
    #expect(script.contains("CFBundleShortVersionString"))
    #expect(backupRange != nil)
    #expect(copyRange != nil)
    #expect(replaceRange != nil)
    #expect(restoreRange != nil)
    if
        let backupRange,
        let copyRange,
        let replaceRange,
        let versionRange,
        let launchRange,
        let restoreRange
    {
        #expect(backupRange.lowerBound < copyRange.lowerBound)
        #expect(copyRange.lowerBound < replaceRange.lowerBound)
        #expect(replaceRange.lowerBound < versionRange.lowerBound)
        #expect(versionRange.lowerBound < launchRange.lowerBound)
        #expect(restoreRange.lowerBound < launchRange.lowerBound)
    }
}

@Test func installScriptRestoresBackupWhenReplacementOrLaunchFails() {
    let script = UpdateInstaller.installScript()

    #expect(script.contains("RESTORE_NEEDED=1"))
    #expect(script.contains("trap restore_on_exit"))
    #expect(script.contains("RESTORE_NEEDED=0"))
}

@Test func installScriptPreservesBackupAndShowsRecoveryCommand() {
    let script = UpdateInstaller.installScript()

    #expect(script.contains("display dialog"))
    #expect(script.contains("备份位置"))
    #expect(script.contains(#"ditto "$BACKUP" "$APP""#))
    #expect(script.contains("rm -rf \"$APP\" && ditto \"$BACKUP\" \"$APP\""))
}

@Test func installScriptPassesHostileValuesOnlyAsProcessArguments() {
    let source = "/tmp/'; rm -rf \"$HOME\"; '/Qiankunjie.app"
    let destination = "/Applications/'; open '/ evil.app"
    let version = "1.3.0'; rm -rf '/tmp"

    let script = UpdateInstaller.installScript()
    let arguments = UpdateInstaller.makeArguments(
        source: source,
        destination: destination,
        pid: 99,
        version: version
    )

    #expect(!script.contains(source))
    #expect(!script.contains(destination))
    #expect(!script.contains(version))
    #expect(script.contains(#"APP="$1""#))
    #expect(script.contains(#"SOURCE="$2""#))
    #expect(script.contains(#"CURRENT_PID="$3""#))
    #expect(script.contains(#"EXPECTED="$4""#))
    #expect(arguments == [destination, source, "99", version])
}

@Test func installArgumentsMatchScriptParameterOrder() {
    // 脚本以 APP="$1"、SOURCE="$2" 读取参数：先传目标安装路径，再传挂载源。
    let arguments = UpdateInstaller.makeArguments(
        source: "/Volumes/mount/乾坤戒.app",
        destination: "/Applications/乾坤戒.app",
        pid: 42,
        version: "0.0.3"
    )

    #expect(arguments[0] == "/Applications/乾坤戒.app")
    #expect(arguments[1] == "/Volumes/mount/乾坤戒.app")
    #expect(arguments[2] == "42")
    #expect(arguments[3] == "0.0.3")
}

@Test func staleMountDirectoriesOnlyMatchesInstallerMountPoints() throws {
    let root = FileManager.default.temporaryDirectory
        .appendingPathComponent("stale-mount-test-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    for name in [
        "qiankunjie-update-mount-abc",
        "qiankunjie-update-mount-def",
        "qiankunjie-update-123",
        "other-directory",
    ] {
        try FileManager.default.createDirectory(
            at: root.appendingPathComponent(name, isDirectory: true),
            withIntermediateDirectories: true
        )
    }

    let matched = UpdateInstaller.staleMountDirectories(in: root)
        .map(\.lastPathComponent)
        .sorted()

    #expect(matched == ["qiankunjie-update-mount-abc", "qiankunjie-update-mount-def"])
}
