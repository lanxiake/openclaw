import MtBotKit
import Foundation
import Testing

@Suite struct ToolDisplayRegistryTests {
    @Test func loadsToolDisplayConfigFromBundle() {
        let url = MtBotKitResources.bundle.url(forResource: "tool-display", withExtension: "json")
        #expect(url != nil)
    }

    @Test func resolvesKnownToolFromConfig() {
        let summary = ToolDisplayRegistry.resolve(name: "bash", args: nil)
        #expect(summary.emoji == "🛠️")
        #expect(summary.title == "Bash")
    }
}
