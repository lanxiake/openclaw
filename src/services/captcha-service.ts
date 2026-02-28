/**
 * 滑动验证码服务
 *
 * 使用 sharp 生成滑动拼图验证码图片
 * Redis 存储验证答案，支持一次性 token 验证
 */

import crypto from "node:crypto";
import sharp from "sharp";
import { getRedis } from "../infrastructure/redis/index.js";
import { getLogger } from "../logging/logger.js";

const logger = getLogger();

/** 验证码配置 */
const CAPTCHA_CONFIG = {
  /** 背景图宽度 */
  width: 280,
  /** 背景图高度 */
  height: 100,
  /** 滑块尺寸 */
  sliderSize: 40,
  /** 滑块 X 范围 (最小值) */
  sliderXMin: 80,
  /** 滑块 X 范围 (最大值) */
  sliderXMax: 240,
  /** 滑块 Y 范围 (最小值) */
  sliderYMin: 8,
  /** 滑块 Y 范围 (最大值) */
  sliderYMax: 52,
  /** 验证容差 (像素) */
  tolerance: 5,
  /** 验证码 TTL (秒) */
  challengeTtl: 300,
  /** Token TTL (秒) */
  tokenTtl: 300,
  /** Redis key 前缀 */
  challengePrefix: "captcha:",
  tokenPrefix: "captcha-token:",
};

/** 验证码挑战响应 */
export interface CaptchaChallenge {
  captchaId: string;
  backgroundImage: string;
  sliderImage: string;
  sliderY: number;
}

/** 验证结果 */
export interface CaptchaVerifyResult {
  success: boolean;
  token?: string;
}

/**
 * 生成随机整数 [min, max]
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机渐变背景色
 */
function generateGradientColors(): {
  r1: number;
  g1: number;
  b1: number;
  r2: number;
  g2: number;
  b2: number;
} {
  return {
    r1: randomInt(60, 200),
    g1: randomInt(60, 200),
    b1: randomInt(60, 200),
    r2: randomInt(60, 200),
    g2: randomInt(60, 200),
    b2: randomInt(60, 200),
  };
}

/**
 * 生成滑块拼图形状的 SVG path (带凸起)
 */
function createPuzzlePath(x: number, y: number, size: number): string {
  const s = size;
  const r = s * 0.2; // 凸起半径
  return [
    `M ${x} ${y}`,
    `L ${x + s * 0.4} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + s * 0.6} ${y}`,
    `L ${x + s} ${y}`,
    `L ${x + s} ${y + s * 0.4}`,
    `A ${r} ${r} 0 0 1 ${x + s} ${y + s * 0.6}`,
    `L ${x + s} ${y + s}`,
    `L ${x} ${y + s}`,
    `Z`,
  ].join(" ");
}

/**
 * 生成带渐变和噪点的背景图
 */
async function generateBackground(): Promise<Buffer> {
  const { width, height } = CAPTCHA_CONFIG;
  const colors = generateGradientColors();

  // 使用 SVG 渐变生成背景
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(${colors.r1},${colors.g1},${colors.b1})" />
        <stop offset="100%" style="stop-color:rgb(${colors.r2},${colors.g2},${colors.b2})" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    ${generateNoiseSvg(width, height)}
    ${generateShapesSvg(width, height)}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * 生成随机噪点 SVG
 */
function generateNoiseSvg(width: number, height: number): string {
  const dots: string[] = [];
  for (let i = 0; i < 50; i++) {
    const x = randomInt(0, width);
    const y = randomInt(0, height);
    const r = randomInt(1, 3);
    const opacity = (randomInt(10, 40) / 100).toFixed(2);
    const color = `rgb(${randomInt(0, 255)},${randomInt(0, 255)},${randomInt(0, 255)})`;
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`);
  }
  return dots.join("\n");
}

/**
 * 生成随机几何形状干扰 SVG
 */
function generateShapesSvg(width: number, height: number): string {
  const shapes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const x1 = randomInt(0, width);
    const y1 = randomInt(0, height);
    const x2 = randomInt(0, width);
    const y2 = randomInt(0, height);
    const opacity = (randomInt(5, 25) / 100).toFixed(2);
    const color = `rgb(${randomInt(0, 255)},${randomInt(0, 255)},${randomInt(0, 255)})`;
    shapes.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="${opacity}" />`,
    );
  }
  return shapes.join("\n");
}

/**
 * 生成滑动验证码挑战
 *
 * 流程:
 * 1. 生成随机渐变背景图
 * 2. 在随机位置挖出拼图缺口
 * 3. 提取拼图块作为滑块
 * 4. 存储正确位置到 Redis
 */
export async function generateChallenge(): Promise<CaptchaChallenge> {
  const {
    width,
    height,
    sliderSize,
    sliderXMin,
    sliderXMax,
    sliderYMin,
    sliderYMax,
    challengeTtl,
    challengePrefix,
  } = CAPTCHA_CONFIG;

  // 随机确定滑块目标位置
  const correctX = randomInt(sliderXMin, sliderXMax);
  const sliderY = randomInt(sliderYMin, sliderYMax);
  const captchaId = crypto.randomUUID();

  // 1. 生成背景图
  const bgBuffer = await generateBackground();

  // 2. 创建拼图块遮罩 (用于提取滑块)
  const puzzlePath = createPuzzlePath(0, 0, sliderSize);
  const maskSvg = `<svg width="${sliderSize}" height="${sliderSize}" xmlns="http://www.w3.org/2000/svg">
    <path d="${puzzlePath}" fill="white" />
  </svg>`;
  const maskBuffer = await sharp(Buffer.from(maskSvg))
    .resize(sliderSize, sliderSize)
    .png()
    .toBuffer();

  // 3. 从背景图中提取拼图块区域
  const sliderRegion = await sharp(bgBuffer)
    .extract({ left: correctX, top: sliderY, width: sliderSize, height: sliderSize })
    .png()
    .toBuffer();

  // 4. 用遮罩裁剪出滑块形状
  const sliderImage = await sharp(sliderRegion)
    .composite([{ input: maskBuffer, blend: "dest-in" }])
    .png()
    .toBuffer();

  // 5. 在背景图上挖出缺口 (半透明暗色)
  const holePath = createPuzzlePath(correctX, sliderY, sliderSize);
  const holeSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <path d="${holePath}" fill="rgba(0,0,0,0.5)" />
  </svg>`;
  const holeBuffer = await sharp(Buffer.from(holeSvg)).png().toBuffer();

  const backgroundImage = await sharp(bgBuffer)
    .composite([{ input: holeBuffer, blend: "over" }])
    .png()
    .toBuffer();

  // 6. 存储答案到 Redis
  const redis = getRedis();
  await redis.set(
    `${challengePrefix}${captchaId}`,
    JSON.stringify({ correctX }),
    "EX",
    challengeTtl,
  );

  logger.debug("[captcha] Challenge generated", { captchaId, correctX, sliderY });

  return {
    captchaId,
    backgroundImage: `data:image/png;base64,${backgroundImage.toString("base64")}`,
    sliderImage: `data:image/png;base64,${sliderImage.toString("base64")}`,
    sliderY,
  };
}

/**
 * 验证滑动验证码
 *
 * @param captchaId 验证码 ID
 * @param sliderX 用户提交的滑块 X 坐标
 * @returns 验证结果，成功时附带一次性 token
 */
export async function verifyCaptcha(
  captchaId: string,
  sliderX: number,
): Promise<CaptchaVerifyResult> {
  const { tolerance, tokenTtl, challengePrefix, tokenPrefix } = CAPTCHA_CONFIG;
  const redis = getRedis();
  const key = `${challengePrefix}${captchaId}`;

  // 1. 从 Redis 获取答案
  const data = await redis.get(key);
  if (!data) {
    logger.debug("[captcha] Challenge not found or expired", { captchaId });
    return { success: false };
  }

  // 2. 无论成功与否都删除挑战 (单次机会)
  await redis.del(key);

  // 3. 解析并比较
  const { correctX } = JSON.parse(data) as { correctX: number };
  const diff = Math.abs(sliderX - correctX);

  if (diff > tolerance) {
    logger.debug("[captcha] Verification failed", { captchaId, sliderX, correctX, diff });
    return { success: false };
  }

  // 4. 生成一次性验证 token
  const token = crypto.randomUUID();
  await redis.set(`${tokenPrefix}${token}`, "1", "EX", tokenTtl);

  logger.debug("[captcha] Verification succeeded", { captchaId });

  return { success: true, token };
}

/**
 * 校验验证码 token (一次性使用)
 *
 * @param token 验证成功后获得的 token
 * @returns token 是否有效
 */
export async function validateCaptchaToken(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  const { tokenPrefix } = CAPTCHA_CONFIG;
  const redis = getRedis();
  const key = `${tokenPrefix}${token}`;

  // 获取并删除 (一次性)
  const exists = await redis.get(key);
  if (!exists) {
    return false;
  }

  await redis.del(key);
  return true;
}
