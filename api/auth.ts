import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, timingSafeEqual } from 'crypto'

// 環境變數中的認證資訊（在 Vercel 設定）
// AUTH_EMAIL=nelsen.chen@funraise.com.tw
// AUTH_PASSWORD_HASH=<hashed password>
// JWT_SECRET=<random secret>

const AUTH_EMAIL = process.env.AUTH_EMAIL || 'nelsen.chen@funraise.com.tw'
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || hashPassword('funraise888')
const JWT_SECRET = process.env.JWT_SECRET || 'notebooklm-slides-magic-secret-key-2026'

// Token 有效期：7 天
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 密碼雜湊（SHA-256）
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * 安全的字串比對（防止 timing attack）
 */
function secureCompare(a: string, b: string): boolean {
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
function generateToken(email: string): string {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { action, email, password, token } = req.body

    if (action === 'login') {
      // 驗證 email
      if (!secureCompare(email?.toLowerCase() || '', AUTH_EMAIL.toLowerCase())) {
        // 故意延遲回應以防止暴力破解
        await new Promise(r => setTimeout(r, 1000))
        return res.status(401).json({ success: false, error: '帳號或密碼錯誤' })
      }

      // 驗證密碼
      const passwordHash = hashPassword(password || '')
      if (!secureCompare(passwordHash, AUTH_PASSWORD_HASH)) {
        await new Promise(r => setTimeout(r, 1000))
        return res.status(401).json({ success: false, error: '帳號或密碼錯誤' })
      }

      // 生成 token
      const authToken = generateToken(email)
      return res.status(200).json({
        success: true,
        token: authToken,
        expiresIn: TOKEN_EXPIRY_MS,
      })
    }

    if (action === 'verify') {
      const result = verifyToken(token || '')
      return res.status(200).json({
        success: result.valid,
        email: result.email,
      })
    }

    return res.status(400).json({ success: false, error: 'Invalid action' })
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(500).json({ success: false, error: '伺服器錯誤' })
  }
}
