import QiankunjieAuth
import SwiftUI

@main
struct QiankunjieMacApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootWindow(model: model)
                .environment(model)
                .navigationTitle(QiankunjieMacMetadata.displayName)
                .task {
                    await model.start()
                }
        }
    }
}
