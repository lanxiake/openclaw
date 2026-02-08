/**
 * 技能商店管理类型定义
 */

/**
 * 技能状态
 */
export type SkillStatus = 'published' | 'pending' | 'unpublished' | 'rejected'

/**
 * 技能订阅级别
 */
export type SkillSubscription = 'free' | 'pro' | 'team' | 'enterprise'

/**
 * 技能运行模式
 */
export type SkillRunMode = 'local' | 'cloud' | 'hybrid'

/**
 * 技能
 */
export interface Skill {
  id: string
  name: string
  description: string
  version: string
  category: string
  categoryName?: string
  icon?: string
  author?: string
  authorId?: string
  status: SkillStatus
  subscription: SkillSubscription
  runMode: SkillRunMode
  tags?: string[]
  installCount: number
  rating?: number
  ratingCount: number
  featured: boolean
  featuredOrder?: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
  sourceUrl?: string
}

/**
 * 技能详情
 */
export interface SkillDetail extends Skill {
  readme?: string
  changelog?: string
  triggers?: string[]
  parameters?: Array<{
    name: string
    type: string
    description: string
    required: boolean
  }>
  screenshots?: string[]
  reviewNotes?: string
  reviewedBy?: string
  reviewedAt?: string
}

/**
 * 技能分类
 */
export interface SkillCategory {
  id: string
  name: string
  code: string
  description?: string
  icon?: string
  sortOrder: number
  skillCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 技能查询参数
 */
export interface SkillListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: SkillStatus
  category?: string
  subscription?: SkillSubscription
  featured?: boolean
  sortBy?: 'name' | 'installCount' | 'rating' | 'createdAt' | 'publishedAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 技能列表响应
 */
export interface SkillListResponse {
  skills: Skill[]
  total: number
  page: number
  pageSize: number
}

/**
 * 技能统计
 */
export interface SkillStats {
  totalSkills: number
  publishedSkills: number
  pendingSkills: number
  unpublishedSkills: number
  rejectedSkills: number
  featuredSkills: number
  totalInstalls: number
  totalCategories: number
  categoryDistribution: Array<{
    category: string
    categoryName: string
    count: number
  }>
  subscriptionDistribution: Array<{
    subscription: SkillSubscription
    count: number
  }>
  topSkills: Array<{
    id: string
    name: string
    installCount: number
  }>
}

/**
 * 技能审核操作
 */
export interface SkillReviewAction {
  skillId: string
  action: 'approve' | 'reject'
  notes?: string
}

/**
 * 技能发布/下架操作
 */
export interface SkillPublishAction {
  skillId: string
  action: 'publish' | 'unpublish'
  reason?: string
}

/**
 * 技能推荐设置
 */
export interface SkillFeaturedAction {
  skillId: string
  featured: boolean
  order?: number
}

/**
 * 技能分类操作
 */
export interface CategoryCreateInput {
  name: string
  code: string
  description?: string
  icon?: string
  sortOrder?: number
}

export interface CategoryUpdateInput {
  categoryId: string
  name?: string
  description?: string
  icon?: string
  sortOrder?: number
  isActive?: boolean
}
