import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from './auth'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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
  const prompt = `Extract ALL text from this presentation slide with positions and styles.

For each text block, return:
- text: exact content
- box_2d: [ymin, xmin, ymax, xmax] in 0-1000 scale
- font_size: pixels for 1920x1080
- is_bold: boolean
- align: "left" | "center" | "right"
- color: hex code (CRITICAL - see below!)

RULES:

1. SKIP "NotebookLM" watermark (bottom-right corner)

2. COLOR DETECTION - VERY IMPORTANT:
   NotebookLM slides use specific colors:
   - #E8D5A3 or #D4AF37 = Gold/Yellow headlines (COMMON! Look for warm yellow-ish text)
   - #FFFFFF = Pure white (only if truly bright white)
   - #000000 = Black text (in chat bubbles, light backgrounds)
   - #666666 = Gray captions

   IMPORTANT: If text has ANY yellow/gold/beige tint, use #E8D5A3 NOT #FFFFFF!
   Headlines and emphasis text are usually GOLD, not white.

3. BOUNDING BOX:
   - Coordinates relative to image (0,0 = top-left, 1000,1000 = bottom-right)
   - TIGHT fit around visible text

4. FONT SIZE (for 1920x1080):
   - Giant numbers: 80-120px
   - Headlines: 48-72px
   - Body text: 24-36px
   - Captions: 14-20px`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
              required: ['text', 'box_2d'],
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
 * CRITICAL: Uses gemini-2.5-flash-image model (NOT gemini-2.0-flash-exp-image-generation)
 * The imageBase64 should already have a black mask applied over the watermark area
 */
async function performInpainting(imageBase64: string): Promise<string> {
  // Prompt variations - rotate through these on retry
  // Key insight: Tell AI explicitly about the BLACK BOX to remove
  const promptVariations = [
    // 1. Most explicit - works best
    `INPAINTING & CLEANUP TASK:
1. There is a BLACK MASK BOX in the bottom-right corner. It is covering a logo. You MUST remove this black box and reconstruct the background behind it.
2. Remove ALL other text from the slide.
3. The final result should contain NO text and NO black box.
4. Output the clean image only.`,

    // 2. Direct instruction
    `Edit this image. Remove all text. There is a black rectangle in the bottom-right corner blocking a watermark. Remove the black rectangle and fill the gap with the background pattern.`,

    // 3. Simple
    `Remove all text. Remove the black square in the corner. Return clean background.`,

    // 4. Cleanup angle
    `Clean this slide. Erase all letters. Erase the black censorship box in the bottom right.`,

    // 5. Final fallback
    `Remove text. Remove black mask. Inpaint background.`,
  ]

  const maxAttempts = 5
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const selectedPrompt = promptVariations[(attempt - 1) % promptVariations.length]
    console.log(`[Inpainting] Attempt ${attempt}/${maxAttempts} with prompt variation ${(attempt - 1) % promptVariations.length + 1}`)

    try {
      // CRITICAL: Use correct model name - gemini-2.5-flash-image
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
