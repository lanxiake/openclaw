import MtBotKit
import MtBotProtocol
import Foundation

// Prefer the MtBotKit wrapper to keep gateway request payloads consistent.
typealias AnyCodable = MtBotKit.AnyCodable
typealias InstanceIdentity = MtBotKit.InstanceIdentity

extension AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: AnyCodable]? { self.value as? [String: AnyCodable] }
    var arrayValue: [AnyCodable]? { self.value as? [AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}

extension MtBotProtocol.AnyCodable {
    var stringValue: String? { self.value as? String }
    var boolValue: Bool? { self.value as? Bool }
    var intValue: Int? { self.value as? Int }
    var doubleValue: Double? { self.value as? Double }
    var dictionaryValue: [String: MtBotProtocol.AnyCodable]? { self.value as? [String: MtBotProtocol.AnyCodable] }
    var arrayValue: [MtBotProtocol.AnyCodable]? { self.value as? [MtBotProtocol.AnyCodable] }

    var foundationValue: Any {
        switch self.value {
        case let dict as [String: MtBotProtocol.AnyCodable]:
            dict.mapValues { $0.foundationValue }
        case let array as [MtBotProtocol.AnyCodable]:
            array.map(\.foundationValue)
        default:
            self.value
        }
    }
}
