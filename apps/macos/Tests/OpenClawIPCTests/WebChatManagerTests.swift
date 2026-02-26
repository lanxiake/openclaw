import Testing
@testable import MtBot

@Suite(.serialized)
@MainActor
struct WebChatManagerTests {
    @Test func preferredSessionKeyIsNonEmpty() async {
        let key = await WebChatManager.shared.preferredSessionKey()
        #expect(!key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
}
