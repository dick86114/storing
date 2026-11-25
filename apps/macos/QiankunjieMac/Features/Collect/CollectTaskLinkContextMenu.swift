import AppKit
import QiankunjieCore
import SwiftUI

struct CollectTaskLinkContextMenu: ViewModifier {
    let job: CollectJob

    @ViewBuilder
    func body(content: Content) -> some View {
        if let url = CollectTaskLink.url(for: job) {
            content.contextMenu {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(url.absoluteString, forType: .string)
                } label: {
                    Label("复制链接", systemImage: "link")
                }
                Button {
                    NSWorkspace.shared.open(url)
                } label: {
                    Label("用默认浏览器打开", systemImage: "safari")
                }
            }
        } else {
            content
        }
    }
}
