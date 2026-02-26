import Foundation

public enum MtBotCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum MtBotCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum MtBotCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum MtBotCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct MtBotCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: MtBotCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: MtBotCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: MtBotCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: MtBotCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct MtBotCameraClipParams: Codable, Sendable, Equatable {
    public var facing: MtBotCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: MtBotCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: MtBotCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: MtBotCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
