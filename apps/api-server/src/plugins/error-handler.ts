/**
 * 全局错误处理 Fastify 插件
 *
 * 统一错误响应格式，区分业务错误和系统错误
 */

import type {
  FastifyInstance,
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from "fastify";

/** 业务错误基类 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = "BAD_REQUEST",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 未找到资源错误 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      404,
      "NOT_FOUND",
    );
  }
}

/** 权限不足错误 */
export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
  }
}

/** 参数验证错误 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

/**
 * 注册全局错误处理
 *
 * 所有未捕获的错误都会经过此处理器，返回统一格式的错误响应
 */
export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler(
    (
      error: FastifyError | AppError | Error,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      // 业务错误
      if (error instanceof AppError) {
        request.log.warn(
          { err: error, code: error.code },
          `[error-handler] 业务错误: ${error.message}`,
        );
        return reply.code(error.statusCode).send({
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        });
      }

      // Fastify 验证错误
      if ("validation" in error && (error as FastifyError).validation) {
        request.log.warn({ err: error }, `[error-handler] 参数验证错误`);
        return reply.code(400).send({
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: (error as FastifyError).validation,
        });
      }

      // JSON 解析错误 (Fastify 内置的 content-type parser 错误)
      if ((error as FastifyError).statusCode === 400) {
        request.log.warn({ err: error }, `[error-handler] 请求解析错误`);
        return reply.code(400).send({
          success: false,
          error: error.message || "Bad request",
          code: "BAD_REQUEST",
        });
      }

      // Fastify 限流错误
      if ((error as FastifyError).statusCode === 429) {
        return reply.code(429).send({
          success: false,
          error: "Too many requests",
          code: "RATE_LIMIT_EXCEEDED",
        });
      }

      // 未知系统错误
      request.log.error(
        { err: error },
        `[error-handler] 未处理的错误: ${error.message}`,
      );
      return reply.code(500).send({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    },
  );

  // 404 路由未找到处理
  server.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      success: false,
      error: "Route not found",
      code: "ROUTE_NOT_FOUND",
    });
  });
}
