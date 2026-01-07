import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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
  const prompt = `Analyze this presentation slide image. Extract ALL text blocks with their precise positions.

For each text block, provide:
- text: the exact text content (preserve line breaks ONLY if actually multi-line)
- box_2d: [ymin, xmin, ymax, xmax] coordinates in 0-1000 scale
- font_size: estimated font size in pixels (for 1920x1080 image)
- is_bold: boolean
- align: "left", "center", or "right"
- color: the ACTUAL hex color code of the text

CRITICAL INSTRUCTIONS:

1. SKIP the "NotebookLM" watermark in bottom-right corner

2. TEXT COLOR - VERY IMPORTANT:
   - Look at the ACTUAL pixel color of the text
   - On DARK backgrounds: text is usually WHITE (#FFFFFF) or light colors
   - On LIGHT/WHITE backgrounds: text is usually BLACK (#000000) or dark colors
   - On message bubbles (light gray/white): text is BLACK (#000000)
   - Highlighted keywords may be GOLD (#FFD700), BLUE (#0066FF), or RED (#E53935)
   - DO NOT default to white - check the actual color!

3. FONT SIZE - estimate based on 1920x1080:
   - Large headlines: 48-72px
   - Medium titles: 32-48px
   - Body text: 18-28px
   - Small labels: 12-16px

4. BOUNDING BOX - be PRECISE:
   - Box should tightly fit the text
   - Not too wide (causes misalignment)
   - Not too narrow (cuts off text)
   - Include the full width of the text line

5. Keep related text together as single blocks
6. Detect Chinese characters accurately`

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
 */
async function performInpainting(imageBase64: string): Promise<string> {
  // Use gemini-2.5-flash-image for better quality image editing
  const prompt = `Edit this presentation slide image to create a clean background.

TASK: Remove ALL text from this image:
- Headlines, titles, body text, bullet points, numbers, labels
- There is a BLACK RECTANGLE in the bottom-right corner - this is a MASKED AREA that needs to be filled with the surrounding background color/texture

CRITICAL:
- The black rectangle in the bottom-right is NOT part of the original image
- Fill it with the surrounding background (usually dark gradient or solid color)
- Do NOT write any text in the black rectangle area
- Do NOT write "NotebookLM" or any watermark text anywhere

KEEP: Background colors, gradients, images, photos, decorative graphics, icons (without text)

OUTPUT: A completely clean background with NO text anywhere on the image.`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
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
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Inpainting failed: ${error}`)
  }

  const data = await response.json()

  // Find the image data in the response
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (part: { inlineData?: { data: string } }) => part.inlineData
  )

  if (!imagePart?.inlineData?.data) {
    // If no image was generated, return the original
    console.warn('No inpainted image returned, using original')
    return imageBase64
  }

  return imagePart.inlineData.data
}
