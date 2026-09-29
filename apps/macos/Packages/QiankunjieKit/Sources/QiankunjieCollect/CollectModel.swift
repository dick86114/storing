import Foundation
import Observation
import QiankunjieCore

public enum CollectDisplayState: Equatable, Sendable {
    case loading
    case content
    case empty
    case error
}

private enum CollectListOperation {
    case refresh
    case loadMore
}

@MainActor
@Observable
public final class CollectModel {
    public var urlDraft = ""
    public var pendingDeletionJobID: Int?
    public var isClearConfirmationPresented = false

    public private(set) var userID: Int?
    public private(set) var jobs: [CollectJob] = []
    public private(set) var currentJob: CollectJob?
    public private(set) var total = 0
    public private(set) var hasMore = false
    public private(set) var isLoadingJobs = true
    public private(set) var isRefreshingJobs = false
    public private(set) var isLoadingMoreJobs = false
    public private(set) var isSubmitting = false
    public private(set) var mutatingJobIDs: Set<Int> = []
    public private(set) var inputErrorMessage: String?
    public private(set) var submitErrorMessage: String?
    public private(set) var refreshErrorMessage: String?
    public private(set) var actionErrorMessage: String?

    private let repository: any CollectServicing
    private let pollInterval: Duration
    private var requestGeneration = 0
    private var pollGeneration = 0
    private let pageSize = 30
    private var nextPageOffset = 0
    private var activeListOperation: CollectListOperation?

    public init(
        repository: any CollectServicing = CollectRepository(),
        userID: Int? = nil,
        initialJobs: [CollectJob] = [],
        initialCurrentJob: CollectJob? = nil,
        pollInterval: Duration = .milliseconds(2000)
    ) {
        self.repository = repository
        self.userID = userID
        self.jobs = initialJobs
        self.currentJob = initialCurrentJob
        self.total = initialJobs.count
        self.pollInterval = pollInterval
    }

    public var displayState: CollectDisplayState {
        if refreshErrorMessage != nil && jobs.isEmpty {
            return .error
        }
        if isLoadingJobs {
            return .loading
        }
        return jobs.isEmpty ? .empty : .content
    }

    public var canSubmit: Bool {
        !urlDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isSubmitting
    }

    public func submit(_ input: String) async {
        guard !isSubmitting else { return }

        inputErrorMessage = nil
        submitErrorMessage = nil
        guard userID != nil else {
            inputErrorMessage = "登录后才能提交采集任务"
            return
        }

        let url: URL
        do {
            url = try CollectUrlValidator.validate(input)
        } catch {
            inputErrorMessage = "请输入可公开访问的 HTTP(S) 链接"
            return
        }

        requestGeneration += 1
        let generation = requestGeneration
        isSubmitting = true

        do {
            let job = try await repository.submit(url: url)
            guard requestGeneration == generation else { return }

            currentJob = job
            jobs.insert(job, at: 0)
            total += 1
            urlDraft = ""
            isSubmitting = false
            await poll(jobID: job.id, generation: pollGeneration)
        } catch {
            guard requestGeneration == generation else { return }
            submitErrorMessage = Self.message(for: error)
        }

        if requestGeneration == generation {
            isSubmitting = false
        }
    }

    public func refreshJobs() async {
        guard
            userID != nil,
            activeListOperation == nil
        else {
            isLoadingJobs = false
            isRefreshingJobs = false
            return
        }

        activeListOperation = .refresh
        requestGeneration += 1
        pollGeneration += 1
        let generation = requestGeneration
        let operationUserID = userID
        defer {
            if activeListOperation == .refresh {
                activeListOperation = nil
                if userID == operationUserID {
                    isLoadingJobs = false
                    isRefreshingJobs = false
                }
            }
        }

        if jobs.isEmpty {
            isLoadingJobs = true
        } else {
            isRefreshingJobs = true
        }
        refreshErrorMessage = nil

        do {
            let page = try await repository.jobs(limit: pageSize, offset: 0)
            guard requestGeneration == generation else { return }

            jobs = page.jobs
            total = page.total
            hasMore = page.hasMore
            nextPageOffset = page.hasMore ? pageSize : 0
            if let jobID = currentJob?.id {
                currentJob = page.jobs.first { $0.id == jobID }
            }
            isLoadingJobs = false
            isRefreshingJobs = false
            activeListOperation = nil
            await pollActiveJobs(generation: pollGeneration)
        } catch {
            guard requestGeneration == generation else { return }
            refreshErrorMessage = Self.message(for: error)
        }

    }

    public func retry(jobID: Int) async {
        guard
            userID != nil,
            !mutatingJobIDs.contains(jobID),
            let failedJob = jobs.first(where: { $0.id == jobID && $0.status == "failed" })
        else { return }

        let generation = requestGeneration
        mutatingJobIDs.insert(jobID)
        actionErrorMessage = nil

        do {
            let job = try await repository.retry(id: failedJob.id)
            guard requestGeneration == generation else { return }

            replace(job)
            if currentJob?.id == job.id {
                currentJob = job
            }
            await poll(jobID: job.id, generation: pollGeneration)
        } catch {
            guard requestGeneration == generation else { return }
            actionErrorMessage = Self.message(for: error)
        }

        if requestGeneration == generation {
            mutatingJobIDs.remove(jobID)
        }
    }

    public func delete(jobID: Int) async {
        guard
            userID != nil,
            !mutatingJobIDs.contains(jobID),
            let job = jobs.first(where: { $0.id == jobID && $0.isTerminal })
        else {
            pendingDeletionJobID = nil
            return
        }

        mutatingJobIDs.insert(jobID)
        actionErrorMessage = nil
        defer { mutatingJobIDs.remove(jobID) }

        do {
            if try await repository.delete(id: job.id) {
                jobs.removeAll { $0.id == job.id }
                total = max(0, total - 1)
                if currentJob?.id == job.id {
                    currentJob = nil
                }
            }
        } catch {
            actionErrorMessage = Self.message(for: error)
        }

        pendingDeletionJobID = nil
    }

    public func loadMoreJobs() async {
        guard
            userID != nil,
            hasMore,
            !isLoadingMoreJobs,
            !isLoadingJobs,
            activeListOperation == nil
        else {
            return
        }

        activeListOperation = .loadMore
        requestGeneration += 1
        let generation = requestGeneration
        let offset = nextPageOffset
        let operationUserID = userID
        isLoadingMoreJobs = true
        defer {
            if activeListOperation == .loadMore {
                activeListOperation = nil
                if userID == operationUserID {
                    isLoadingMoreJobs = false
                }
            }
        }

        do {
            let page = try await repository.jobs(limit: pageSize, offset: offset)
            guard requestGeneration == generation else { return }

            let existingIDs = Set(jobs.map(\.id))
            for job in page.jobs where !existingIDs.contains(job.id) {
                jobs.append(job)
            }
            total = page.total
            hasMore = page.hasMore
            nextPageOffset = offset + pageSize
        } catch {
            guard requestGeneration == generation else { return }
            actionErrorMessage = Self.message(for: error)
        }

        if requestGeneration == generation {
            isLoadingMoreJobs = false
        }
    }

    public func clearFinished() async {
        guard userID != nil, !jobs.isEmpty else {
            isClearConfirmationPresented = false
            return
        }

        mutatingJobIDs.formUnion(Set(jobs.filter(\.isTerminal).map(\.id)))
        actionErrorMessage = nil
        defer { mutatingJobIDs.removeAll() }

        do {
            let deletedCount = try await repository.clearFinished()
            if deletedCount > 0 {
                let oldCount = jobs.count
                jobs.removeAll(where: \.isTerminal)
                total = max(0, total - (oldCount - jobs.count))
            }
            await refreshJobs()
        } catch {
            actionErrorMessage = Self.message(for: error)
        }

        isClearConfirmationPresented = false
    }

    public func prepareUser(userID: Int?) {
        requestGeneration += 1
        pollGeneration += 1
        self.userID = userID
        jobs = []
        currentJob = nil
        total = 0
        hasMore = false
        nextPageOffset = 0
        urlDraft = ""
        pendingDeletionJobID = nil
        isClearConfirmationPresented = false
        isSubmitting = false
        isRefreshingJobs = false
        isLoadingMoreJobs = false
        mutatingJobIDs = []
        activeListOperation = nil
        inputErrorMessage = nil
        submitErrorMessage = nil
        refreshErrorMessage = nil
        actionErrorMessage = nil
        isLoadingJobs = userID != nil
    }

    public func switchUser(userID: Int?) async {
        prepareUser(userID: userID)
        if userID != nil {
            await refreshJobs()
        }
    }

    private func pollActiveJobs(generation: Int) async {
        let activeJobIDs = jobs.filter { !$0.isTerminal }.map(\.id)
        guard !activeJobIDs.isEmpty else { return }

        await withTaskGroup(of: Void.self) { group in
            for jobID in activeJobIDs {
                group.addTask {
                    await self.poll(jobID: jobID, generation: generation)
                }
            }
        }
    }

    private func poll(jobID: Int, generation: Int) async {
        while pollGeneration == generation {
            do {
                guard let job = try await repository.job(id: jobID) else {
                    return
                }
                guard pollGeneration == generation else { return }

                refreshErrorMessage = nil
                replace(job)
                if currentJob?.id == job.id {
                    currentJob = job
                }
                if job.isTerminal {
                    return
                }
            } catch {
                guard pollGeneration == generation else { return }
                refreshErrorMessage = Self.message(for: error)
                return
            }

            try? await Task.sleep(for: pollInterval)
        }
    }

    private func replace(_ job: CollectJob) {
        if let index = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[index] = job
        } else {
            jobs.insert(job, at: 0)
        }
    }

    private static func message(for error: any Error) -> String {
        guard let appError = error as? AppError else {
            return "采集操作失败，请稍后重试"
        }

        return switch appError {
        case .network:
            "网络连接失败，请稍后重试"
        case .authenticationRequired:
            "登录已失效，请重新登录"
        case .forbidden:
            "当前账号无权使用采集功能"
        case .contentUnavailable:
            "采集任务不存在或已被删除"
        case .invalidInput:
            "请输入可公开访问的 HTTP(S) 链接"
        case .server:
            "服务暂时不可用，请稍后重试"
        }
    }
}
