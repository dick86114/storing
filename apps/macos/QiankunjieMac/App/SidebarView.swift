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
                if !isCollapsed {
                    collectRow
                }

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
        .safeAreaInset(edge: .bottom) {
            bottomControls
        }
    }

    private var bottomControls: some View {
        VStack(spacing: 10) {
            if isCollapsed {
                collectButton
            }

            accountButton
                .popover(
                    isPresented: $showsAccountMenu,
                    arrowEdge: .bottom
                ) {
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
        }
        .padding(.horizontal, isCollapsed ? 10 : 12)
        .padding(.bottom, 12)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                showsCollectPulse = true
            }
        }
    }

    private var collectButton: some View {
        let accent = QiankunjieColors.accent(for: colorScheme)

        return Button {
            triggerCollect()
        } label: {
            collectButtonIcon
                .rotationEffect(.degrees(collectIconRotation))
        }
        .background {
            ZStack {
                Circle()
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
            Circle()
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
        .buttonStyle(CollectFabButtonStyle())
    }

    /// 采集入口：与「收件箱」等菜单行同宽同高的长条按钮，排在菜单第一行。
    private var collectRow: some View {
        let accent = QiankunjieColors.accent(for: colorScheme)

        return Button {
            triggerCollect()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .bold))
                    .frame(width: 18)
                    .rotationEffect(.degrees(collectIconRotation))

                Text("采集")
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity, minHeight: 26, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                accent.opacity(isCollectButtonHovered ? 1 : 0.96),
                                accent.opacity(0.78),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(
                        color: accent.opacity(isCollectButtonHovered ? 0.3 : 0.14),
                        radius: isCollectButtonHovered ? 6 : 3,
                        y: 1
                    )
            }
            .contentShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        }
        .buttonStyle(.plain)
        .scaleEffect(isCollectActive ? 0.98 : 1)
        .onHover { hovering in
            withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                isCollectButtonHovered = hovering
            }
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.72), value: isCollectActive)
        .help("采集")
        .accessibilityLabel("采集")
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
            .frame(width: 36, height: 36)
            .contentShape(Circle())
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
                maxWidth: isCollapsed ? 38 : .infinity,
                alignment: isCollapsed ? .center : .leading
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
}

private struct CollectFabButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(Color.clear)
            .contentShape(Circle())
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
