import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, timingSafeEqual } from 'crypto'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}
const JWT_SECRET = requireEnv('JWT_SECRET')

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
 * 驗證 token（內聯版本）
 */
function verifyToken(token: string): { valid: boolean; email?: string } {
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
  } catch (err) {
    console.error('[Auth] Token verification error:', err)
    return { valid: false }
  }
}

interface RequestBody {
  action: 'ocr' | 'inpaint'
  image: string
  options?: {
    removeWatermark?: boolean
    watermarkRegion?: [number, number, number, number]
  }
}

interface TextBlock {
  text: string
  box_2d: [number, number, number, number]
  font_size?: number
  color?: string
  is_bold?: boolean
  align?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 🔐 驗證身份
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '請先登入' })
  }

  const token = authHeader.substring(7)
  const authResult = verifyToken(token)
  if (!authResult.valid) {
    return res.status(401).json({ success: false, error: '登入已過期，請重新登入' })
  }

  // Check API key
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
  }

  try {
    const body = req.body as RequestBody
    const { action, image } = body

    if (!action || !image) {
      return res.status(400).json({ error: 'Missing action or image' })
    }

    if (action === 'ocr') {
      const result = await performOcr(image)
      return res.status(200).json({
        success: true,
        textBlocks: result,
      })
    }

    if (action === 'inpaint') {
      const result = await performInpainting(image)
      return res.status(200).json({
        success: true,
        cleanImage: result,
      })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (error) {
    console.error('Processing error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Perform OCR with Gemini
 */
async function performOcr(imageBase64: string): Promise<TextBlock[]> {
  const prompt = `You are a precise OCR system. Extract ALL visible text from this presentation slide.

STEP 1 - ANALYZE BACKGROUND:
Look at the overall slide background color:
- If background is DARK (black, navy, dark purple, etc.) → text will be LIGHT colored
- If background is LIGHT (white, cream, beige, etc.) → text will be DARK colored

STEP 2 - EXTRACT EACH TEXT BLOCK:
For each piece of text, return:
- text: exact content (preserve line breaks with \\n)
- box_2d: [ymin, xmin, ymax, xmax] in 0-1000 scale
- font_size: estimated size in pixels for 1920x1080 canvas
- is_bold: true if text appears bold
- align: "left" | "center" | "right"
- color: hex color code (MANDATORY - see rules below)

COLOR DETECTION RULES (CRITICAL):
1. Analyze the ACTUAL pixel color of the text, not assumptions
2. On DARK backgrounds:
   - White text: #FFFFFF
   - Gold/Yellow text: #E8D5A3 or #FFD700
   - Light gray text: #CCCCCC or #AAAAAA
3. On LIGHT/WHITE backgrounds:
   - Black text: #000000
   - Dark gray text: #333333 or #444444
   - Medium gray text: #666666 or #777777
4. ⚠️ NEVER return #FFFFFF for text on white/light backgrounds!
5. ⚠️ NEVER return #000000 for text on dark backgrounds!

SKIP: The "NotebookLM" watermark in bottom-right corner

FONT SIZE GUIDELINES:
- Large titles/numbers: 72-120px
- Headlines: 48-72px
- Body text: 24-36px
- Captions: 14-24px`

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                box_2d: {
                  type: 'ARRAY',
                  items: { type: 'NUMBER' },
                  minItems: 4,
                  maxItems: 4,
                },
                font_size: { type: 'NUMBER' },
                is_bold: { type: 'BOOLEAN' },
                align: { type: 'STRING' },
                color: { type: 'STRING' },
              },
              required: ['text', 'box_2d', 'color', 'font_size'],
            },
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OCR failed: ${error}`)
  }

  const data = await response.json()
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!textContent) {
    return []
  }

  try {
    return JSON.parse(textContent)
  } catch {
    console.error('Failed to parse OCR response:', textContent)
    return []
  }
}

/**
 * Perform inpainting to remove ALL text from the slide
 * This creates a clean background that editable text can be overlaid on
 *
 * CRITICAL: Uses gemini-2.5-flash-image (Nano Banana) for image editing
 * Tier 1 API access required
 * The imageBase64 should already have a black mask applied over the watermark area
 */
async function performInpainting(imageBase64: string): Promise<string> {
  // Prompt variations - rotate through on retry
  const promptVariations = [
    `INPAINTING & CLEANUP TASK:
1. There is a BLACK MASK BOX in the bottom-right corner covering a logo. You MUST remove this black box and reconstruct the background behind it.
2. Remove ALL other text from the slide.
3. The final result should contain NO text and NO black box.
4. Output the clean image only.`,

    `Edit this image. Remove all text. There is a black rectangle in the bottom-right corner blocking a watermark. Remove the black rectangle and fill the gap with the background pattern.`,

    `Remove all text. Remove the black square in the corner. Return clean background.`,
  ]

  const maxAttempts = 5
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const selectedPrompt = promptVariations[(attempt - 1) % promptVariations.length]
    console.log(`[Inpainting] Attempt ${attempt}/${maxAttempts} with prompt variation ${(attempt - 1) % promptVariations.length + 1}`)

    try {
      // CRITICAL: Use gemini-2.5-flash-image (Nano Banana) for image editing
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY!,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: selectedPrompt },
                  { inlineData: { mimeType: 'image/png', data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['IMAGE'],
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Inpainting] API error (${response.status}):`, errorText)

        // Check for rate limiting
        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
          console.log(`[Inpainting] Rate limited, waiting ${Math.round(delay)}ms...`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }

        throw new Error(`API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('[Inpainting] Response structure:', JSON.stringify(data).substring(0, 300))

      // Find the image data in the response
      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (part: { inlineData?: { data: string } }) => part.inlineData
      )

      if (imagePart?.inlineData?.data) {
        console.log(`[Inpainting] Success on attempt ${attempt}!`)
        return imagePart.inlineData.data
      }

      // No image returned - log reason and retry with different prompt
      const textReason = data.candidates?.[0]?.content?.parts?.find(
        (part: { text?: string }) => part.text
      )?.text || 'No reason provided'
      console.warn(`[Inpainting] Attempt ${attempt} returned no image. Reason: ${textReason.substring(0, 100)}...`)

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    } catch (error) {
      console.error(`[Inpainting] Attempt ${attempt} exception:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    }
  }

  throw lastError || new Error(`No image returned from Gemini after ${maxAttempts} attempts`)
}
