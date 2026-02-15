/**
 * 用户注册服务
 *
 * 负责用户注册、验证和账号创建
 */

import { getDatabase } from "../db/connection.js";
import { users, type NewUser } from "../db/schema/users.js";
import { eq, or } from "drizzle-orm";
import { generateShortId } from "../db/utils/id.js";
import { hashPassword } from "../db/utils/password.js";
import { verifyCode } from "./verification-code-service.js";

/**
 * 手机号注册参数
 */
export interface RegisterByPhoneParams {
  phone: string;
  verificationCode: string;
  password?: string;
  displayName?: string;
}

/**
 * 邮箱注册参数
 */
export interface RegisterByEmailParams {
  email: string;
  verificationCode: string;
  password: string; // 邮箱注册必须设置密码
  displayName?: string;
}

/**
 * 微信注册参数
 */
export interface RegisterByWeChatParams {
  wechatOpenId: string;
  wechatUnionId?: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * 注册结果
 */
export interface RegisterResult {
  success: boolean;
  user?: {
    id: string;
    phone?: string;
    email?: string;
    displayName?: string;
    createdAt: Date;
  };
  error?: string;
}

/**
 * 检查用户是否已存在
 */
async function checkUserExists(phone?: string, email?: string, wechatOpenId?: string): Promise<boolean> {
  const conditions = [];

  if (phone) {
    conditions.push(eq(users.phone, phone));
  }
  if (email) {
    conditions.push(eq(users.email, email));
  }
  if (wechatOpenId) {
    conditions.push(eq(users.wechatOpenId, wechatOpenId));
  }

  if (conditions.length === 0) {
    return false;
  }

  const db = getDatabase();
  const existingUser = await db.query.users.findFirst({
    where: or(...conditions),
  });

  return !!existingUser;
}

/**
 * 手机号注册
 */
export async function registerByPhone(params: RegisterByPhoneParams): Promise<RegisterResult> {
  try {
    // 1. 验证手机号格式
    if (!isValidPhone(params.phone)) {
      return {
        success: false,
        error: "手机号格式不正确",
      };
    }

    // 2. 验证验证码
    try {
      await verifyCode(params.phone, "phone", params.verificationCode, "register");
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "验证码验证失败",
      };
    }

    // 3. 检查用户是否已存在
    const exists = await checkUserExists(params.phone);
    if (exists) {
      return {
        success: false,
        error: "该手机号已注册",
      };
    }

    // 4. 创建用户
    const userId = generateShortId("usr");
    const newUser: NewUser = {
      id: userId,
      phone: params.phone,
      displayName: params.displayName || `用户${params.phone.slice(-4)}`,
      phoneVerified: true, // 通过验证码注册,手机号已验证
      isActive: true,
    };

    // 如果提供了密码,则哈希后存储
    if (params.password) {
      newUser.passwordHash = await hashPassword(params.password);
    }

    const db = getDatabase();
    const [user] = await db.insert(users).values(newUser).returning();

    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone!,
        displayName: user.displayName!,
        createdAt: user.createdAt,
      },
    };
  } catch (error) {
    console.error("[register] 手机号注册失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "注册失败",
    };
  }
}

/**
 * 邮箱注册
 */
export async function registerByEmail(params: RegisterByEmailParams): Promise<RegisterResult> {
  try {
    // 1. 验证邮箱格式
    if (!isValidEmail(params.email)) {
      return {
        success: false,
        error: "邮箱格式不正确",
      };
    }

    // 2. 验证密码强度
    if (!isValidPassword(params.password)) {
      return {
        success: false,
        error: "密码强度不足,至少8位,包含字母和数字",
      };
    }

    // 3. 验证验证码
    try {
      await verifyCode(params.email, "email", params.verificationCode, "register");
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "验证码验证失败",
      };
    }

    // 4. 检查用户是否已存在
    const exists = await checkUserExists(undefined, params.email);
    if (exists) {
      return {
        success: false,
        error: "该邮箱已注册",
      };
    }

    // 5. 创建用户
    const userId = generateShortId("usr");
    const passwordHash = await hashPassword(params.password);

    const newUser: NewUser = {
      id: userId,
      email: params.email,
      passwordHash,
      displayName: params.displayName || params.email.split("@")[0],
      emailVerified: true, // 通过验证码注册,邮箱已验证
      isActive: true,
    };

    const db = getDatabase();
    const [user] = await db.insert(users).values(newUser).returning();

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        displayName: user.displayName!,
        createdAt: user.createdAt,
      },
    };
  } catch (error) {
    console.error("[register] 邮箱注册失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "注册失败",
    };
  }
}

/**
 * 微信注册
 */
export async function registerByWeChat(params: RegisterByWeChatParams): Promise<RegisterResult> {
  try {
    // 1. 检查用户是否已存在
    const exists = await checkUserExists(undefined, undefined, params.wechatOpenId);
    if (exists) {
      return {
        success: false,
        error: "该微信账号已注册",
      };
    }

    // 2. 创建用户
    const userId = generateShortId("usr");
    const newUser: NewUser = {
      id: userId,
      wechatOpenId: params.wechatOpenId,
      wechatUnionId: params.wechatUnionId,
      displayName: params.displayName || "微信用户",
      avatarUrl: params.avatarUrl,
      isActive: true,
    };

    const db = getDatabase();
    const [user] = await db.insert(users).values(newUser).returning();

    return {
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName!,
        createdAt: user.createdAt,
      },
    };
  } catch (error) {
    console.error("[register] 微信注册失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "注册失败",
    };
  }
}

/**
 * 验证手机号格式
 */
function isValidPhone(phone: string): boolean {
  // 支持国际格式: +86 开头
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证密码强度
 */
function isValidPassword(password: string): boolean {
  // 至少8位,包含字母和数字
  if (password.length < 8) {
    return false;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}
