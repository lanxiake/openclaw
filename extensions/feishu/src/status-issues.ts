/**
 * Feishu status issues collection
 */

import type { ResolvedFeishuAccount } from "./types.js";

export type FeishuStatusIssue = {
  severity: "error" | "warning" | "info";
  message: string;
  fix?: string;
};

/**
 * Collect status issues for Feishu account
 */
export function collectFeishuStatusIssues(
  account: ResolvedFeishuAccount
): FeishuStatusIssue[] {
  const issues: FeishuStatusIssue[] = [];

  // Check credentials
  if (!account.appId || !account.appSecret) {
    issues.push({
      severity: "error",
      message: "Missing Feishu credentials",
      fix: "Run 'openclaw setup feishu' to configure appId and appSecret",
    });
  }

  // Check webhook configuration
  if (!account.verificationToken && account.config.webhookUrl) {
    issues.push({
      severity: "warning",
      message: "Webhook URL configured but no verification token",
      fix: "Add verificationToken to your Feishu configuration",
    });
  }

  // Check DM policy
  const dmPolicy = account.config.dmPolicy;
  if (dmPolicy === "allowlist" && (!account.config.allowFrom || account.config.allowFrom.length === 0)) {
    issues.push({
      severity: "warning",
      message: "DM policy is 'allowlist' but no users in allowFrom",
      fix: "Add user IDs to allowFrom or change dmPolicy to 'open'",
    });
  }

  // Check API base
  if (account.config.apiBase && !account.config.apiBase.startsWith("https://")) {
    issues.push({
      severity: "warning",
      message: "API base URL should use HTTPS",
      fix: "Update apiBase to use https://",
    });
  }

  return issues;
}
