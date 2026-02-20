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
  type OrderStatus,
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

      const providers = getAvailableProviders();

      return {
        success: true,
        data: { providers },
      };
    },
  );

  /**
   * GET /api/payments/orders - 获取用户订单列表
   */
  server.get(
    "/api/payments/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const query = request.query as {
        status?: OrderStatus | OrderStatus[];
        page?: string;
        limit?: string;
      };

      request.log.info({ userId: user.userId }, "[payments] 获取订单列表");

      try {
        const result = await getUserOrders(user.userId, {
          status: query.status,
          page: query.page ? parseInt(query.page, 10) : undefined,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 获取订单列表失败");
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "获取订单列表失败",
          code: "INTERNAL_ERROR",
        });
      }
    },
  );

  /**
   * GET /api/payments/orders/:id - 获取订单详情
   */
  server.get(
    "/api/payments/orders/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info({ userId: user.userId, orderId: id }, "[payments] 获取订单详情");

      try {
        const order = await getOrder(id);
        if (!order) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        // 验证订单属于当前用户
        if (order.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权访问此订单",
            code: "FORBIDDEN",
          });
        }

        return {
          success: true,
          data: { order },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 获取订单详情失败");
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "获取订单详情失败",
          code: "INTERNAL_ERROR",
        });
      }
    },
  );

  /**
   * POST /api/payments/orders - 创建订单（购买订阅）
   */
  server.post(
    "/api/payments/orders",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        type: OrderType;
        planId: string;
        billingPeriod?: "monthly" | "yearly";
        provider: PaymentProvider;
        couponCode?: string;
      };

      request.log.info(
        { userId: user.userId, type: body.type, planId: body.planId },
        "[payments] 创建订单",
      );

      try {
        // 1. 计算价格
        const price = await calculatePrice({
          type: body.type,
          itemId: body.planId,
          billingPeriod: body.billingPeriod,
          couponCode: body.couponCode,
        });

        if (price.finalPrice === 0) {
          return reply.code(400).send({
            success: false,
            error: "免费计划无需购买",
            code: "FREE_PLAN",
          });
        }

        // 2. 创建订单
        const order = await createOrder({
          userId: user.userId,
          type: body.type,
          amount: price.finalPrice,
          currency: price.currency,
          description: `订阅 ${body.planId} (${body.billingPeriod === "yearly" ? "年付" : "月付"})`,
          referenceId: body.planId,
          referenceType: "subscription_plan",
          provider: body.provider,
          metadata: {
            planId: body.planId,
            billingPeriod: body.billingPeriod,
            couponCode: body.couponCode,
            priceInfo: price,
          },
        });

        // 3. 发起支付
        const paymentResult = await initiatePayment({
          orderId: order.id,
          provider: body.provider,
        });

        return {
          success: true,
          data: {
            order,
            price,
            payment: paymentResult,
          },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 创建订单失败");
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "创建订单失败",
          code: "INTERNAL_ERROR",
        });
      }
    },
  );

  /**
   * POST /api/payments/orders/:id/cancel - 取消订单
   */
  server.post(
    "/api/payments/orders/:id/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info({ userId: user.userId, orderId: id }, "[payments] 取消订单");

      try {
        // 先验证订单属于当前用户
        const existingOrder = await getOrder(id);
        if (!existingOrder) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        if (existingOrder.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此订单",
            code: "FORBIDDEN",
          });
        }

        const order = await cancelOrder(id);

        return {
          success: true,
          data: { order },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 取消订单失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "取消订单失败",
          code: "CANCEL_FAILED",
        });
      }
    },
  );

  /**
   * POST /api/payments/orders/:id/pay - 发起支付
   */
  server.post(
    "/api/payments/orders/:id/pay",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };
      const body = request.body as {
        provider: PaymentProvider;
        returnUrl?: string;
      };

      request.log.info({ userId: user.userId, orderId: id }, "[payments] 发起支付");

      try {
        // 验证订单属于当前用户
        const order = await getOrder(id);
        if (!order) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        if (order.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此订单",
            code: "FORBIDDEN",
          });
        }

        const result = await initiatePayment({
          orderId: id,
          provider: body.provider,
          returnUrl: body.returnUrl,
        });

        return {
          success: result.success,
          data: result.success
            ? {
                payUrl: result.payUrl,
                qrCode: result.qrCode,
                payParams: result.payParams,
              }
            : undefined,
          error: result.error,
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 发起支付失败");
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "发起支付失败",
          code: "PAYMENT_FAILED",
        });
      }
    },
  );

  /**
   * GET /api/payments/orders/:id/status - 查询支付状态
   */
  server.get(
    "/api/payments/orders/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const { id } = request.params as { id: string };

      request.log.info({ userId: user.userId, orderId: id }, "[payments] 查询支付状态");

      try {
        // 验证订单属于当前用户
        const order = await getOrder(id);
        if (!order) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        if (order.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权访问此订单",
            code: "FORBIDDEN",
          });
        }

        const result = await queryPaymentStatus(id);

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 查询支付状态失败");
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : "查询支付状态失败",
          code: "INTERNAL_ERROR",
        });
      }
    },
  );

  /**
   * POST /api/payments/calculate-price - 计算价格
   */
  server.post(
    "/api/payments/calculate-price",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        type: OrderType;
        itemId: string;
        billingPeriod?: "monthly" | "yearly";
        couponCode?: string;
      };

      request.log.info(
        { userId: user.userId, type: body.type, itemId: body.itemId },
        "[payments] 计算价格",
      );

      try {
        const price = await calculatePrice({
          type: body.type,
          itemId: body.itemId,
          billingPeriod: body.billingPeriod,
          couponCode: body.couponCode,
        });

        return {
          success: true,
          data: { price },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 计算价格失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "计算价格失败",
          code: "PRICE_CALCULATION_FAILED",
        });
      }
    },
  );

  /**
   * POST /api/payments/mock-complete - 模拟支付完成（仅测试）
   */
  server.post(
    "/api/payments/mock-complete",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        orderId: string;
        success?: boolean;
      };

      request.log.info(
        { userId: user.userId, orderId: body.orderId, success: body.success },
        "[payments] 模拟支付完成",
      );

      try {
        // 验证订单属于当前用户
        const existingOrder = await getOrder(body.orderId);
        if (!existingOrder) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        if (existingOrder.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此订单",
            code: "FORBIDDEN",
          });
        }

        const order = await mockPaymentComplete(body.orderId, body.success ?? true);

        return {
          success: true,
          data: { order },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 模拟支付完成失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "模拟支付完成失败",
          code: "MOCK_PAYMENT_FAILED",
        });
      }
    },
  );

  /**
   * POST /api/payments/refunds - 创建退款
   */
  server.post(
    "/api/payments/refunds",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getRequestUser(request);
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
      }

      const body = request.body as {
        orderId: string;
        amount?: number;
        reason: RefundReason;
        description?: string;
      };

      request.log.info(
        { userId: user.userId, orderId: body.orderId, reason: body.reason },
        "[payments] 创建退款",
      );

      try {
        // 验证订单属于当前用户
        const existingOrder = await getOrder(body.orderId);
        if (!existingOrder) {
          return reply.code(404).send({
            success: false,
            error: "订单不存在",
            code: "ORDER_NOT_FOUND",
          });
        }

        if (existingOrder.userId !== user.userId) {
          return reply.code(403).send({
            success: false,
            error: "无权操作此订单",
            code: "FORBIDDEN",
          });
        }

        const refund = await createRefund({
          orderId: body.orderId,
          amount: body.amount,
          reason: body.reason,
          description: body.description,
        });

        return {
          success: true,
          data: { refund },
        };
      } catch (error) {
        request.log.error({ error }, "[payments] 创建退款失败");
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : "创建退款失败",
          code: "REFUND_FAILED",
        });
      }
    },
  );
}