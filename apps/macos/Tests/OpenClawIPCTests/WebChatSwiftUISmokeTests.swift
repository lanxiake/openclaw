import AppKit
import MtBotChatUI
import Foundation
import Testing
@testable import MtBot

@Suite(.serialized)
@MainActor
struct WebChatSwiftUISmokeTests {
    private struct TestTransport: MtBotChatTransport, Sendable {
        func requestHistory(sessionKey: String) async throws -> MtBotChatHistoryPayload {
            let json = """
            {"sessionKey":"\(sessionKey)","sessionId":null,"messages":[],"thinkingLevel":"off"}
            """
            return try JSONDecoder().decode(MtBotChatHistoryPayload.self, from: Data(json.utf8))
        }

        func sendMessage(
            sessionKey _: String,
            message _: String,
            thinking _: String,
            idempotencyKey _: String,
            attachments _: [MtBotChatAttachmentPayload]) async throws -> MtBotChatSendResponse
        {
            let json = """
            {"runId":"\(UUID().uuidString)","status":"ok"}
            """
            return try JSONDecoder().decode(MtBotChatSendResponse.self, from: Data(json.utf8))
        }

        func requestHealth(timeoutMs _: Int) async throws -> Bool { true }

        func events() -> AsyncStream<MtBotChatTransportEvent> {
            AsyncStream { continuation in
                continuation.finish()
            }
        }

        func setActiveSessionKey(_: String) async throws {}
    }

    @Test func windowControllerShowAndClose() {
        let controller = WebChatSwiftUIWindowController(
            sessionKey: "main",
            presentation: .window,
            transport: TestTransport())
        controller.show()
        controller.close()
    }

    @Test func panelControllerPresentAndClose() {
        let anchor = { NSRect(x: 200, y: 400, width: 40, height: 40) }
        let controller = WebChatSwiftUIWindowController(
            sessionKey: "main",
            presentation: .panel(anchorProvider: anchor),
            transport: TestTransport())
        controller.presentAnchored(anchorProvider: anchor)
        controller.close()
    }
}
