import Foundation
import QiankunjieCore

struct CollectFailureDiagnostics {
    let job: CollectJob

    var summary: String {
        Self.redact(nonempty(job.errorSummary) ?? nonempty(job.error) ?? "采集失败")
    }

    var hint: String? { nonempty(job.errorHint).map(Self.redact) }

    var details: [String] { job.errorDetails.compactMap { nonempty($0).map(Self.redact) } }

    var logText: String {
        nonempty(job.error).map(Self.redact) ?? nonempty(details.joined(separator: "\n")) ?? "服务端未返回错误日志。"
    }

    var displayURL: String? {
        guard let url = CollectTaskLink.url(for: job) else { return nil }
        return Self.redact(url.absoluteString)
    }

    var displayTitle: String {
        nonempty(job.title).map(Self.redact) ?? displayURL ?? "采集任务"
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
        return fields.map { ($0.0, Self.redact($0.1)) }
    }

    func exportText(appVersion: String, systemVersion: String) -> String {
        var fields = [("客户端版本", appVersion), ("系统版本", systemVersion)] + metadata
        if let displayURL { fields.append(("任务链接", displayURL)) }
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
        return sections.joined(separator: "\n\n") + "\n"
    }

    // Match URLs and free-text secrets in one pass so the rendered URL cannot be redacted again.
    private static let redactionPattern = try? NSRegularExpression(pattern: #"""
    (?ix)
      (?<url>(?:https?|ftp)://[^\s<>"'，。；]+)
    | \b(?:proxy-authorization|authorization|set-cookie|cookie)\h*[:=][^\r\n]*
    | (?<!\w)--cookie(?:\h+|=)(?:"[^"\r\n]*"|'[^'\r\n]*'|\S+)
    | \b[\w.-]*(?:token|secret|signature|cookie|csrf|api[-_]?key|password|credential|session[-_]?id|auth)[\w.-]*["']?\h*[:=]\h*
        (?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s,;&"']+)
    | \bBearer\h+[^\s,;"']+
    | (?<path>
          "(?:file://)?/(?:Users|home|private|var/folders)/[^"\r\n]+"
        | '(?:file://)?/(?:Users|home|private|var/folders)/[^'\r\n]+'
        | file:///(?:Users|home|private|var/folders)/[^\s<>"']+
        | (?<![\w/])/(?:Users|home|private|var/folders)/[^\s<>"']+
      )
    """#)

    static func redact(_ text: String) -> String {
        guard let pattern = redactionPattern else { return "[诊断文本已隐藏]" }
        var result = text
        for match in pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed() {
            guard let range = Range(match.range, in: result) else { continue }
            let replacement: String
            if match.range(withName: "url").location != NSNotFound {
                replacement = redactURL(String(result[range]))
            } else if match.range(withName: "path").location != NSNotFound {
                replacement = "[本地路径已隐藏]"
            } else {
                replacement = "[敏感字段已隐藏]"
            }
            result.replaceSubrange(range, with: replacement)
        }
        return result
    }

    private static func redactURL(_ url: String) -> String {
        guard var components = URLComponents(string: url), components.host?.isEmpty == false else {
            return "[已隐藏 URL]"
        }
        components.user = nil
        components.password = nil
        components.fragment = nil

        let sensitivePathNames = ["token", "secret", "signature", "credential", "session", "cookie", "auth", "password", "ticket", "reset"]
        let hidesPath = sensitivePathNames.contains { components.path.localizedCaseInsensitiveContains($0) }
        if hidesPath { components.path = "" }

        // Query parameters can contain credentials under site-specific names.
        let query = components.percentEncodedQueryItems?.map { item in
            item.value == nil ? item.name : "\(item.name)=[已隐藏]"
        }.joined(separator: "&")
        components.query = nil

        guard let base = components.string else { return "[已隐藏 URL]" }
        return base + (hidesPath ? "/[已隐藏路径]" : "") + (query.map { "?" + $0 } ?? "")
    }

    private func nonempty(_ value: String?) -> String? {
        guard let text = value?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
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
