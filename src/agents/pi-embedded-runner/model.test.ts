import { describe, expect, it, vi } from "vitest";

vi.mock("../pi-model-discovery.js", () => ({
  discoverAuthStorage: vi.fn(() => ({ mocked: true })),
  discoverModels: vi.fn(() => ({ find: vi.fn(() => null) })),
}));

import type { OpenClawConfig } from "../../config/config.js";
import { buildInlineProviderModels, resolveModel } from "./model.js";

const makeModel = (id: string) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text"] as const,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1,
  maxTokens: 1,
});

describe("buildInlineProviderModels", () => {
  it("attaches provider ids to inline models", () => {
    const providers = {
      " alpha ": { baseUrl: "http://alpha.local", models: [makeModel("alpha-model")] },
      beta: { baseUrl: "http://beta.local", models: [makeModel("beta-model")] },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toEqual([
      {
        ...makeModel("alpha-model"),
        provider: "alpha",
        baseUrl: "http://alpha.local",
        api: undefined,
      },
      {
        ...makeModel("beta-model"),
        provider: "beta",
        baseUrl: "http://beta.local",
        api: undefined,
      },
    ]);
  });

  it("inherits baseUrl from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].baseUrl).toBe("http://localhost:8000");
  });

  it("inherits api from provider when model does not specify it", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "anthropic-messages",
        models: [makeModel("custom-model")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("model-level api takes precedence over provider-level api", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:8000",
        api: "openai-responses",
        models: [{ ...makeModel("custom-model"), api: "anthropic-messages" as const }],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });

  it("inherits both baseUrl and api from provider config", () => {
    const providers = {
      custom: {
        baseUrl: "http://localhost:10000",
        api: "anthropic-messages",
        models: [makeModel("claude-opus-4.5")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      provider: "custom",
      baseUrl: "http://localhost:10000",
      api: "anthropic-messages",
      name: "claude-opus-4.5",
    });
  });

  it("normalizes legacy api type 'anthropic' to 'anthropic-messages' in inline models", () => {
    const providers = {
      relay: {
        baseUrl: "http://localhost:8080",
        api: "anthropic",
        models: [makeModel("claude-opus-4-5")],
      },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toHaveLength(1);
    expect(result[0].api).toBe("anthropic-messages");
  });
});

describe("resolveModel", () => {
  it("includes provider baseUrl in fallback model", () => {
    const cfg = {
      models: {
        providers: {
          custom: {
            baseUrl: "http://localhost:9000",
            models: [],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("custom", "missing-model", "/tmp/agent", cfg);

    expect(result.model?.baseUrl).toBe("http://localhost:9000");
    expect(result.model?.provider).toBe("custom");
    expect(result.model?.id).toBe("missing-model");
  });

  it("should resolve custom provider (new-api) with model id correctly", () => {
    /** 模拟 new-api 提供商配置（类似数据库 model_providers 合并后的 cfg） */
    const cfg = {
      models: {
        providers: {
          "new-api": {
            baseUrl: "http://localhost:35019",
            api: "openai-completions",
            models: [],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("new-api", "claude-opus-4-5-20251101", "/tmp/agent", cfg);

    expect(result.error).toBeUndefined();
    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("claude-opus-4-5-20251101");
    expect(result.model?.provider).toBe("new-api");
    expect(result.model?.baseUrl).toBe("http://localhost:35019");
    expect(result.model?.api).toBe("openai-completions");
  });

  it("should return Unknown model error when provider not in config", () => {
    /** 提供商不存在于 cfg.models.providers */
    const cfg = {
      models: {
        providers: {},
      },
    } as OpenClawConfig;

    const result = resolveModel("nonexistent", "some-model", "/tmp/agent", cfg);

    expect(result.error).toBe("Unknown model: nonexistent/some-model");
    expect(result.model).toBeUndefined();
  });

  it("should use provider-level api type in fallback model", () => {
    const cfg = {
      models: {
        providers: {
          "my-relay": {
            baseUrl: "http://relay.local:8080",
            api: "anthropic-messages",
            models: [makeModel("claude-sonnet-4-20250514")],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("my-relay", "claude-sonnet-4-20250514", "/tmp/agent", cfg);

    expect(result.error).toBeUndefined();
    expect(result.model?.api).toBe("anthropic-messages");
    expect(result.model?.baseUrl).toBe("http://relay.local:8080");
  });

  it("should normalize legacy api type 'anthropic' to 'anthropic-messages'", () => {
    /** 模拟旧版 Admin Console 保存了错误的 apiType="anthropic" */
    const cfg = {
      models: {
        providers: {
          "new-api": {
            baseUrl: "http://localhost:35019",
            api: "anthropic",
            models: [],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("new-api", "claude-opus-4-5-20251101", "/tmp/agent", cfg);

    expect(result.error).toBeUndefined();
    expect(result.model?.api).toBe("anthropic-messages");
  });

  it("should normalize legacy api type 'google-gemini' to 'google-generative-ai'", () => {
    const cfg = {
      models: {
        providers: {
          "google-relay": {
            baseUrl: "http://localhost:8080",
            api: "google-gemini",
            models: [],
          },
        },
      },
    } as OpenClawConfig;

    const result = resolveModel("google-relay", "gemini-pro", "/tmp/agent", cfg);

    expect(result.error).toBeUndefined();
    expect(result.model?.api).toBe("google-generative-ai");
  });
});
