import Foundation
import UserNotifications

enum ArticleExportPresentation: Equatable, Sendable {
    case openPrompt(URL)
    case notification(title: String, body: String)
}

enum ArticleExportCompletion: Equatable, Sendable {
    case file(URL)
    case copied(title: String, body: String)

    var presentation: ArticleExportPresentation {
        switch self {
        case .file(let url):
            .openPrompt(url)
        case .copied(let title, let body):
            .notification(title: title, body: body)
        }
    }
}

struct ArticleExportNotificationRequest: Equatable, Sendable {
    let title: String
    let body: String
}

protocol ArticleExportNotificationDelivering: Sendable {
    func deliver(_ request: ArticleExportNotificationRequest) async
}

struct SystemArticleExportNotificationDelivery: ArticleExportNotificationDelivering {
    func deliver(_ request: ArticleExportNotificationRequest) async {
        let center = UNUserNotificationCenter.current()
        guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.body
        content.sound = .default

        try? await center.add(
            UNNotificationRequest(
                identifier: "article-export-\(UUID().uuidString)",
                content: content,
                trigger: nil
            )
        )
    }
}

struct ArticleExportNotificationService: Sendable {
    private let delivery: any ArticleExportNotificationDelivering

    init(
        delivery: any ArticleExportNotificationDelivering = SystemArticleExportNotificationDelivery()
    ) {
        self.delivery = delivery
    }

    func notifyCopySuccess(_ body: String) async {
        await delivery.deliver(
            ArticleExportNotificationRequest(
                title: "复制成功",
                body: body
            )
        )
    }
}
