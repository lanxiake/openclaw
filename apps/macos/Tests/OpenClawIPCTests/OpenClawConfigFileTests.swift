import Foundation
import Testing
@testable import MtBot

@Suite(.serialized)
struct MtBotConfigFileTests {
    @Test
    func configPathRespectsEnvOverride() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("mtbot-config-\(UUID().uuidString)")
            .appendingPathComponent("mtbot.json")
            .path

        await TestIsolation.withEnvValues(["MTBOT_CONFIG_PATH": override]) {
            #expect(MtBotConfigFile.url().path == override)
        }
    }

    @MainActor
    @Test
    func remoteGatewayPortParsesAndMatchesHost() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("mtbot-config-\(UUID().uuidString)")
            .appendingPathComponent("mtbot.json")
            .path

        await TestIsolation.withEnvValues(["MTBOT_CONFIG_PATH": override]) {
            MtBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "ws://gateway.ts.net:19999",
                    ],
                ],
            ])
            #expect(MtBotConfigFile.remoteGatewayPort() == 19999)
            #expect(MtBotConfigFile.remoteGatewayPort(matchingHost: "gateway.ts.net") == 19999)
            #expect(MtBotConfigFile.remoteGatewayPort(matchingHost: "gateway") == 19999)
            #expect(MtBotConfigFile.remoteGatewayPort(matchingHost: "other.ts.net") == nil)
        }
    }

    @MainActor
    @Test
    func setRemoteGatewayUrlPreservesScheme() async {
        let override = FileManager().temporaryDirectory
            .appendingPathComponent("mtbot-config-\(UUID().uuidString)")
            .appendingPathComponent("mtbot.json")
            .path

        await TestIsolation.withEnvValues(["MTBOT_CONFIG_PATH": override]) {
            MtBotConfigFile.saveDict([
                "gateway": [
                    "remote": [
                        "url": "wss://old-host:111",
                    ],
                ],
            ])
            MtBotConfigFile.setRemoteGatewayUrl(host: "new-host", port: 2222)
            let root = MtBotConfigFile.loadDict()
            let url = ((root["gateway"] as? [String: Any])?["remote"] as? [String: Any])?["url"] as? String
            #expect(url == "wss://new-host:2222")
        }
    }

    @Test
    func stateDirOverrideSetsConfigPath() async {
        let dir = FileManager().temporaryDirectory
            .appendingPathComponent("mtbot-state-\(UUID().uuidString)", isDirectory: true)
            .path

        await TestIsolation.withEnvValues([
            "MTBOT_CONFIG_PATH": nil,
            "MTBOT_STATE_DIR": dir,
        ]) {
            #expect(MtBotConfigFile.stateDirURL().path == dir)
            #expect(MtBotConfigFile.url().path == "\(dir)/mtbot.json")
        }
    }
}
