import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieCollect

struct CollectUrlValidatorTests {
    @Test func 无效和私有地址在提交前被拒绝() {
        let invalidInputs = [
            "not a url",
            "",
            "   ",
            "http://127.0.0.1/a",
            "http://localhost/a",
            "http://192.168.1.5/a",
            "http://10.0.0.8/a",
            "http://172.16.0.8/a",
            "http://169.254.1.8/a",
            "http://[::ffff:192.168.1.5]/a",
            "http://[fe80::8]/a",
            "file:///tmp/a.html",
            "ftp://example.com/a.html",
        ]

        for input in invalidInputs {
            #expect(throws: AppError.invalidInput) {
                try CollectUrlValidator.validate(input)
            }
        }
    }

    @Test func 公开HTTP和HTTPS地址通过校验() throws {
        #expect(try CollectUrlValidator.validate("https://example.com/article") == URL(string: "https://example.com/article"))
        #expect(try CollectUrlValidator.validate(" http://example.com/article ") == URL(string: "http://example.com/article"))
    }
}
