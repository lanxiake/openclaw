/**
 * Gateway 配置管理 API 路由单元测试
 *
 * 验证管理员 Gateway 配置管理的辅助函数：
 * - 敏感字段脱敏（authToken, authPassword）
 * - 配置安全级别评估
 */

import { describe, expect, it } from "vitest";

import { sanitizeGatewayConfig, assessConfigRisk } from "./gateway-config.js";

// ---------------------------------------------------------------------------
// sanitizeGatewayConfig 测试
// ---------------------------------------------------------------------------

describe("sanitizeGatewayConfig", () => {
  it("应脱敏 authToken 为最后 4 位", () => {
    const config = {
      id: "gw1",
      configType: "system",
      authMode: "token",
      authToken: "my-super-secret-token-1234",
      authPassword: null,
      gatewayMode: "local",
      gatewayPort: 18789,
    };

    const result = sanitizeGatewayConfig(config);

    expect(result.authToken).toBe("***1234");
    expect(result.authMode).toBe("token");
    expect(result.gatewayPort).toBe(18789);
  });

  it("应脱敏 authPassword 为最后 4 位", () => {
    const config = {
      id: "gw2",
      configType: "system",
      authMode: "password",
      authToken: null,
      authPassword: "my-secret-password",
      gatewayMode: "local",
      gatewayPort: 18789,
    };

    const result = sanitizeGatewayConfig(config);

    expect(result.authPassword).toBe("***word");
    expect(result.authToken).toBeNull();
  });

  it("字段为 null 时保持 null", () => {
    const config = {
      id: "gw3",
      configType: "system",
      authMode: "none",
      authToken: null,
      authPassword: null,
      gatewayMode: "local",
      gatewayPort: 18789,
    };

    const result = sanitizeGatewayConfig(config);

    expect(result.authToken).toBeNull();
    expect(result.authPassword).toBeNull();
  });

  it("super_admin 模式跳过脱敏", () => {
    const config = {
      id: "gw4",
      configType: "system",
      authMode: "token",
      authToken: "sk-secret-token-xxxx",
      authPassword: "plain-password",
      gatewayMode: "local",
      gatewayPort: 18789,
    };

    const result = sanitizeGatewayConfig(config, true);

    expect(result.authToken).toBe("sk-secret-token-xxxx");
    expect(result.authPassword).toBe("plain-password");
  });

  it("不修改原始对象（不可变性）", () => {
    const original = {
      id: "gw5",
      configType: "system",
      authMode: "token",
      authToken: "original-secret-token",
      authPassword: null,
      gatewayMode: "local",
      gatewayPort: 18789,
    };
    const originalToken = original.authToken;

    sanitizeGatewayConfig(original);

    expect(original.authToken).toBe(originalToken);
  });
});

// ---------------------------------------------------------------------------
// assessConfigRisk 测试
// ---------------------------------------------------------------------------

describe("assessConfigRisk", () => {
  it("修改 authMode 应为 high 风险", () => {
    const risk = assessConfigRisk({ authMode: "token" });
    expect(risk).toBe("high");
  });

  it("修改 authToken 应为 high 风险", () => {
    const risk = assessConfigRisk({ authToken: "new-token" });
    expect(risk).toBe("high");
  });

  it("修改 authPassword 应为 high 风险", () => {
    const risk = assessConfigRisk({ authPassword: "new-pass" });
    expect(risk).toBe("high");
  });

  it("修改 gatewayBind 应为 medium 风险", () => {
    const risk = assessConfigRisk({ gatewayBind: "0.0.0.0" });
    expect(risk).toBe("medium");
  });

  it("修改 gatewayPort 应为 medium 风险", () => {
    const risk = assessConfigRisk({ gatewayPort: 8080 });
    expect(risk).toBe("medium");
  });

  it("修改 controlUiEnabled 应为 low 风险", () => {
    const risk = assessConfigRisk({ controlUiEnabled: false });
    expect(risk).toBe("low");
  });

  it("修改 tailscaleMode 应为 medium 风险", () => {
    const risk = assessConfigRisk({ tailscaleMode: "serve" });
    expect(risk).toBe("medium");
  });

  it("空变更应为 low 风险", () => {
    const risk = assessConfigRisk({});
    expect(risk).toBe("low");
  });
});
