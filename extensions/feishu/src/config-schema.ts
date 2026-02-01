/**
 * Feishu channel configuration schema
 */

import { MarkdownConfigSchema } from "openclaw/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

/**
 * Feishu account configuration schema
 */
const feishuAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,

  // Feishu app credentials
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  verificationToken: z.string().optional(),
  encryptKey: z.string().optional(),

  // Webhook configuration
  webhookUrl: z.string().optional(),
  webhookPath: z.string().optional(),

  // DM policy
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),

  // Media settings
  mediaMaxMb: z.number().optional(),

  // Network settings
  proxy: z.string().optional(),
  apiBase: z.string().optional(), // Support for international version (larksuite.com)
});

/**
 * Root Feishu configuration schema
 */
export const FeishuConfigSchema = feishuAccountSchema.extend({
  accounts: z.object({}).catchall(feishuAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});
