/**
 * API 响应类型定义
 *
 * 统一的 API 响应格式，所有端点都遵循此结构
 */

/**
 * 成功响应
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/**
 * 错误响应
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * API 响应联合类型
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 分页元数据
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  /** Alias for pageSize (backward compatibility) */
  limit: number;
  totalPages: number;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 排序参数
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============ 验证码相关 ============

/** 滑动验证码挑战 */
export interface CaptchaChallenge {
  captchaId: string;
  backgroundImage: string;
  sliderImage: string;
  sliderY: number;
}

/** 验证码验证请求 */
export interface CaptchaVerifyRequest {
  captchaId: string;
  sliderX: number;
}

/** 验证码验证响应 */
export interface CaptchaVerifyResponse {
  token?: string;
}

/** RSA 公钥响应 */
export interface PublicKeyResponse {
  publicKey: string;
}
