import SwiftUI

struct DeviceSessionsView: View {
    let model: SettingsModel

    var body: some View {
        Section("设备会话") {
            if model.isLoadingSessions {
                HStack {
                    ProgressView()
                        .controlSize(.small)
                    Text("正在加载 macOS 会话")
                }
            } else if model.sessions.isEmpty {
                Text(model.sessionErrorMessage ?? "暂无其他 macOS 会话")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.sessions) { session in
                    sessionRow(session)
                }
            }

            if let errorMessage = model.sessionErrorMessage, !model.sessions.isEmpty {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
            }
        }
    }

    private func sessionRow(_ session: DeviceSession) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(session.deviceName)
                        .font(.body.weight(.medium))
                    if isCurrentSession(session) {
                        Text("当前设备")
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.tint.opacity(0.14), in: Capsule())
                    }
                }
                Text("\(session.appVersion) · 最近使用 \(Self.dateText(session.lastUsedAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                Task {
                    await model.revokeSession(id: session.id)
                }
            } label: {
                if model.mutatingSessionIDs.contains(session.id) {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text(isCurrentSession(session) ? "退出" : "撤销")
                }
            }
            .buttonStyle(.borderless)
            .disabled(model.isLoggingOut || model.mutatingSessionIDs.contains(session.id))
        }
        .padding(.vertical, 2)
    }

    private func isCurrentSession(_ session: DeviceSession) -> Bool {
        model.currentSessionID == session.id
    }
}

private extension DeviceSessionsView {
    static func dateText(_ date: Date?) -> String {
        guard let date else {
            return "未知时间"
        }

        return date.formatted(
            .dateTime
                .year()
                .month()
                .day()
                .hour()
                .minute()
        )
    }
}
