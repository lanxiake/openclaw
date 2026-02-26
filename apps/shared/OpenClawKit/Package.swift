// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "MtBotKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "MtBotProtocol", targets: ["MtBotProtocol"]),
        .library(name: "MtBotKit", targets: ["MtBotKit"]),
        .library(name: "MtBotChatUI", targets: ["MtBotChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "MtBotProtocol",
            path: "Sources/MtBotProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MtBotKit",
            dependencies: [
                "MtBotProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/MtBotKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MtBotChatUI",
            dependencies: [
                "MtBotKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/MtBotChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MtBotKitTests",
            dependencies: ["MtBotKit", "MtBotChatUI"],
            path: "Tests/MtBotKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
