import Foundation
import QiankunjieCollect
import QiankunjieCore
import UserNotifications

enum CollectNotificationEvent: String, Equatable, Hashable, Sendable {
    case completed
    case failed

    init?(job: CollectJob) {
        switch job.status {
        case "completed":
            self = .completed
        case "failed":
            self = .failed
        default:
            return nil
        }
    }
}

struct CollectNotificationRequest: Equatable, Sendable {
    let identifier: String
    let title: String
    let body: String
    let categoryIdentifier: String
    let userID: Int?
    let jobData: Data
}

protocol CollectNotificationDelivering: Sendable {
    func requestAuthorization() async throws
    func add(_ request: CollectNotificationRequest) async throws
}

@MainActor
protocol CollectNotificationObserving: AnyObject {
    func startObserving(model: CollectModel)
    func stopObserving()
}

private final class UserNotificationDelivery: CollectNotificationDelivering, @unchecked Sendable {
    func requestAuthorization() async throws {
        try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    }

    func add(_ request: CollectNotificationRequest) async throws {
        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.body
        content.sound = .default
        content.categoryIdentifier = request.categoryIdentifier
        content.userInfo = [
            "job": request.jobData,
            "userID": request.userID ?? NSNull(),
        ]

        try await UNUserNotificationCenter.current().add(
            UNNotificationRequest(
                identifier: request.identifier,
                content: content,
                trigger: nil
            )
        )
    }
}

@MainActor
final class CollectNotificationService: NSObject, CollectNotificationObserving, UNUserNotificationCenterDelegate, @unchecked Sendable {
    private let delivery: any CollectNotificationDelivering
    private let onOpenArticle: @MainActor (CollectJob) -> Void
    private let onOpenTaskList: @MainActor () -> Void
    private var announcedNotifications = Set<AnnouncedNotification>()
    private var observationTask: Task<Void, Never>?
    private var currentUserID: Int?
    private weak var observedModel: CollectModel?

    private struct AnnouncedNotification: Hashable, Sendable {
        let jobID: Int
        let event: CollectNotificationEvent
    }

    init(
        delivery: any CollectNotificationDelivering = UserNotificationDelivery(),
        currentUserID: Int? = nil,
        onOpenArticle: @escaping @MainActor (CollectJob) -> Void,
        onOpenTaskList: @escaping @MainActor () -> Void
    ) {
        self.delivery = delivery
        self.currentUserID = currentUserID
        self.onOpenArticle = onOpenArticle
        self.onOpenTaskList = onOpenTaskList
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func startObserving(model: CollectModel) {
        stopObserving()
        observedModel = model
        var hasBaseline = false
        var observedUserID = model.userID
        currentUserID = model.userID

        observationTask = Task { [weak model] in
            while !Task.isCancelled {
                if let model, observedUserID != model.userID {
                    observedUserID = model.userID
                    currentUserID = model.userID
                    hasBaseline = false
                    announcedNotifications.removeAll()
                }

                if let model, !model.isLoadingJobs {
                    let jobs = [model.currentJob].compactMap { $0 } + model.jobs
                    if hasBaseline {
                        await synchronizeJobs(jobs, userID: model.userID)
                    } else {
                        prepareExistingJobs(jobs)
                        hasBaseline = true
                    }
                }
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    func stopObserving() {
        observationTask?.cancel()
        observationTask = nil
        observedModel = nil
        currentUserID = nil
    }

    func prepareExistingJobs(_ jobs: [CollectJob]) {
        for job in jobs {
            if let event = CollectNotificationEvent(job: job) {
                announcedNotifications.insert(
                    AnnouncedNotification(jobID: job.id, event: event)
                )
            } else {
                removeAnnouncedNotifications(jobID: job.id)
            }
        }
    }

    func synchronizeJobs(
        _ jobs: [CollectJob],
        userID: Int? = nil
    ) async {
        for job in jobs {
            guard let event = CollectNotificationEvent(job: job) else {
                removeAnnouncedNotifications(jobID: job.id)
                continue
            }

            let key = AnnouncedNotification(jobID: job.id, event: event)
            guard !announcedNotifications.contains(key) else { continue }

            await notify(job: job, userID: userID)
            announcedNotifications.insert(key)
        }
    }

    func notify(job: CollectJob, userID: Int? = nil) async {
        guard let event = CollectNotificationEvent(job: job) else { return }

        do {
            try await delivery.requestAuthorization()
            try await delivery.add(
                Self.request(job: job, event: event, userID: userID)
            )
        } catch {
            // 通知权限或系统投递失败不阻断任务轮询。
        }
    }

    func handleNotificationActivation(
        job: CollectJob,
        userID: Int? = nil
    ) async {
        let activeUserID = observedModel?.userID ?? currentUserID
        guard userID == activeUserID else { return }

        switch CollectNotificationEvent(job: job) {
        case .completed:
            onOpenArticle(job)
        case .failed:
            onOpenTaskList()
        case nil:
            break
        }
    }

    nonisolated func foregroundPresentationOptions() -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        guard
            let jobData = userInfo["job"] as? Data,
            let job = try? JSONDecoder.qiankunjie.decode(CollectJob.self, from: jobData)
        else { return }
        let notificationUserID = userInfo["userID"] as? Int

        await handleNotificationActivation(
            job: job,
            userID: notificationUserID
        )
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        foregroundPresentationOptions()
    }

    private static func request(
        job: CollectJob,
        event: CollectNotificationEvent,
        userID: Int?
    ) -> CollectNotificationRequest {
        CollectNotificationRequest(
            identifier: "collect-job-\(job.id)-\(event.rawValue)",
            title: event == .completed ? "采集完成" : "采集失败",
            body: event == .completed
                ? job.title ?? job.url
                : job.errorSummary ?? job.error ?? "请查看任务详情",
            categoryIdentifier: event == .completed ? "collect.completed" : "collect.failed",
            userID: userID,
            jobData: (try? Self.encoded(job)) ?? Data()
        )
    }

    private func removeAnnouncedNotifications(jobID: Int) {
        announcedNotifications = Set(
            announcedNotifications.filter { $0.jobID != jobID }
        )
    }

    private static func encoded(_ job: CollectJob) throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(job)
    }
}
