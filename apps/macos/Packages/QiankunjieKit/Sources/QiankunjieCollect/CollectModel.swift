import Foundation
import Observation
import QiankunjieCore

public enum CollectDisplayState: Equatable, Sendable {
    case loading
    case content
    case empty
    case error
}

private struct CollectListOperationToken: Equatable {
    enum Kind {
        case refresh
        case loadMore
        case clearFinished
    }

    let kind: Kind
    let id = UUID()
}

private enum CollectSubmissionFailure: Error, Equatable {
    case timedOut
}

@MainActor
@Observable
public final class CollectModel {
    public var urlDraft = ""
    public var pendingDeletionJobID: Int?
    public var isClearConfirmationPresented = false
    public var onArticleImported: (@MainActor (CollectJob) -> Void)?

    public private(set) var userID: Int?
    public private(set) var jobs: [CollectJob] = []
    public private(set) var currentJob: CollectJob?
    public private(set) var total = 0
    public private(set) var hasMore = false
    public private(set) var isLoadingJobs = true
    public private(set) var isRefreshingJobs = false
    public private(set) var isLoadingMoreJobs = false
    public private(set) var isClearingFinishedJobs = false
    public private(set) var isSubmitting = false
    public private(set) var mutatingJobIDs: Set<Int> = []
    public private(set) var inputErrorMessage: String?
    public private(set) var submitErrorMessage: String?
    public private(set) var refreshErrorMessage: String?
    public private(set) var actionErrorMessage: String?

    private let repository: any CollectServicing
    private let pollInterval: Duration
    private let submissionTimeout: Duration
    private var requestGeneration = 0
    private var submissionEpoch = 0
    private var sessionGeneration = 0
    private var pollGeneration = 0
    private var clearOperationGeneration = 0
    private var activeSubmissionID: UUID?
    private var submissionContinuation: CheckedContinuation<CollectJob, Error>?
    private var activeSubmissionTask: Task<Void, Never>?
    private var submissionTimeoutTask: Task<Void, Never>?
    private let pageSize = 30
    private var nextPageOffset = 0
    private var activeListOperation: CollectListOperationToken?
    private var invalidatedListOperationIDs: Set<UUID> = []
    private var retryOperationIDs: [Int: UUID] = [:]
    private var importedArticleJobIDs: Set<Int> = []

    public init(
        repository: any CollectServicing = CollectRepository(),
        userID: Int? = nil,
        initialJobs: [CollectJob] = [],
        initialCurrentJob: CollectJob? = nil,
        pollInterval: Duration = .milliseconds(2000),
        submissionTimeout: Duration = .seconds(20)
    ) {
        self.repository = repository
        self.userID = userID
        self.jobs = initialJobs
        self.currentJob = initialCurrentJob
        self.total = initialJobs.count
        self.pollInterval = pollInterval
        self.submissionTimeout = submissionTimeout
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
        submissionEpoch += 1
        let epoch = submissionEpoch
        isSubmitting = true
        defer {
            if submissionEpoch == epoch {
                isSubmitting = false
            }
        }

        do {
            let job = try await awaitSubmission(url: url)
            guard submissionEpoch == epoch else { return }

            // 提交已经改变任务集合，使提交期间启动的列表请求失效，避免较晚返回的空列表覆盖新任务。
            requestGeneration += 1
            let isNewJob = !jobs.contains { $0.id == job.id }
            currentJob = job
            replace(job)
            if isNewJob {
                total += 1
            }
            urlDraft = ""
            isSubmitting = false
            await poll(jobID: job.id, generation: pollGeneration)
        } catch let error as CollectSubmissionFailure where error == .timedOut {
            guard submissionEpoch == epoch else { return }
            submitErrorMessage = "提交超时，请检查网络后重试；如任务已创建，可先到历史任务确认"
        } catch is CancellationError {
            guard submissionEpoch == epoch else { return }
            submitErrorMessage = "已取消提交，可修改链接后重试"
        } catch {
            guard submissionEpoch == epoch else { return }
            submitErrorMessage = Self.message(for: error)
        }
    }

    /// 用户主动取消后立即恢复输入；迟到的网络响应会因提交标识不匹配而丢弃。
    public func cancelSubmission() {
        guard isSubmitting, let submissionID = activeSubmissionID else { return }

        submissionEpoch += 1
        isSubmitting = false
        submitErrorMessage = "已取消提交，可修改链接后重试"
        finishSubmission(submissionID, with: .failure(CancellationError()))
    }

    public func refreshJobs() async {
        guard userID != nil else {
            isLoadingJobs = false
            isRefreshingJobs = false
            return
        }

        guard
            let token = beginListOperation(.refresh)
        else {
            return
        }

        requestGeneration += 1
        pollGeneration += 1
        let generation = requestGeneration
        let operationUserID = userID
        defer {
            finishListOperation(token) {
                isLoadingJobs = false
                isRefreshingJobs = false
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
            guard canApplyListOperation(token, generation: generation, userID: operationUserID) else {
                return
            }

            jobs = page.jobs
            total = page.total
            hasMore = page.hasMore
            nextPageOffset = page.hasMore ? pageSize : 0
            if let jobID = currentJob?.id {
                currentJob = page.jobs.first { $0.id == jobID }
            }
            isLoadingJobs = false
            isRefreshingJobs = false
            finishListOperation(token) {
                isLoadingJobs = false
                isRefreshingJobs = false
            }
            await pollActiveJobs(generation: pollGeneration)
        } catch {
            guard canApplyListOperation(token, generation: generation, userID: operationUserID) else {
                return
            }
            refreshErrorMessage = Self.message(for: error)
        }

    }

    public func retry(jobID: Int) async {
        guard
            userID != nil,
            !mutatingJobIDs.contains(jobID),
            retryOperationIDs[jobID] == nil,
            let failedJob = jobs.first(where: { $0.id == jobID && $0.status == "failed" })
        else { return }

        let operationID = UUID()
        let operationSessionGeneration = sessionGeneration
        let operationUserID = userID
        let pollGenerationAtStart = pollGeneration
        retryOperationIDs[jobID] = operationID
        mutatingJobIDs.insert(jobID)
        defer {
            if retryOperationIDs[jobID] == operationID {
                retryOperationIDs.removeValue(forKey: jobID)
                mutatingJobIDs.remove(jobID)
            }
        }
        actionErrorMessage = nil

        do {
            let job = try await repository.retry(id: failedJob.id)
            guard
                sessionGeneration == operationSessionGeneration,
                self.userID == operationUserID
            else { return }

            replace(job)
            if currentJob?.id == job.id {
                currentJob = job
            }
            await poll(jobID: job.id, generation: pollGenerationAtStart)

            if pollGeneration != pollGenerationAtStart {
                guard
                    sessionGeneration == operationSessionGeneration,
                    self.userID == operationUserID
                else { return }
                await poll(jobID: job.id, generation: pollGeneration)
            }
        } catch {
            guard
                sessionGeneration == operationSessionGeneration,
                self.userID == operationUserID
            else { return }
            actionErrorMessage = Self.message(for: error)
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
            !isLoadingJobs
        else {
            return
        }

        guard let token = beginListOperation(.loadMore) else {
            return
        }

        requestGeneration += 1
        let generation = requestGeneration
        let offset = nextPageOffset
        let operationUserID = userID
        isLoadingMoreJobs = true
        defer {
            finishListOperation(token) {
                isLoadingMoreJobs = false
            }
        }

        do {
            let page = try await repository.jobs(limit: pageSize, offset: offset)
            guard canApplyListOperation(token, generation: generation, userID: operationUserID) else {
                return
            }

            let existingIDs = Set(jobs.map(\.id))
            for job in page.jobs where !existingIDs.contains(job.id) {
                jobs.append(job)
            }
            total = page.total
            hasMore = page.hasMore
            nextPageOffset = offset + pageSize
        } catch {
            guard canApplyListOperation(token, generation: generation, userID: operationUserID) else {
                return
            }
            actionErrorMessage = Self.message(for: error)
        }
    }

    public func clearFinished() async {
        guard
            userID != nil,
            !jobs.isEmpty,
            activeListOperation == nil
        else {
            isClearConfirmationPresented = false
            return
        }

        let clearingJobIDs = Set(jobs.filter(\.isTerminal).map(\.id))
        guard let token = beginListOperation(.clearFinished) else {
            isClearConfirmationPresented = false
            return
        }

        mutatingJobIDs.formUnion(clearingJobIDs)
        isClearingFinishedJobs = true
        actionErrorMessage = nil
        requestGeneration += 1
        clearOperationGeneration += 1
        let generation = clearOperationGeneration
        let operationUserID = userID

        defer {
            finishListOperation(token) {
                isClearingFinishedJobs = false
                mutatingJobIDs.subtract(clearingJobIDs)
            }
        }

        do {
            let deletedCount = try await repository.clearFinished()
            guard canApplyClearOperation(token, generation: generation, userID: operationUserID) else {
                return
            }

            if deletedCount > 0 {
                let oldCount = jobs.count
                jobs.removeAll(where: \.isTerminal)
                total = max(0, total - (oldCount - jobs.count))
            }
            finishListOperation(token) {
                isClearingFinishedJobs = false
                mutatingJobIDs.subtract(clearingJobIDs)
            }
            await refreshJobs()
        } catch {
            guard canApplyClearOperation(token, generation: generation, userID: operationUserID) else {
                return
            }
            actionErrorMessage = Self.message(for: error)
        }

        isClearConfirmationPresented = false
    }

    public func prepareUser(userID: Int?) {
        submissionEpoch += 1
        sessionGeneration += 1
        if let submissionID = activeSubmissionID {
            finishSubmission(submissionID, with: .failure(CancellationError()))
        }
        requestGeneration += 1
        clearOperationGeneration += 1
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
        retryOperationIDs = [:]
        importedArticleJobIDs = []
        if let activeListOperation {
            invalidatedListOperationIDs.insert(activeListOperation.id)
        }
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

    private func awaitSubmission(url: URL) async throws -> CollectJob {
        let submissionID = UUID()
        let timeout = submissionTimeout
        let repository = repository

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                activeSubmissionID = submissionID
                submissionContinuation = continuation
                activeSubmissionTask = Task { @MainActor [weak self] in
                    guard let self else { return }

                    do {
                        let job = try await repository.submit(url: url)
                        finishSubmission(submissionID, with: .success(job))
                    } catch {
                        finishSubmission(submissionID, with: .failure(error))
                    }
                }
                submissionTimeoutTask = Task { @MainActor [weak self] in
                    do {
                        try await Task.sleep(for: timeout)
                    } catch {
                        return
                    }

                    self?.finishSubmission(
                        submissionID,
                        with: .failure(CollectSubmissionFailure.timedOut)
                    )
                }
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.abortCancelledSubmission(submissionID)
            }
        }
    }

    private func abortCancelledSubmission(_ submissionID: UUID) {
        guard activeSubmissionID == submissionID else { return }

        submissionEpoch += 1
        isSubmitting = false
        submitErrorMessage = "已取消提交，可修改链接后重试"
        finishSubmission(submissionID, with: .failure(CancellationError()))
    }

    private func finishSubmission(
        _ submissionID: UUID,
        with result: Result<CollectJob, Error>
    ) {
        guard
            activeSubmissionID == submissionID,
            let continuation = submissionContinuation
        else {
            return
        }

        activeSubmissionID = nil
        submissionContinuation = nil
        let activeTask = activeSubmissionTask
        activeSubmissionTask = nil
        let timeoutTask = submissionTimeoutTask
        submissionTimeoutTask = nil
        activeTask?.cancel()
        timeoutTask?.cancel()
        continuation.resume(with: result)
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

            if pollInterval > .zero {
                try? await Task.sleep(for: pollInterval)
            }
        }
    }

    private func replace(_ job: CollectJob) {
        if let index = jobs.firstIndex(where: { $0.id == job.id }) {
            jobs[index] = job
        } else {
            jobs.insert(job, at: 0)
        }

        guard
            job.status == "completed",
            job.articleId != nil,
            !importedArticleJobIDs.contains(job.id)
        else {
            return
        }

        importedArticleJobIDs.insert(job.id)
        onArticleImported?(job)
    }

    private func beginListOperation(_ kind: CollectListOperationToken.Kind) -> CollectListOperationToken? {
        guard activeListOperation == nil else {
            return nil
        }

        let token = CollectListOperationToken(kind: kind)
        activeListOperation = token
        return token
    }

    private func canApplyListOperation(
        _ token: CollectListOperationToken,
        generation: Int,
        userID: Int?
    ) -> Bool {
        activeListOperation == token
            && !invalidatedListOperationIDs.contains(token.id)
            && requestGeneration == generation
            && self.userID == userID
    }

    private func canApplyClearOperation(
        _ token: CollectListOperationToken,
        generation: Int,
        userID: Int?
    ) -> Bool {
        activeListOperation == token
            && !invalidatedListOperationIDs.contains(token.id)
            && clearOperationGeneration == generation
            && self.userID == userID
    }

    private func finishListOperation(
        _ token: CollectListOperationToken,
        resetting: () -> Void
    ) {
        guard invalidatedListOperationIDs.remove(token.id) == nil else {
            return
        }
        guard activeListOperation == token else {
            return
        }

        activeListOperation = nil
        resetting()
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
        case .rateLimited:
            "操作过于频繁，请稍后再试"
        case .contentUnavailable:
            "采集任务不存在或已被删除"
        case let .categoryConflict(message):
            message
        case .invalidInput:
            "请输入可公开访问的 HTTP(S) 链接"
        case .server:
            "服务暂时不可用，请稍后重试"
        }
    }
}
