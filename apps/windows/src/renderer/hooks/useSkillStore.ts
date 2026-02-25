/**
 * useSkillStore Hook - 技能商店
 *
 * 管理技能商店的浏览、搜索、安装等功能
 * 通过 API Server REST API 与后端交互
 */

import { useState, useCallback } from "react";

/**
 * 商店技能信息
 */
export interface StoreSkillInfo {
  /** 技能 ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 详细描述 */
  longDescription?: string;
  /** 版本 */
  version: string;
  /** 作者 */
  author: string;
  /** 图标 */
  icon?: string;
  /** 分类 */
  category: string;
  /** 标签 */
  tags: string[];
  /** 运行模式 */
  runMode: "server" | "local" | "hybrid";
  /** 订阅要求 */
  subscription: {
    type: "free" | "premium" | "enterprise";
    price?: number;
    period?: "monthly" | "yearly" | "once";
  };
  /** 下载次数 */
  downloads: number;
  /** 评分 */
  rating: number;
  /** 评分人数 */
  ratingCount: number;
  /** 更新时间 */
  updatedAt: string;
  /** 截图 */
  screenshots?: string[];
  /** 源 URL */
  sourceUrl?: string;
  /** 是否已安装 */
  installed?: boolean;
  /** 安装的版本 */
  installedVersion?: string;
  /** 是否有可用更新 */
  hasUpdate?: boolean;
}

/**
 * 技能分类信息
 */
export interface SkillCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

/**
 * 商店筛选条件
 */
export interface StoreFilters {
  category?: string;
  tags?: string[];
  subscription?: "free" | "premium" | "enterprise" | "all";
  sortBy?: "downloads" | "rating" | "updated" | "name";
  search?: string;
}

/**
 * 商店统计信息
 */
export interface StoreStats {
  totalSkills: number;
  totalDownloads: number;
  categories: SkillCategory[];
  popularTags: string[];
}

/**
 * 技能上传数据
 */
export interface SkillUploadData {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 详细说明 (Markdown) */
  readme?: string;
  /** 版本号 */
  version: string;
  /** 分类 ID */
  categoryId?: string;
  /** 标签列表 */
  tags?: string[];
  /** 订阅级别要求 */
  subscriptionLevel?: "free" | "monthly" | "yearly";
  /** 图标 URL */
  iconUrl?: string;
  /** 技能配置文件 URL */
  manifestUrl?: string;
  /** 技能包下载 URL */
  packageUrl?: string;
  /** 技能配置 (JSON) */
  config?: Record<string, unknown>;
}

interface UseSkillStoreReturn {
  /** 商店技能列表 */
  skills: StoreSkillInfo[];
  /** 推荐技能 */
  featured: StoreSkillInfo[];
  /** 热门技能 */
  popular: StoreSkillInfo[];
  /** 最新技能 */
  recent: StoreSkillInfo[];
  /** 商店统计 */
  stats: StoreStats | null;
  /** 分类列表 */
  categories: SkillCategory[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在上传 */
  isUploading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 当前筛选条件 */
  filters: StoreFilters;
  /** 是否有更多数据可加载 */
  hasMore: boolean;
  /** 是否正在刷新商店 */
  isRefreshing: boolean;

  /** 加载商店技能列表 */
  loadStoreSkills: (filters?: StoreFilters) => Promise<void>;
  /** 加载更多技能（分页） */
  loadMore: () => Promise<void>;
  /** 加载推荐技能 */
  loadFeatured: () => Promise<void>;
  /** 加载热门技能 */
  loadPopular: () => Promise<void>;
  /** 加载最新技能 */
  loadRecent: () => Promise<void>;
  /** 加载商店统计 */
  loadStats: () => Promise<void>;
  /** 加载分类列表 */
  loadCategories: () => Promise<void>;
  /** 搜索技能 */
  searchSkills: (query: string) => Promise<void>;
  /** 设置筛选条件 */
  setFilters: (filters: StoreFilters) => void;
  /** 获取技能详情 */
  getSkillDetail: (skillId: string) => Promise<StoreSkillInfo | null>;
  /** 安装技能 */
  installSkill: (skillId: string) => Promise<{ success: boolean; error?: string }>;
  /** 卸载技能（从商店取消安装） */
  uninstallSkill: (skillId: string) => Promise<{ success: boolean; error?: string }>;
  /** 上传技能 */
  uploadSkill: (
    data: SkillUploadData,
  ) => Promise<{ success: boolean; skillId?: string; error?: string }>;
  /** 检查更新 */
  checkUpdates: () => Promise<StoreSkillInfo[]>;
  /** 刷新商店 */
  refreshStore: () => Promise<void>;
}

/**
 * 技能商店 Hook
 */
export function useSkillStore(): UseSkillStoreReturn {
  const [skills, setSkills] = useState<StoreSkillInfo[]>([]);
  const [featured, setFeatured] = useState<StoreSkillInfo[]>([]);
  const [popular, setPopular] = useState<StoreSkillInfo[]>([]);
  const [recent, setRecent] = useState<StoreSkillInfo[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StoreFilters>({});
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  /** 每页加载数量 */
  const PAGE_SIZE = 50;

  /**
   * 加载商店技能列表
   */
  const loadStoreSkills = useCallback(
    async (newFilters?: StoreFilters) => {
      console.log("[useSkillStore] 加载商店技能列表", newFilters);
      setIsLoading(true);
      setError(null);

      if (newFilters) {
        setFilters(newFilters);
      }

      try {
        const currentFilters = newFilters || filters;

        // 通过 REST API 获取商店技能列表
        const result = (await window.electronAPI.api.getStoreSkills({
          category: currentFilters.category,
          subscription: currentFilters.subscription,
          sortBy: currentFilters.sortBy,
          search: currentFilters.search,
          tags: currentFilters.tags,
          offset: 0,
          limit: PAGE_SIZE,
        })) as {
          success: boolean;
          data?: StoreSkillInfo[];
          meta?: { total: number; hasMore?: boolean };
          error?: string;
        };

        if (result.success && result.data) {
          setSkills(result.data);
          setCurrentOffset(result.data.length);
          const total = result.meta?.total ?? result.data.length;
          setHasMore(result.meta?.hasMore ?? result.data.length < total);
          console.log(
            "[useSkillStore] 加载成功，共",
            total,
            "个技能，hasMore:",
            result.meta?.hasMore ?? result.data.length < total,
          );
        } else {
          console.error("[useSkillStore] 加载失败:", result.error);
          setError(result.error || "加载商店失败");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "加载商店失败";
        console.error("[useSkillStore] 加载失败:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [filters],
  );

  /**
   * 加载更多技能（分页追加）
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    console.log("[useSkillStore] 加载更多技能, offset:", currentOffset);
    setIsLoading(true);

    try {
      const result = (await window.electronAPI.api.getStoreSkills({
        category: filters.category,
        subscription: filters.subscription,
        sortBy: filters.sortBy,
        search: filters.search,
        tags: filters.tags,
        offset: currentOffset,
        limit: PAGE_SIZE,
      })) as {
        success: boolean;
        data?: StoreSkillInfo[];
        meta?: { total: number; hasMore?: boolean };
        error?: string;
      };

      if (result.success && result.data) {
        setSkills((prev) => [...prev, ...result.data!]);
        setCurrentOffset((prev) => prev + result.data!.length);
        const total = result.meta?.total ?? 0;
        setHasMore(result.meta?.hasMore ?? currentOffset + result.data.length < total);
        console.log("[useSkillStore] 追加加载成功，新增", result.data.length, "个技能");
      }
    } catch (err) {
      console.error("[useSkillStore] 加载更多失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentOffset, filters]);

  /**
   * 加载推荐技能
   */
  const loadFeatured = useCallback(async () => {
    console.log("[useSkillStore] 加载推荐技能");
    try {
      const result = (await window.electronAPI.api.getStoreFeatured(3)) as {
        success: boolean;
        data?: StoreSkillInfo[];
        error?: string;
      };

      if (result.success && result.data) {
        setFeatured(result.data);
      }
    } catch (err) {
      console.error("[useSkillStore] 加载推荐失败:", err);
    }
  }, []);

  /**
   * 加载热门技能
   */
  const loadPopular = useCallback(async () => {
    console.log("[useSkillStore] 加载热门技能");
    try {
      const result = (await window.electronAPI.api.getStorePopular(4)) as {
        success: boolean;
        data?: StoreSkillInfo[];
        error?: string;
      };

      if (result.success && result.data) {
        setPopular(result.data);
      }
    } catch (err) {
      console.error("[useSkillStore] 加载热门失败:", err);
    }
  }, []);

  /**
   * 加载最新技能
   */
  const loadRecent = useCallback(async () => {
    console.log("[useSkillStore] 加载最新技能");
    try {
      const result = (await window.electronAPI.api.getStoreRecent(4)) as {
        success: boolean;
        data?: StoreSkillInfo[];
        error?: string;
      };

      if (result.success && result.data) {
        setRecent(result.data);
      }
    } catch (err) {
      console.error("[useSkillStore] 加载最新失败:", err);
    }
  }, []);

  /**
   * 加载商店统计
   */
  const loadStats = useCallback(async () => {
    console.log("[useSkillStore] 加载商店统计");
    try {
      const result = (await window.electronAPI.api.getStoreStats()) as {
        success: boolean;
        data?: StoreStats;
        error?: string;
      };

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error("[useSkillStore] 加载统计失败:", err);
    }
  }, []);

  /**
   * 加载分类列表
   */
  const loadCategories = useCallback(async () => {
    console.log("[useSkillStore] 加载分类列表");
    try {
      const result = (await window.electronAPI.api.getStoreCategories()) as {
        success: boolean;
        data?: Array<{
          id: string;
          name: string;
          icon: string;
          skillCount: number;
        }>;
        error?: string;
      };

      if (result.success && result.data) {
        // 转换为 SkillCategory 格式
        const mappedCategories: SkillCategory[] = result.data.map((item) => ({
          id: item.id,
          name: item.name,
          icon: item.icon || "📦",
          count: item.skillCount || 0,
        }));

        setCategories(mappedCategories);
      }
    } catch (err) {
      console.error("[useSkillStore] 加载分类失败:", err);
    }
  }, []);

  /**
   * 搜索技能
   */
  const searchSkills = useCallback(
    async (query: string) => {
      console.log("[useSkillStore] 搜索技能:", query);
      await loadStoreSkills({ ...filters, search: query });
    },
    [filters, loadStoreSkills],
  );

  /**
   * 获取技能详情
   */
  const getSkillDetail = useCallback(
    async (skillId: string): Promise<StoreSkillInfo | null> => {
      console.log("[useSkillStore] 获取技能详情:", skillId);
      try {
        const result = (await window.electronAPI.api.getStoreSkillDetail(skillId)) as {
          success: boolean;
          data?: StoreSkillInfo;
          error?: string;
        };

        if (result.success && result.data) {
          return result.data;
        }
        return null;
      } catch (err) {
        console.error("[useSkillStore] 获取详情失败:", err);
        return null;
      }
    },
    [],
  );

  /**
   * 安装技能
   */
  const installSkill = useCallback(
    async (skillId: string): Promise<{ success: boolean; error?: string }> => {
      console.log("[useSkillStore] 安装技能:", skillId);
      try {
        const result = (await window.electronAPI.api.installStoreSkill(skillId)) as {
          success: boolean;
          data?: { skillId: string; message: string };
          error?: string;
        };

        if (result.success) {
          // 刷新商店列表以更新安装状态
          await loadStoreSkills();
        }

        return { success: result.success, error: result.error };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "安装失败";
        console.error("[useSkillStore] 安装失败:", errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [loadStoreSkills],
  );

  /**
   * 卸载技能（从商店取消安装）
   */
  const uninstallSkill = useCallback(
    async (skillId: string): Promise<{ success: boolean; error?: string }> => {
      console.log("[useSkillStore] 卸载技能:", skillId);
      try {
        const result = (await window.electronAPI.api.uninstallStoreSkill(skillId)) as {
          success: boolean;
          data?: { skillId: string; message: string };
          error?: string;
        };

        if (result.success) {
          // 刷新商店列表以更新安装状态
          await loadStoreSkills();
        }

        return { success: result.success, error: result.error };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "卸载失败";
        console.error("[useSkillStore] 卸载失败:", errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    [loadStoreSkills],
  );

  /**
   * 上传技能（创建用户自建技能）
   */
  const uploadSkill = useCallback(
    async (
      data: SkillUploadData,
    ): Promise<{ success: boolean; skillId?: string; error?: string }> => {
      console.log("[useSkillStore] 上传技能:", data.name);
      setIsUploading(true);
      setError(null);

      try {
        // 通过 REST API 创建用户自建技能
        const result = (await window.electronAPI.api.createUserSkill({
          name: data.name,
          description: data.description,
          version: data.version,
        })) as {
          success: boolean;
          data?: { id: string; name: string; status: string };
          error?: string;
        };

        if (result.success && result.data?.id) {
          console.log("[useSkillStore] 技能创建成功, skillId:", result.data.id);
          // 刷新商店列表
          await loadStoreSkills();
          return { success: true, skillId: result.data.id };
        } else {
          const errorMessage = result.error || "创建技能失败";
          console.error("[useSkillStore] 创建失败:", errorMessage);
          setError(errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "上传失败";
        console.error("[useSkillStore] 上传异常:", errorMessage);
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsUploading(false);
      }
    },
    [loadStoreSkills],
  );

  /**
   * 检查更新
   */
  const checkUpdates = useCallback(async (): Promise<StoreSkillInfo[]> => {
    console.log("[useSkillStore] 检查更新");
    try {
      const result = (await window.electronAPI.api.checkStoreUpdates()) as {
        success: boolean;
        data?: { skills: StoreSkillInfo[]; total: number };
        error?: string;
      };

      if (result.success && result.data) {
        return result.data.skills;
      }
      return [];
    } catch (err) {
      console.error("[useSkillStore] 检查更新失败:", err);
      return [];
    }
  }, []);

  /**
   * 刷新商店
   */
  const refreshStore = useCallback(async () => {
    console.log("[useSkillStore] 刷新商店");
    setIsRefreshing(true);
    try {
      await window.electronAPI.api.refreshStore();
      // 重新加载所有数据
      await Promise.all([
        loadStoreSkills(),
        loadFeatured(),
        loadPopular(),
        loadRecent(),
        loadStats(),
      ]);
    } catch (err) {
      console.error("[useSkillStore] 刷新商店失败:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadStoreSkills, loadFeatured, loadPopular, loadRecent, loadStats]);

  return {
    // 状态
    skills,
    featured,
    popular,
    recent,
    stats,
    categories,
    isLoading,
    isUploading,
    isRefreshing,
    error,
    filters,
    hasMore,

    // 方法
    loadStoreSkills,
    loadMore,
    loadFeatured,
    loadPopular,
    loadRecent,
    loadStats,
    loadCategories,
    searchSkills,
    setFilters,
    getSkillDetail,
    installSkill,
    uninstallSkill,
    uploadSkill,
    checkUpdates,
    refreshStore,
  };
}
