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
- text: the exact text content (preserve line breaks if multi-line)
- box_2d: [ymin, xmin, ymax, xmax] coordinates in 0-1000 scale (0,0 = top-left, 1000,1000 = bottom-right)
- font_size: estimated font size in pixels (based on image being 1920x1080)
- is_bold: boolean (true if the text appears bold)
- align: "left", "center", or "right" (based on text alignment)
- color: hex color code (e.g., "#FFFFFF")

CRITICAL INSTRUCTIONS:
1. Do NOT include the "NotebookLM" watermark in results (usually in bottom-right corner)
2. Return coordinates using the 0-1000 scale relative to image dimensions
3. Detect Chinese characters accurately
4. Group text that belongs together into single blocks
5. For large headlines, estimate font_size appropriately (often 48-72px)
6. For body text, font_size is usually 18-32px`

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
 * Perform inpainting for watermark removal
 */
async function performInpainting(imageBase64: string): Promise<string> {
  const prompt = `Remove the "NotebookLM" watermark text and small speech bubble icon from the bottom-right corner of this presentation slide image.

Instructions:
1. Locate the watermark in the bottom-right corner (usually small gray text "NotebookLM" with an icon)
2. Fill the watermark area naturally using the surrounding background
3. Match the background texture, color, and pattern seamlessly
4. Maintain the original image quality and resolution
5. Do not alter any other content on the slide
6. If the background is solid color, use that color
7. If the background has a gradient or texture, extend it naturally`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`,
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
