/**
 * 管理员管理相关类型定义
 *
 * 对应后端 admin.admins.* RPC 方法的请求和响应类型
 */

/**
 * 管理员角色
 */
export type AdminRole = 'super_admin' | 'admin' | 'operator'

/**
 * 管理员状态
 */
export type AdminStatus = 'active' | 'suspended' | 'locked'

/**
 * 管理员信息（列表项）
 */
export interface AdminItem {
  id: string
  username: string
  displayName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  role: AdminRole
  status: AdminStatus
  mfaEnabled: boolean
  lastLoginAt: string | null
  lastLoginIp: string | null
  createdAt: string
}

/**
 * 管理员列表查询参数
 */
export interface AdminListQuery {
  /** 搜索关键词 */
  search?: string
  /** 角色过滤 */
  role?: AdminRole | 'all'
  /** 状态过滤 */
  status?: AdminStatus | 'all'
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 排序字段 */
  orderBy?: 'createdAt' | 'username' | 'lastLoginAt'
  /** 排序方向 */
  orderDir?: 'asc' | 'desc'
}

/**
 * 管理员列表响应
 */
export interface AdminListResponse {
  admins: AdminItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 创建管理员参数
 */
export interface CreateAdminInput {
  username: string
  password: string
  displayName: string
  email?: string
  phone?: string
  role: AdminRole
}

/**
 * 更新管理员参数
 */
export interface UpdateAdminInput {
  adminId: string
  displayName?: string
  email?: string
  phone?: string
  role?: AdminRole
}

/**
 * 重置密码参数
 */
export interface ResetAdminPasswordInput {
  adminId: string
  newPassword: string
}

/**
 * 更新状态参数
 */
export interface UpdateAdminStatusInput {
  adminId: string
  status: 'active' | 'suspended'
  reason?: string
}
