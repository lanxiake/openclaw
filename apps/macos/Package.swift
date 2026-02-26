// swift-tools-version: 6.2
// Package manifest for the MtBot macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "MtBot",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "MtBotIPC", targets: ["MtBotIPC"]),
        .library(name: "MtBotDiscovery", targets: ["MtBotDiscovery"]),
        .executable(name: "MtBot", targets: ["MtBot"]),
        .executable(name: "mtbot-mac", targets: ["MtBotMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/MtBotKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "MtBotIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MtBotDiscovery",
            dependencies: [
                .product(name: "MtBotKit", package: "MtBotKit"),
            ],
            path: "Sources/MtBotDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MtBot",
            dependencies: [
                "MtBotIPC",
                "MtBotDiscovery",
                .product(name: "MtBotKit", package: "MtBotKit"),
                .product(name: "MtBotChatUI", package: "MtBotKit"),
                .product(name: "MtBotProtocol", package: "MtBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/MtBot.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MtBotMacCLI",
            dependencies: [
                "MtBotDiscovery",
                .product(name: "MtBotKit", package: "MtBotKit"),
                .product(name: "MtBotProtocol", package: "MtBotKit"),
            ],
            path: "Sources/MtBotMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MtBotIPCTests",
            dependencies: [
                "MtBotIPC",
                "MtBot",
                "MtBotDiscovery",
                .product(name: "MtBotProtocol", package: "MtBotKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
