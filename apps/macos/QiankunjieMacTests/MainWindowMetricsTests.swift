import CoreGraphics
import Testing
@testable import QiankunjieMac

@Suite("主窗口尺寸")
struct MainWindowMetricsTests {
    @Test func 首次打开的默认尺寸比此前实测尺寸宽高各增加一倍() {
        #expect(MainWindowMetrics.defaultSize.width == MainWindowMetrics.previousDefaultSize.width * 2)
        #expect(MainWindowMetrics.defaultSize.height == MainWindowMetrics.previousDefaultSize.height * 2)
        #expect(MainWindowMetrics.defaultSize == CGSize(width: 3300, height: 2148))
    }

    @Test func 默认尺寸会收敛到屏幕可用区域() {
        let smallScreen = CGSize(width: 1200, height: 900)
        #expect(MainWindowMetrics.resolvedSize(forVisibleFrame: smallScreen) == smallScreen)

        let largeScreen = CGSize(width: 5000, height: 3000)
        #expect(MainWindowMetrics.resolvedSize(forVisibleFrame: largeScreen) == MainWindowMetrics.defaultSize)

        // 实测主屏可用区域，确认不会溢出屏幕。
        let measuredScreen = CGSize(width: 2512, height: 1410)
        #expect(MainWindowMetrics.resolvedSize(forVisibleFrame: measuredScreen) == measuredScreen)
    }

    @Test func 只对首次打开和仍是旧默认尺寸的窗口套用新尺寸() {
        let legacy = MainWindowMetrics.previousDefaultSize
        let custom = CGSize(width: 900, height: 700)

        #expect(MainWindowMetrics.shouldApplyDefaultSize(isApplied: false, currentFrameSize: legacy))
        #expect(MainWindowMetrics.shouldApplyDefaultSize(isApplied: false, currentFrameSize: custom))
        #expect(MainWindowMetrics.shouldApplyDefaultSize(isApplied: true, currentFrameSize: legacy))
        #expect(!MainWindowMetrics.shouldApplyDefaultSize(isApplied: true, currentFrameSize: custom))
    }
}
