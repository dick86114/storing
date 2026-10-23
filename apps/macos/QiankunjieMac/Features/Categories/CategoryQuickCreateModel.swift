import Observation
import QiankunjieCore

@MainActor
@Observable
final class CategoryQuickCreateModel: Observable {
    let catalog: CategoryCatalogModel
    var draft: CategoryDraft {
        didSet {
            localErrorMessage = nil
            conflictSuggestion = nil
        }
    }

    private let openedUserID: Int?

    private(set) var isSubmitting = false
    private(set) var localErrorMessage: String?
    private(set) var conflictSuggestion: ArticleCategory?

    @ObservationIgnored private var submissionTask: Task<ArticleCategory?, Never>?
    @ObservationIgnored private var cancellationRefreshTask: Task<Void, Never>?

    init(catalog: CategoryCatalogModel, initialName: String = "") {
        self.catalog = catalog
        self.openedUserID = catalog.userID

        var initialDraft = CategoryDraft()
        initialDraft.name = initialName
        initialDraft.color = CategoryQuickCreatePolicy.suggestedColor(
            for: initialName,
            existingColors: catalog.activeCategories.compactMap(\.color)
        )
        draft = initialDraft
    }

    var normalizedName: String {
        CategoryQuickCreatePolicy.normalizedName(draft.name)
    }

    var sameNameSuggestion: ArticleCategory? {
        guard !normalizedName.isEmpty else { return nil }
        return catalog.activeCategories.first {
            $0.name.localizedCaseInsensitiveCompare(normalizedName) == .orderedSame
        }
    }

    var displayedErrorMessage: String? {
        catalog.errorMessage ?? localErrorMessage
    }

    var isStaleForCurrentUser: Bool {
        catalog.userID != openedUserID
    }

    var isInitialLoading: Bool {
        catalog.isLoading && !catalog.hasLoadedCatalog
    }

    var isInteractionDisabled: Bool {
        isSubmitting || catalog.isMutating || catalog.isLoading || isStaleForCurrentUser
    }

    var canSubmit: Bool {
        CategoryQuickCreatePolicy.canSubmit(
            name: draft.name,
            isSubmitting: isSubmitting
        )
        && catalog.hasLoadedCatalog
        && !catalog.isLoading
        && !catalog.isMutating
        && !isStaleForCurrentUser
        && sameNameSuggestion == nil
    }

    /// 发起提交并返回可等待任务；取消后任务固定返回 nil，调用方不得导航。
    @discardableResult
    func startSubmission() -> Task<ArticleCategory?, Never>? {
        guard canSubmit else { return nil }

        localErrorMessage = nil
        conflictSuggestion = nil
        catalog.clearError()
        var submittedDraft = draft
        submittedDraft.name = normalizedName
        draft = submittedDraft
        isSubmitting = true

        let task = Task { @MainActor [weak self] () -> ArticleCategory? in
            guard let self else { return nil }
            return await performSubmission(submittedDraft)
        }
        submissionTask = task
        return task
    }

    /// 取消会立即终止本地导航，并等待可能已发出的创建请求结束后强制刷新目录。
    func cancel() {
        let inFlightTask = submissionTask
        inFlightTask?.cancel()
        isSubmitting = false

        guard inFlightTask != nil else { return }
        let message = "已取消创建。分类可能已在服务器创建，正在刷新分类目录。"
        catalog.presentError(message)
        cancellationRefreshTask?.cancel()
        cancellationRefreshTask = Task { @MainActor [self] in
            if let inFlightTask {
                _ = await inFlightTask.value
            }
            guard self.catalog.userID == self.openedUserID else {
                self.cancellationRefreshTask = nil
                return
            }
            await self.catalog.load()
            if let refreshError = self.catalog.errorMessage {
                self.catalog.presentError("\(message) 目录刷新失败：\(refreshError)")
            } else {
                self.catalog.presentError(message)
            }
            self.cancellationRefreshTask = nil
        }
    }

    func handleUserChanged() {
        submissionTask?.cancel()
        cancellationRefreshTask?.cancel()
        submissionTask = nil
        cancellationRefreshTask = nil
        isSubmitting = false
        localErrorMessage = nil
        conflictSuggestion = nil
    }

    func useExistingCategory() -> ArticleCategory? {
        guard let suggestion = conflictSuggestion ?? sameNameSuggestion else { return nil }
        guard !isStaleForCurrentUser else { return nil }
        conflictSuggestion = nil
        localErrorMessage = nil
        catalog.clearError()
        return suggestion
    }

    func clearLocalError() {
        localErrorMessage = nil
    }

    func presentLocalError(_ message: String) {
        localErrorMessage = message
    }

    func waitForCancellationRefreshCompletion() async {
        await cancellationRefreshTask?.value
    }

    private func performSubmission(_ submittedDraft: CategoryDraft) async -> ArticleCategory? {
        defer {
            if !Task.isCancelled {
                isSubmitting = false
            }
            submissionTask = nil
        }

        do {
            let category = try await catalog.create(submittedDraft)
            guard !Task.isCancelled, catalog.userID == openedUserID else { return nil }
            isSubmitting = false
            return category
        } catch {
            guard !Task.isCancelled, catalog.userID == openedUserID else { return nil }
            isSubmitting = false

            if case let AppError.categoryConflict(message) = error {
                if sameNameSuggestion == nil {
                    await catalog.load()
                }
                conflictSuggestion = sameNameSuggestion
                localErrorMessage = conflictSuggestion == nil
                    ? message
                    : "已存在同名启用分类，请使用现有分类"
            } else {
                localErrorMessage = managementErrorMessage(for: error)
            }
            return nil
        }
    }
}
