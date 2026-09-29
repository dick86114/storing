import QiankunjieAuth
import QiankunjieCollect
import QiankunjieCore
import QiankunjieDesignSystem
import QiankunjieLibrary
import QiankunjieNetworking
import QiankunjieReader
import QiankunjieUpdating
import Testing

@Test("QiankunjieKit 暴露全部原生模块")
func packageExposesNativeModules() {
    #expect(QiankunjieCoreModule.moduleName == "QiankunjieCore")
    #expect(QiankunjieNetworkingModule.moduleName == "QiankunjieNetworking")
    #expect(QiankunjieAuthModule.moduleName == "QiankunjieAuth")
    #expect(QiankunjieLibraryModule.moduleName == "QiankunjieLibrary")
    #expect(QiankunjieCollectModule.moduleName == "QiankunjieCollect")
    #expect(QiankunjieReaderModule.moduleName == "QiankunjieReader")
    #expect(QiankunjieDesignSystemModule.moduleName == "QiankunjieDesignSystem")
    #expect(QiankunjieUpdatingModule.moduleName == "QiankunjieUpdating")
}
