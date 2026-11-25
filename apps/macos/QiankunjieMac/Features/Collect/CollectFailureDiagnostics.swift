import Foundation
import QiankunjieCore

struct CollectFailureDiagnostics {
    let job: CollectJob

    var summary: String {
        nonempty(job.errorSummary) ?? nonempty(job.error) ?? "采集失败"
    }

    var hint: String? { nonempty(job.errorHint) }

    var details: [String] { job.errorDetails.compactMap { nonempty($0) } }

    var logText: String {
        nonempty(job.error) ?? nonempty(details.joined(separator: "\n")) ?? "服务端未返回错误日志。"
    }

    var suggestedFilename: String { "storing-collect-error-\(job.id).txt" }

    var metadata: [(label: String, value: String)] {
        var fields = [("任务 ID", String(job.id)), ("状态", job.status), ("阶段", job.stage)]
        if let method = nonempty(job.method) { fields.append(("采集方式", method)) }
        if let strategy = nonempty(job.captureStrategy) { fields.append(("抓取策略", strategy)) }

        let timestamps = [("创建时间", job.createdAt), ("开始时间", job.startedAt), ("结束时间", job.finishedAt)]
        fields += timestamps.compactMap { label, time in
            time.map { (label, $0.ISO8601Format()) }
        }
        return fields
    }

    func exportText(appVersion: String, systemVersion: String) -> String {
        var fields = [("客户端版本", appVersion), ("系统版本", systemVersion)] + metadata
        if let url = CollectTaskLink.url(for: job) { fields.append(("任务链接", url.absoluteString)) }
        if let hint { fields.append(("处理建议", hint)) }

        var sections = [
            "乾坤戒采集错误日志",
            fields.map { "\($0.0)：\($0.1)" }.joined(separator: "\n"),
            "失败原因\n\(summary)",
        ]
        if !details.isEmpty, details.joined(separator: "\n") != logText {
            sections.append("抓取详情\n\(details.joined(separator: "\n"))")
        }
        sections.append("错误日志\n\(logText)")
        return Self.redact(sections.joined(separator: "\n\n")) + "\n"
    }

    private func nonempty(_ value: String?) -> String? {
        guard let text = value?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
    }

    private static func redact(_ text: String) -> String {
        text
            .replacingOccurrences(of: #"(?i)(https?://)[^\s<>"'/]+@"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"(?i)(https?://[^\s<>"'?#]+)[?#][^\s<>"']*"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(
                of: #"(?i)\b(authorization|proxy-authorization|set-cookie|cookie)["']?\s*[:=][^\r\n]*"#,
                with: "$1: [已隐藏]", options: .regularExpression
            )
            .replacingOccurrences(
                of: #"(?i)\b((?:x[-_])?api[-_]?key|(?:access|refresh)[-_]?token|token|password|client[-_]?secret)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)"#,
                with: "$1: [已隐藏]", options: .regularExpression
            )
            .replacingOccurrences(
                of: #"(?i)\bBearer\s+[^\s,;"']+"#,
                with: "Bearer [已隐藏]", options: .regularExpression
            )
    }
}

enum CollectTaskLink {
    static func url(for job: CollectJob) -> URL? {
        webURL(job.url) ?? webURL(job.normalizedURL)
    }

    private static func webURL(_ raw: String) -> URL? {
        guard let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil
        else { return nil }
        return url
    }
}
