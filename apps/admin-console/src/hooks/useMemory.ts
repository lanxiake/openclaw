/**
 * 用户记忆管理 Hooks
 *
 * 提供用户记忆概览、事实、偏好、Workspace 文件、审计日志的 React Query Hooks。
 * 用于 Admin Console 的用户记忆管理 Tab。
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api-client";

/** 查询键前缀 */
const MEMORY_KEYS = {
  overview: (userId: string) => ["memory", "overview", userId] as const,
  facts: (userId: string) => ["memory", "facts", userId] as const,
  preferences: (userId: string) => ["memory", "preferences", userId] as const,
  workspaceFiles: (userId: string) => ["memory", "workspace-files", userId] as const,
  auditLogs: (userId: string) => ["memory", "audit-logs", userId] as const,
  defaults: ["memory", "defaults"] as const,
};

/**
 * 获取用户记忆概览
 */
export function useMemoryOverview(userId: string) {
  return useQuery({
    queryKey: MEMORY_KEYS.overview(userId),
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserMemoryOverview(userId);
    },
    enabled: !!userId,
  });
}

/**
 * 获取用户记忆事实列表
 */
export function useMemoryFacts(userId: string, params?: {
  category?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...MEMORY_KEYS.facts(userId), params],
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserMemoryFacts(userId, params);
    },
    enabled: !!userId,
  });
}

/**
 * 更新用户记忆事实
 */
export function useUpdateMemoryFact(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { factId: string; value?: string; confidence?: number }) => {
      const client = getApiClient();
      return client.updateUserMemoryFact(userId, data.factId, {
        value: data.value,
        confidence: data.confidence,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.facts(userId) });
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.overview(userId) });
    },
  });
}

/**
 * 删除用户记忆事实
 */
export function useDeleteMemoryFact(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (factId: string) => {
      const client = getApiClient();
      return client.deleteUserMemoryFact(userId, factId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.facts(userId) });
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.overview(userId) });
    },
  });
}

/**
 * 获取用户偏好
 */
export function useMemoryPreferences(userId: string) {
  return useQuery({
    queryKey: MEMORY_KEYS.preferences(userId),
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserMemoryPreferences(userId);
    },
    enabled: !!userId,
  });
}

/**
 * 获取用户 Workspace 文件列表
 */
export function useWorkspaceFiles(userId: string) {
  return useQuery({
    queryKey: MEMORY_KEYS.workspaceFiles(userId),
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserWorkspaceFiles(userId);
    },
    enabled: !!userId,
  });
}

/**
 * 更新用户 Workspace 文件
 */
export function useUpdateWorkspaceFile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { fileName: string; content: string }) => {
      const client = getApiClient();
      return client.updateUserWorkspaceFile(userId, data.fileName, data.content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.workspaceFiles(userId) });
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.overview(userId) });
    },
  });
}

/**
 * 重置用户 Workspace 文件
 */
export function useResetWorkspaceFile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileName: string) => {
      const client = getApiClient();
      return client.resetUserWorkspaceFile(userId, fileName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.workspaceFiles(userId) });
    },
  });
}

/**
 * 获取用户记忆审计日志
 */
export function useMemoryAuditLogs(userId: string, params?: {
  action?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...MEMORY_KEYS.auditLogs(userId), params],
    queryFn: async () => {
      const client = getApiClient();
      return client.getUserMemoryAuditLogs(userId, params);
    },
    enabled: !!userId,
  });
}

/**
 * 获取所有默认模板
 */
export function useMemoryDefaults() {
  return useQuery({
    queryKey: MEMORY_KEYS.defaults,
    queryFn: async () => {
      const client = getApiClient();
      return client.getMemoryDefaults();
    },
  });
}

/**
 * 更新默认模板
 */
export function useUpdateMemoryDefault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { key: string; content: string }) => {
      const client = getApiClient();
      return client.updateMemoryDefault(data.key, { content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.defaults });
    },
  });
}

/**
 * 重置默认模板
 */
export function useResetMemoryDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const client = getApiClient();
      return client.resetMemoryDefaults();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMORY_KEYS.defaults });
    },
  });
}
