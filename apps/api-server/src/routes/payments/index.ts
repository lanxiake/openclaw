/**
 * 用户支付 REST API 路由
 *
 * GET    /api/payments/providers         - 获取可用支付方式
 * GET    /api/payments/orders            - 获取用户订单列表
 * GET    /api/payments/orders/:id        - 获取订单详情
 * POST   /api/payments/orders            - 创建订单（购买订阅）
 * POST   /api/payments/orders/:id/cancel - 取消订单
 * POST   /api/payments/orders/:id/pay    - 发起支付
 * GET    /api/payments/orders/:id/status - 查询支付状态
 * POST   /api/payments/calculate-price   - 计算价格
 * POST   /api/payments/mock-complete     - 模拟支付完成（仅测试）
 * POST   /api/payments/refunds           - 创建退款
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getAvailableProviders,
  getUserOrders,
  getOrder,
  createOrder,
  cancelOrder,
  initiatePayment,
  queryPaymentStatus,
  calculatePrice,
  mockPaymentComplete,
  createRefund,
  type PaymentProvider,
  type OrderType,
  type RefundReason,
} from "../../../../../src/assistant/payment/index.js";
import { getRequestUser } from "../../plugins/auth.js";

/**
 * 注册用户支付路由
 */
export function registerPaymentsRoutes(server: FastifyInstance): void {
  /**
   * GET /api/payments/providers - 获取可用支付方式
   */
  server.get(
    "/api/payments/providers",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      request.log.info({ userId: user.userId }, "[payments] 获取可用支付方式");
