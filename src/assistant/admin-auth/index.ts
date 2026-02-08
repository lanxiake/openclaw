/**
 * 管理员认证模块导出
 */

// 认证服务
export {
  adminLogin,
  adminRefreshToken,
  adminLogout,
  adminLogoutAll,
  getAdminProfile,
  type AdminAuthResult,
  type AdminLoginRequest,
  type AdminRefreshTokenRequest,
} from "./admin-auth-service.js";

// JWT 工具
export {
  generateAdminAccessToken,
  verifyAdminAccessToken,
  decodeAdminToken,
  isAdminTokenExpiringSoon,
  extractAdminBearerToken,
  hasAdminRole,
  getAdminJwtSecret,
  ADMIN_TOKEN_CONFIG,
  type AdminAccessTokenPayload,
  type AdminTokenPair,
} from "./admin-jwt.js";
