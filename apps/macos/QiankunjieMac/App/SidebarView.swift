import QiankunjieAuth
import QiankunjieDesignSystem
import SwiftUI

struct SidebarView: View {
    @Bindable var model: AppModel
    let destinationSelection: Binding<AppDestination>
    var isCollapsed = false
    @Environment(\.colorScheme) private var colorScheme
    @State private var showsAccountMenu = false
    @State private var isCollectButtonHovered = false
    @State private var isCollectActive = false
    @State private var showsCollectPulse = false
    @State private var collectIconRotation: Double = 0

    var body: some View {
        List(selection: destinationSelection) {
            Section(isCollapsed ? "" : "资料库") {
                ForEach(AppDestination.sidebarDestinations, id: \.self) { destination in
                    Group {
                        if isCollapsed {
                            Image(systemName: destination.systemImage)
                                .font(.system(size: 20, weight: .medium))
                                .frame(width: 30, height: 30)
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: destination.systemImage)
                                    .frame(width: 18)

                                // 显式展示文本，避免窄侧栏时 SwiftUI Label 隐藏栏目名。
                                Text(destination.title)
                                    .lineLimit(1)

                                Spacer(minLength: 0)

                                if let count = destination.libraryView.flatMap({ model.libraryModel.count(for: $0) }) {
                                    Text("\(count)")
                                        .font(.caption)
                                        .monospacedDigit()
                                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: isCollapsed ? 42 : 0, alignment: .center)
                    .tag(destination)
                }
            }
        }
        .listStyle(.sidebar)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
        .safeAreaInset(edge: .top) {
            topControls
        }
        .safeAreaInset(edge: .bottom) {
            bottomControls
        }
    }

    private var topControls: some View {
        VStack(spacing: 12) {
            brandHeader

            if !isCollapsed {
                searchField
            }
        }
        .padding(.horizontal, isCollapsed ? 10 : 12)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(QiankunjieColors.surfaceVariant(for: colorScheme))
    }

    private var brandHeader: some View {
        HStack(spacing: 9) {
            BrandAssetName.brandLogo.image
                .resizable()
                .scaledToFit()
                .frame(width: 30, height: 30)
                .accessibilityLabel(BrandAssetName.brandLogo.accessibilityLabel)

            if !isCollapsed {
                VStack(alignment: .leading, spacing: 1) {
                    Text(QiankunjieMacMetadata.displayName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(1)

                    Text("v\(QiankunjieMacMetadata.appVersion)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                        .monospacedDigit()
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .accessibilityElement(children: .combine)
    }

    private var bottomControls: some View {
        Group {
            if isCollapsed {
                VStack(spacing: 8) {
                    sidebarCollectButton

                    accountButton
                }
            } else {
                HStack(spacing: 8) {
                    accountButton

                    sidebarCollectButton
                }
            }
        }
        .popover(isPresented: $showsAccountMenu, arrowEdge: .bottom) {
            AccountMenuView(
                user: model.user,
                colorScheme: colorScheme,
                onLogin: {
                    showsAccountMenu = false
                    model.presentLogin()
                },
                onLogout: {
                    showsAccountMenu = false
                    Task {
                        await model.didLogout()
                    }
                },
                onSettings: {
                    showsAccountMenu = false
                    destinationSelection.wrappedValue = .settings
                },
                onAdminSettings: {
                    showsAccountMenu = false
                    destinationSelection.wrappedValue = .admin
                }
            )
        }
        .padding(.horizontal, isCollapsed ? 10 : 12)
        .padding(.bottom, 12)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                showsCollectPulse = true
            }
        }
    }

    private var sidebarCollectButton: some View {
        let accent = QiankunjieColors.accent(for: colorScheme)

        return Button {
            triggerCollect()
        } label: {
            collectButtonIcon
                .rotationEffect(.degrees(collectIconRotation))
        }
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                accent.opacity(isCollectButtonHovered ? 1 : 0.92),
                                accent.opacity(0.72),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(
                    accent.opacity(showsCollectPulse ? 0.38 : 0.06),
                    lineWidth: showsCollectPulse ? 2 : 1
                )
                .scaleEffect(showsCollectPulse ? 1.08 : 0.96)
                .allowsHitTesting(false)
        }
        .scaleEffect(isCollectActive ? 0.94 : isCollectButtonHovered ? 1.06 : 1)
        .shadow(color: accent.opacity(isCollectButtonHovered ? 0.34 : 0.16), radius: isCollectButtonHovered ? 10 : 5, y: 2)
        .onHover { hovering in
            withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                isCollectButtonHovered = hovering
            }
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.72), value: isCollectActive)
        .animation(.spring(response: 0.28, dampingFraction: 0.72), value: model.destination)
        .help("采集")
        .accessibilityLabel("采集")
        .accessibilityAddTraits(.isButton)
        .frame(width: 38, height: 38)
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func triggerCollect() {
        isCollectActive = true
        withAnimation(.spring(response: 0.34, dampingFraction: 0.62)) {
            collectIconRotation += 180
        }

        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(260))
            isCollectActive = false
            model.selectDestination(.collect)
        }
    }

    private var collectButtonIcon: some View {
        Image(systemName: "plus")
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 30, height: 30)
            .contentShape(Rectangle())
    }

    private var accountButton: some View {
        Button {
            showsAccountMenu = true
        } label: {
            HStack(spacing: 9) {
                accountAvatar

                if !isCollapsed {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.user?.username ?? "未登录")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                            .lineLimit(1)
                            .truncationMode(.middle)

                        Text(model.user == nil ? "登录以同步资料" : "乾坤戒账号")
                            .font(.system(size: 11))
                            .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.up")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }
            .padding(7)
            .frame(
                maxWidth: .infinity,
                alignment: .leading
            )
            .background {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(QiankunjieColors.surface(for: colorScheme))
                    .overlay {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(QiankunjieColors.outline(for: colorScheme))
                    }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help("账号操作")
        .accessibilityLabel("账号操作")
    }

    private var accountAvatar: some View {
        Circle()
            .fill(QiankunjieColors.accent(for: colorScheme).opacity(0.12))
            .frame(width: 26, height: 26)
            .overlay {
                if let user = model.user {
                    Text(String(user.username.prefix(1)).uppercased())
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                } else {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 15))
                        .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                }
            }
    }

    private var searchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))

            TextField("搜索文章", text: searchBinding)
                .textFieldStyle(.plain)
                .onSubmit(submitSearch)
                .accessibilityLabel("搜索关键词")

            if !model.libraryModel.searchDraft.isEmpty {
                Button {
                    clearSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
                .buttonStyle(.plain)
                .help("清除搜索")
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 32)
        .background(QiankunjieColors.surface(for: colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: QiankunjieRadius.control, style: .continuous)
                .strokeBorder(QiankunjieColors.outline(for: colorScheme))
        }
        .help("搜索文章")
    }

    private var searchBinding: Binding<String> {
        Binding(
            get: { model.libraryModel.searchDraft },
            set: { model.libraryModel.searchDraft = $0 }
        )
    }

    private func submitSearch() {
        model.libraryModel.submitSearch()
        reloadLibrary()
    }

    private func clearSearch() {
        model.libraryModel.clearSearch()
        reloadLibrary()
    }

    private func reloadLibrary() {
        Task {
            await model.libraryModel.load(reset: true)
        }
    }
}

private struct AccountMenuView: View {
    let user: AuthenticatedUser?
    let colorScheme: ColorScheme
    let onLogin: () -> Void
    let onLogout: () -> Void
    let onSettings: () -> Void
    let onAdminSettings: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                Circle()
                    .fill(QiankunjieColors.accent(for: colorScheme).opacity(0.12))
                    .frame(width: 34, height: 34)
                    .overlay {
                        if let user {
                            Text(String(user.username.prefix(1)).uppercased())
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                        } else {
                            Image(systemName: "person.crop.circle")
                                .font(.system(size: 19))
                                .foregroundStyle(QiankunjieColors.accent(for: colorScheme))
                        }
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(user?.username ?? "未登录")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
                        .lineLimit(1)

                    Text(user == nil ? "登录后可同步文章" : "乾坤戒账号")
                        .font(.system(size: 11))
                        .foregroundStyle(QiankunjieColors.onSurfaceVariant(for: colorScheme))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)

            Divider()
                .padding(.vertical, 4)

            if user == nil {
                menuButton("登录", systemImage: "person.badge.key", action: onLogin)
            } else {
            }

            menuButton("设置", systemImage: "gearshape", action: onSettings)
            if user?.role == "admin" {
                menuButton(
                    "管理员设置",
                    systemImage: "shield.lefthalf.filled",
                    action: onAdminSettings
                )
            }
            if user != nil {
                menuButton(
                    "退出登录",
                    systemImage: "rectangle.portrait.and.arrow.right",
                    action: onLogout
                )
            }
        }
        .padding(6)
        .frame(width: 216)
        .background(QiankunjieColors.surface(for: colorScheme))
    }

    private func menuButton(
        _ title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: systemImage)
                    .font(.system(size: 13))
                    .frame(width: 18)

                Text(title)
                    .font(.system(size: 13))

                Spacer(minLength: 0)
            }
            .foregroundStyle(QiankunjieColors.onSurface(for: colorScheme))
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.clear)
        }
    }
}
