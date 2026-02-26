import Foundation

public enum MtBotChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(MtBotChatEventPayload)
    case agent(MtBotAgentEventPayload)
    case seqGap
}

public protocol MtBotChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> MtBotChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [MtBotChatAttachmentPayload]) async throws -> MtBotChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> MtBotChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<MtBotChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension MtBotChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "MtBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> MtBotChatSessionsListResponse {
        throw NSError(
            domain: "MtBotChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
