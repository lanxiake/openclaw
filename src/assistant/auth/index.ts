/**
 * 认证模块统一导出
 */

// JWT 工具
export {
  generateAccessToken,
  verifyAccessToken,
  decodeToken,
  isTokenExpiringSoon,
  extractBearerToken,
  getJwtSecret,
  TOKEN_CONFIG,
  type UserAccessTokenPayload,
  type TokenPair,
} from "./jwt.js";

// 认证服务
export {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  type AuthResult,
  type RegisterRequest,
  type LoginRequest,
  type RefreshTokenRequest,
} from "./auth-service.js";

// 验证码服务
export {
  sendVerificationCode,
  verifyCode,
  setCodeSender,
  getCodeSender,
  type SendCodeRequest,
  type SendCodeResult,
  type CodeSender,
} from "./code-service.js";

// 中间件
export {
  authMiddleware,
  requireAuth,
  optionalAuth,
  tokenOnlyAuth,
  type AuthenticatedRequest,
  type AuthMiddlewareOptions,
} from "./middleware.js";
