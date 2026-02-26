import Foundation

public enum MtBotLocationMode: String, Codable, Sendable, CaseIterable {
    case off
    case whileUsing
    case always
}
