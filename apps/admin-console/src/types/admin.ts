/**
 * 管理员信息
 */
export interface Admin {
  id: string
  username: string
  displayName: string
  email?: string
  avatar?: string
  role: 'super_admin' | 'admin' | 'operator'
  status: 'active' | 'inactive'
  mfaEnabled: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * 管理员登录请求
 */
export interface AdminLoginRequest {
  username: string
  password: string
  mfaCode?: string
}

/**
 * 管理员登录响应
 */
export interface AdminLoginResponse {
  success: boolean
  admin?: Admin
  accessToken?: string
  refreshToken?: string
  requireMfa?: boolean
  error?: string
}

/**
 * 刷新令牌响应
 */
export interface RefreshTokenResponse {
  success: boolean
  accessToken?: string
  refreshToken?: string
  error?: string
}
