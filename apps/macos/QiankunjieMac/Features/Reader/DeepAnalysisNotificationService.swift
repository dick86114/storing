import Foundation
import QiankunjieReader
import UserNotifications

struct DeepAnalysisNotificationMessage: Equatable, Sendable {
    let title: String
    let body: String

    static func completed(articleTitle: String?) -> DeepAnalysisNotificationMessage {
        let title = normalizedTitle(articleTitle)
        return DeepAnalysisNotificationMessage(
            title: "深度报告已生成",
            body: title != nil
                ? "《\(title ?? "")》的深度报告已就绪，打开文章即可查看。"
                : "深度报告已就绪，打开文章即可查看。"
        )
    }

    static func failed(articleTitle: String?) -> DeepAnalysisNotificationMessage {
        let title = normalizedTitle(articleTitle)
        return DeepAnalysisNotificationMessage(
            title: "深度报告生成失败",
            body: title != nil
                ? "《\(title ?? "")》生成失败。打开文章可查看原因并重新生成。"
                : "深度报告生成失败。打开文章可查看原因并重新生成。"
        )
    }

    private static func normalizedTitle(_ title: String?) -> String? {
        let value = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }
}

@MainActor
final class DeepAnalysisNotificationService {
    static let shared = DeepAnalysisNotificationService()

    private init() {}

    func prepare() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound]
        )
    }

    func notify(_ message: DeepAnalysisNotificationMessage, articleID: Int) async {
        let center = UNUserNotificationCenter.current()
        guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = message.title
        content.body = message.body
        content.sound = .default
        content.categoryIdentifier = "deep-analysis"
        content.userInfo = ["deepAnalysisArticleID": articleID]

        try? await center.add(
            UNNotificationRequest(
                identifier: "deep-analysis-\(articleID)-\(UUID().uuidString)",
                content: content,
                trigger: nil
            )
        )
    }
}

@MainActor
final class DeepAnalysisBackgroundMonitor {
    static let shared = DeepAnalysisBackgroundMonitor()

    private var tasks: [Int: Task<Void, Never>] = [:]

    private init() {}

    func start(
        articleID: Int,
        articleTitle: String?,
        client: any ReaderNetworkClient
    ) {
        guard tasks[articleID] == nil else { return }

        tasks[articleID] = Task { [weak self] in
            defer { self?.tasks[articleID] = nil }

            for _ in 0..<200 {
                do {
                    try await Task.sleep(for: .seconds(3))
                } catch {
                    return
                }
                guard !Task.isCancelled else { return }
                guard
                    let response = try? await client.deepAnalysis(articleID: articleID),
                    let status = response.summary?.status
                else {
                    continue
                }

                switch status {
                case "succeeded":
                    await DeepAnalysisNotificationService.shared.notify(
                        .completed(articleTitle: articleTitle),
                        articleID: articleID
                    )
                    return
                case "failed":
                    await DeepAnalysisNotificationService.shared.notify(
                        .failed(articleTitle: articleTitle),
                        articleID: articleID
                    )
                    return
                default:
                    continue
                }
            }
        }
    }
}
