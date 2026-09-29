import Foundation
import Testing
@testable import QiankunjieUpdating

@Test func installScriptBacksUpBeforeReplacing() {
    let script = UpdateInstaller.makeScript(
        source: "/tmp/new.app",
        destination: "/Applications/乾坤戒.app",
        pid: 99,
        version: "1.3.0"
    )

    let backupRange = script.range(of: #"mv "$APP" "$BACKUP""#)
    let copyRange = script.range(of: #"ditto "$SOURCE""#)
    let replaceRange = script.range(of: #"mv "$STAGING/乾坤戒.app" "$APP""#)
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

@Test func installScriptDefinesShellQuotesBeforeUse() {
    let script = UpdateInstaller.makeScript(
        source: "/tmp/path with space.app",
        destination: "/Applications/Qiankunjie.app",
        pid: 99,
        version: "1.3.0"
    )

    let quoteDefinition = script.range(of: "shell_quote()")
    let firstQuoteUse = script.range(of: "shell_quote \"")
    #expect(quoteDefinition != nil)
    #expect(firstQuoteUse != nil)
    #expect(quoteDefinition!.lowerBound < firstQuoteUse!.lowerBound)
}

@Test func installScriptAssignsQuotedValuesWithoutLosingQuoting() {
    let script = UpdateInstaller.makeScript(
        source: "/tmp/path with space.app",
        destination: "/Applications/Qiankunjie.app",
        pid: 99,
        version: "1.3.0"
    )

    for variable in ["APP", "SOURCE", "BACKUP", "STAGING", "EXPECTED"] {
        #expect(script.contains(#"eval "\#(variable)=$(shell_quote"#))
    }
}

@Test func installScriptRestoresBackupWhenReplacementOrLaunchFails() {
    let script = UpdateInstaller.makeScript(
        source: "/tmp/new.app",
        destination: "/Applications/Qiankunjie.app",
        pid: 99,
        version: "1.3.0"
    )

    #expect(script.contains("RESTORE_NEEDED=1"))
    #expect(script.contains("trap restore_on_exit"))
    #expect(script.contains("RESTORE_NEEDED=0"))
}
