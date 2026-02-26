import Foundation
import Testing
@testable import MtBot

@Suite struct VoiceWakeGatewaySyncTests {
    @Test func decodeGatewayTriggersFromJSONSanitizes() {
        let payload = #"{"triggers":[" mtbot  ","", "computer"]}"#
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: payload)
        #expect(triggers == ["mtbot", "computer"])
    }

    @Test func decodeGatewayTriggersFromJSONFallsBackWhenEmpty() {
        let payload = #"{"triggers":["  ",""]}"#
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: payload)
        #expect(triggers == VoiceWakePreferences.defaultTriggerWords)
    }

    @Test func decodeGatewayTriggersFromInvalidJSONReturnsNil() {
        let triggers = VoiceWakePreferences.decodeGatewayTriggers(from: "not json")
        #expect(triggers == nil)
    }
}
