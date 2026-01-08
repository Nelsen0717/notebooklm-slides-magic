/**
 * Shared authentication utilities for Vercel serverless functions
 */
import { createHash, timingSafeEqual } from 'crypto'

// 環境變數
const AUTH_EMAIL = process.env.AUTH_EMAIL || 'nelsen.chen@funraise.com.tw'
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || hashPassword('funraise888')
const JWT_SECRET = process.env.JWT_SECRET || 'notebooklm-slides-magic-secret-key-2026'

// Token 有效期：7 天
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 密碼雜湊（SHA-256）
 */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * 安全的字串比對（防止 timing attack）
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/**
 * 生成 JWT-like token
 */
export function generateToken(email: string): string {
  const payload = {
    email,
    exp: Date.now() + TOKEN_EXPIRY_MS,
    iat: Date.now(),
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHash('sha256')
    .update(payloadStr + JWT_SECRET)
    .digest('base64url')
  return `${payloadStr}.${signature}`
}

/**
 * 驗證 token
 */
export function verifyToken(token: string): { valid: boolean; email?: string } {
  try {
    const [payloadStr, signature] = token.split('.')
    if (!payloadStr || !signature) return { valid: false }

    // 驗證簽名
    const expectedSig = createHash('sha256')
      .update(payloadStr + JWT_SECRET)
      .digest('base64url')

    if (!secureCompare(signature, expectedSig)) {
      return { valid: false }
    }

    // 解析 payload
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString())

    // 檢查過期
    if (payload.exp < Date.now()) {
      return { valid: false }
    }

    return { valid: true, email: payload.email }
  } catch {
    return { valid: false }
  }
}

/**
 * 驗證登入
 */
export async function validateLogin(email: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  // 驗證 email
  if (!secureCompare(email?.toLowerCase() || '', AUTH_EMAIL.toLowerCase())) {
    await new Promise(r => setTimeout(r, 1000))
    return { success: false, error: '帳號或密碼錯誤' }
  }

  // 驗證密碼
  const passwordHash = hashPassword(password || '')
  if (!secureCompare(passwordHash, AUTH_PASSWORD_HASH)) {
    await new Promise(r => setTimeout(r, 1000))
    return { success: false, error: '帳號或密碼錯誤' }
  }

  // 生成 token
  const token = generateToken(email)
  return { success: true, token }
}
