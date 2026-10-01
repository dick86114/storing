import AppKit
import Foundation
import WebKit

@MainActor
final class PDFArticleRenderer: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, Error>?
    private var webView: WKWebView?

    func render(_ document: ArticleExportDocument, to url: URL) async throws {
        let html = HTMLArticleRenderer().render(document)
        let baseURL = document.originalURL.flatMap(URL.init(string:))
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(
            frame: NSRect(x: 0, y: 0, width: 794, height: 1123),
            configuration: configuration
        )
        webView.navigationDelegate = self
        self.webView = webView

        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            webView.loadHTMLString(html, baseURL: baseURL)
        }

        let pdfConfiguration = WKPDFConfiguration()
        let data = try await webView.pdf(configuration: pdfConfiguration)
        try data.write(to: url, options: .atomic)
        self.webView = nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        continuation?.resume()
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
