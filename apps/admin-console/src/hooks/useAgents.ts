/**
 * 自定义 Agent 管理 Hooks
 *
 * 提供 Agent 列表查询、创建、更新、删除等操作的 React Query Hooks
 * 当前使用 mock 数据，待后端 API 就绪后替换为真实调用
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CustomAgent,
  AgentListQuery,
  AgentListResponse,
  CreateAgentRequest,
  UpdateAgentRequest,
} from '@/types/agent'

/**
 * Mock Agent 数据（后端 API 就绪后移除）
 */
const MOCK_AGENTS: CustomAgent[] = [
  {
    id: 'agent-main',
    name: 'OpenClaw 助手',
    description: '默认通用 AI 助手，支持对话、工具调用、文件操作等',
    systemPrompt: '你是 OpenClaw 的默认 AI 助手，帮助用户完成各种任务。',
    identity: { name: 'OpenClaw', emoji: '🤖', theme: 'blue' },
    model: { primary: 'anthropic/claude-opus-4-6' },
    tools: { autoApprove: ['search', 'calculator'] },
    sandbox: { mode: 'non-main', workspaceAccess: 'rw' },
    isEnabled: true,
    isDefault: true,
    sortOrder: 0,
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'agent-coder',
    name: '编程助手',
    description: '专注于代码编写、调试和架构设计的 AI Agent',
    systemPrompt:
      '你是一个专业的编程助手。在回答问题时，请提供高质量的代码示例，遵循最佳实践。',
    identity: { name: 'Coder', emoji: '💻', theme: 'green' },
    model: { primary: 'anthropic/claude-opus-4-6', fallbacks: ['anthropic/claude-sonnet-4-20250514'] },
    tools: {
      allowedTools: ['bash', 'file_read', 'file_write', 'search'],
      autoApprove: ['file_read', 'search'],
    },
    sandbox: { mode: 'all', workspaceAccess: 'rw' },
    isEnabled: true,
    isDefault: false,
    sortOrder: 1,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'agent-analyst',
    name: '数据分析师',
    description: '数据分析和可视化专家，善于处理复杂数据问题',
    systemPrompt: '你是一个数据分析专家，擅长 SQL、Python 数据分析和数据可视化。',
    identity: { name: 'Analyst', emoji: '📊', theme: 'purple' },
    model: { primary: 'anthropic/claude-sonnet-4-20250514' },
    sandbox: { mode: 'non-main', workspaceAccess: 'ro' },
    isEnabled: false,
    isDefault: false,
    sortOrder: 2,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-20T00:00:00Z',
  },
]

/**
 * 模拟异步延迟
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 获取 Agent 列表
 *
 * 支持搜索、状态过滤和分页
 */
export function useAgentList(query: AgentListQuery = {}) {
  return useQuery({
    queryKey: ['admin', 'agents', 'list', query],
    queryFn: async (): Promise<AgentListResponse> => {
      console.log('[useAgents] 获取 Agent 列表:', query)

      // TODO: 后端 API 就绪后替换为真实调用
      // const response = await apiClient.instance.getAgents(query)
      await delay(300)

      let filtered = [...MOCK_AGENTS]

      if (query.search) {
        const keyword = query.search.toLowerCase()
        filtered = filtered.filter(
          (a) =>
            a.name.toLowerCase().includes(keyword) ||
            a.description?.toLowerCase().includes(keyword) ||
            a.identity.name?.toLowerCase().includes(keyword),
        )
      }

      if (query.status && query.status !== 'all') {
        const isEnabled = query.status === 'enabled'
        filtered = filtered.filter((a) => a.isEnabled === isEnabled)
      }

      const page = query.page ?? 1
      const pageSize = query.pageSize ?? 20
      const start = (page - 1) * pageSize
      const paged = filtered.slice(start, start + pageSize)

      return {
        agents: paged,
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize),
      }
    },
    staleTime: 30 * 1000,
  })
}

/**
 * 获取 Agent 详情
 */
export function useAgentDetail(agentId: string) {
  return useQuery({
    queryKey: ['admin', 'agents', 'detail', agentId],
    queryFn: async (): Promise<CustomAgent | null> => {
      console.log('[useAgents] 获取 Agent 详情:', agentId)

      // TODO: 后端 API 就绪后替换为真实调用
      await delay(200)
      return MOCK_AGENTS.find((a) => a.id === agentId) ?? null
    },
    enabled: !!agentId,
    staleTime: 60 * 1000,
  })
}

/**
 * 创建 Agent
 */
export function useCreateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAgentRequest): Promise<CustomAgent> => {
      console.log('[useAgents] 创建 Agent:', input.name)

      // TODO: 后端 API 就绪后替换为真实调用
      // return apiClient.instance.createAgent(input)
      await delay(500)

      const newAgent: CustomAgent = {
        id: `agent-${Date.now()}`,
        name: input.name,
        description: input.description,
        systemPrompt: input.systemPrompt,
        identity: input.identity ?? {},
        model: input.model,
        tools: input.tools,
        sandbox: input.sandbox,
        isEnabled: input.isEnabled ?? true,
        isDefault: false,
        sortOrder: MOCK_AGENTS.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      MOCK_AGENTS.push(newAgent)
      return newAgent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
  })
}

/**
 * 更新 Agent
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { agentId: string; data: UpdateAgentRequest }): Promise<CustomAgent> => {
      console.log('[useAgents] 更新 Agent:', params.agentId)

      // TODO: 后端 API 就绪后替换为真实调用
      // return apiClient.instance.updateAgent(params.agentId, params.data)
      await delay(500)

      const idx = MOCK_AGENTS.findIndex((a) => a.id === params.agentId)
      if (idx === -1) {
        throw new Error('Agent 不存在')
      }

      const updated: CustomAgent = {
        ...MOCK_AGENTS[idx],
        ...params.data,
        identity: { ...MOCK_AGENTS[idx].identity, ...params.data.identity },
        updatedAt: new Date().toISOString(),
      }
      MOCK_AGENTS[idx] = updated
      return updated
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
  })
}

/**
 * 删除 Agent
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (agentId: string): Promise<void> => {
      console.log('[useAgents] 删除 Agent:', agentId)

      // TODO: 后端 API 就绪后替换为真实调用
      // await apiClient.instance.deleteAgent(agentId)
      await delay(500)

      const idx = MOCK_AGENTS.findIndex((a) => a.id === agentId)
      if (idx === -1) {
        throw new Error('Agent 不存在')
      }
      if (MOCK_AGENTS[idx].isDefault) {
        throw new Error('不能删除默认 Agent')
      }
      MOCK_AGENTS.splice(idx, 1)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
  })
}

/**
 * 切换 Agent 启用/禁用状态
 */
export function useToggleAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { agentId: string; isEnabled: boolean }): Promise<void> => {
      console.log('[useAgents] 切换 Agent 状态:', params.agentId, params.isEnabled)

      // TODO: 后端 API 就绪后替换为真实调用
      // await apiClient.instance.updateAgent(params.agentId, { isEnabled: params.isEnabled })
      await delay(300)

      const agent = MOCK_AGENTS.find((a) => a.id === params.agentId)
      if (!agent) {
        throw new Error('Agent 不存在')
      }
      agent.isEnabled = params.isEnabled
      agent.updatedAt = new Date().toISOString()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
  })
}
