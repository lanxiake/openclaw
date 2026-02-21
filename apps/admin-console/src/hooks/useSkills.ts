/**
 * 技能商店管理 Hooks
 *
 * 提供技能列表、详情、操作等 React Query Hooks
 * 使用 HTTP API 替代 WebSocket
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api-client";
import type {
  Skill,
  SkillDetail,
  SkillCategory,
  SkillListQuery,
  SkillListResponse,
  SkillStats,
  SkillReviewAction,
  SkillPublishAction,
  SkillFeaturedAction,
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/types/skill";

/**
 * 转换后端技能数据
 */
function transformSkill(backendSkill: Record<string, unknown>): Skill {
  return {
    id: backendSkill.id as string,
    name: backendSkill.name as string,
    description: backendSkill.description as string,
    version: backendSkill.version as string,
    category: backendSkill.category as string,
    categoryName: backendSkill.categoryName as string | undefined,
    icon: backendSkill.icon as string | undefined,
    author: backendSkill.author as string | undefined,
    authorId: backendSkill.authorId as string | undefined,
    status: backendSkill.status as Skill["status"],
    subscription: backendSkill.subscription as Skill["subscription"],
    runMode: backendSkill.runMode as Skill["runMode"],
    tags: backendSkill.tags as string[] | undefined,
    installCount: (backendSkill.installCount as number) || 0,
    rating: backendSkill.rating as number | undefined,
    ratingCount: (backendSkill.ratingCount as number) || 0,
    featured: Boolean(backendSkill.featured),
    featuredOrder: backendSkill.featuredOrder as number | undefined,
    createdAt: backendSkill.createdAt as string,
    updatedAt: backendSkill.updatedAt as string,
    publishedAt: backendSkill.publishedAt as string | undefined,
    sourceUrl: backendSkill.sourceUrl as string | undefined,
  };
}

/**
 * 转换后端分类数据
 */
function transformCategory(
  backendCat: Record<string, unknown>,
): SkillCategory {
  return {
    id: backendCat.id as string,
    name: backendCat.name as string,
    code: backendCat.code as string,
    description: backendCat.description as string | undefined,
    icon: backendCat.icon as string | undefined,
    sortOrder: (backendCat.sortOrder as number) || 0,
    skillCount: (backendCat.skillCount as number) || 0,
    isActive: Boolean(backendCat.isActive),
    createdAt: backendCat.createdAt as string,
    updatedAt: backendCat.updatedAt as string,
  };
}

/**
 * 获取技能统计
 */
export function useSkillStats() {
  return useQuery({
    queryKey: ["admin", "skills", "stats"],
    queryFn: async (): Promise<SkillStats> => {
      const client = getApiClient();
      const stats = await client.getSkillStats();

      return {
        totalSkills: stats.total,
        publishedSkills: stats.published,
        pendingSkills: stats.pending,
        unpublishedSkills: stats.unpublished,
        rejectedSkills: stats.rejected,
        featuredSkills: stats.featured,
        totalInstalls: 0,
        totalCategories: 0,
        categoryDistribution: [],
        subscriptionDistribution: [],
        topSkills: [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 分钟后过期
  });
}

/**
 * 获取技能列表
 */
export function useSkillList(query: SkillListQuery = {}) {
  return useQuery({
    queryKey: ["admin", "skills", "list", query],
    queryFn: async (): Promise<SkillListResponse> => {
      const client = getApiClient();
      const response = await client.getSkills({
        search: query.search,
        status: query.status,
        categoryId: query.category,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return {
        skills: response.data.map((s) =>
          transformSkill(s as unknown as Record<string, unknown>),
        ),
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * 获取技能详情
 */
export function useSkillDetail(skillId: string) {
  return useQuery({
    queryKey: ["admin", "skills", "detail", skillId],
    queryFn: async (): Promise<SkillDetail> => {
      const client = getApiClient();
      const skill = await client.getSkill(skillId);
      const transformed = transformSkill(
        skill as unknown as Record<string, unknown>,
      );
      return {
        ...transformed,
        readme: undefined,
        changelog: undefined,
        triggers: undefined,
        parameters: undefined,
        screenshots: undefined,
        reviewNotes: undefined,
        reviewedBy: undefined,
        reviewedAt: undefined,
      };
    },
    enabled: !!skillId,
    staleTime: 60 * 1000,
  });
}

/**
 * 审核技能
 */
export function useReviewSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: SkillReviewAction) => {
      const client = getApiClient();
      await client.reviewSkill(
        action.skillId,
        action.action as "approve" | "reject",
        action.notes,
      );
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 发布/下架技能
 */
export function usePublishSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: SkillPublishAction) => {
      const client = getApiClient();
      if (action.action === "publish") {
        await client.publishSkill(action.skillId);
      } else {
        await client.unpublishSkill(action.skillId);
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 设置技能推荐
 */
export function useSetFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: SkillFeaturedAction) => {
      const client = getApiClient();
      await client.setSkillFeatured(action.skillId, action.featured);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "featured"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 获取推荐技能列表
 */
export function useFeaturedSkills() {
  return useQuery({
    queryKey: ["admin", "skills", "featured"],
    queryFn: async (): Promise<Skill[]> => {
      const client = getApiClient();
      const response = await client.getSkills({ page: 1, pageSize: 100 });
      // 过滤出推荐技能
      return response.data
        .filter((s) => (s as unknown as Record<string, unknown>).isFeatured)
        .map((s) => transformSkill(s as unknown as Record<string, unknown>));
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 更新推荐技能排序
 */
export function useReorderFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_skillIds: string[]) => {
      // TODO: 后端批量排序 API 暂未实现
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "featured"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
    },
  });
}

/**
 * 获取技能分类列表
 */
export function useSkillCategories() {
  return useQuery({
    queryKey: ["admin", "skills", "categories"],
    queryFn: async (): Promise<SkillCategory[]> => {
      const client = getApiClient();
      const categories = await client.getSkillCategories();
      return categories.map((c) =>
        transformCategory(c as unknown as Record<string, unknown>),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 创建技能分类
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_input: CategoryCreateInput) => {
      // TODO: 后端分类 CRUD API 暂未实现
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 更新技能分类
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_input: CategoryUpdateInput) => {
      // TODO: 后端分类 CRUD API 暂未实现
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "categories"],
      });
    },
  });
}

/**
 * 创建技能的输入参数
 */
export interface CreateSkillInput {
  name: string;
  description?: string;
  version?: string;
  categoryId?: string;
  subscriptionLevel?: string;
  iconUrl?: string;
  tags?: string[];
  readme?: string;
  manifestUrl?: string;
  packageUrl?: string;
  config?: Record<string, unknown>;
}

/**
 * 管理员创建系统技能
 */
export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSkillInput) => {
      const client = getApiClient();
      const skill = await client.createSkill({
        name: input.name,
        description: input.description,
        version: input.version,
        categoryId: input.categoryId,
        subscriptionLevel: input.subscriptionLevel as
          | "free"
          | "pro"
          | "team"
          | "enterprise"
          | undefined,
        iconUrl: input.iconUrl,
        tags: input.tags,
        readme: input.readme,
        config: input.config,
      });
      return skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 更新技能的输入参数
 */
export interface UpdateSkillInput {
  skillId: string;
  name?: string;
  description?: string;
  version?: string;
  categoryId?: string;
  subscriptionLevel?: string;
  iconUrl?: string;
  tags?: string[];
  readme?: string;
  config?: Record<string, unknown>;
}

/**
 * 管理员更新技能
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSkillInput) => {
      const { skillId, ...data } = input;
      const client = getApiClient();
      const skill = await client.updateSkill(skillId, {
        ...data,
        subscriptionLevel: data.subscriptionLevel as
          | "free"
          | "pro"
          | "team"
          | "enterprise"
          | undefined,
      });
      return skill;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "detail", variables.skillId],
      });
    },
  });
}

/**
 * 管理员删除技能
 */
export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skillId: string) => {
      const client = getApiClient();
      await client.deleteSkill(skillId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}

/**
 * 上传技能包
 */
export function useUploadSkillPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, file }: { skillId: string; file: File }) => {
      const client = getApiClient();
      const result = await client.uploadSkillPackage(skillId, file, file.name);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "list"] });
    },
  });
}

/**
 * 删除技能分类
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_categoryId: string) => {
      // TODO: 后端分类 CRUD API 暂未实现
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "skills", "categories"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "skills", "stats"] });
    },
  });
}
