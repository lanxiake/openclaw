/**
 * 技能类别
 */
export type SkillCategory =
  | 'automation'
  | 'productivity'
  | 'communication'
  | 'entertainment'
  | 'utility'
  | 'other'

/**
 * 技能类型
 */
export interface Skill {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  category: SkillCategory
  price: number
  pricePeriod: 'month' | 'year' | 'once'
  rating: number
  reviewCount: number
  installCount: number
  isActive: boolean
}

/**
 * 技能列表项
 */
export interface SkillListItem extends Skill {}

/**
 * 技能详情
 */
export interface SkillDetail extends Skill {
  longDescription?: string
  screenshots?: string[]
  author?: string
  version?: string
  updatedAt?: string
  requirements?: string[]
}

/**
 * 用户技能
 */
export interface UserSkill {
  id: string
  skill: Skill
  installedAt: string
  configuration: Record<string, unknown>
  isFavorite: boolean
}
