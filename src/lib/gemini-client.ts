import type { TextBlock } from '@/store/slides-store'
import { dataUrlToBase64, base64ToDataUrl, generateId, delay } from './utils'

const API_ENDPOINT = '/api/process-slide'

// Retry configuration
const MAX_RETRIES = 5
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]

// Watermark region (bottom-right corner)
// NotebookLM watermark - enlarged area to ensure full coverage
const WATERMARK_REGION = {
  xPercent: 80, // Start from 80% of width (more left)
  yPercent: 92, // Start from 92% of height (higher up)
  widthPercent: 20, // 20% of total width
  heightPercent: 8, // 8% of total height
}

interface ProcessResult {
  cleanImage: string
  textBlocks: TextBlock[]
}

/**
 * Add a black mask over the watermark region to help AI inpainting
 */
async function maskWatermark(imageBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw original image
      ctx.drawImage(img, 0, 0)

      // Calculate watermark region
      const x = (WATERMARK_REGION.xPercent / 100) * img.width
      const y = (WATERMARK_REGION.yPercent / 100) * img.height
      const width = (WATERMARK_REGION.widthPercent / 100) * img.width
      const height = (WATERMARK_REGION.heightPercent / 100) * img.height

      // Draw black rectangle over watermark area
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, width, height)

      // Convert back to base64
      const dataUrl = canvas.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = `data:image/png;base64,${imageBase64}`
  })
}

/**
 * Process a slide: remove watermark and extract text
 */
export async function processSlide(originalImage: string): Promise<ProcessResult> {
  const base64 = dataUrlToBase64(originalImage)

  // Step 1: Mask watermark area with black rectangle, then inpaint
  const maskedBase64 = await maskWatermark(base64)
  const cleanImage = await removeWatermark(maskedBase64)

  // Step 2: Extract text with OCR (use original image for accurate OCR)
  const textBlocks = await extractText(base64)

  return {
    cleanImage: base64ToDataUrl(cleanImage),
    textBlocks,
  }
}

/**
 * Remove watermark using AI inpainting
 */
async function removeWatermark(imageBase64: string): Promise<string> {
  const response = await fetchWithRetry(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'inpaint',
      image: imageBase64,
      options: {
        removeWatermark: true,
        // NotebookLM watermark is in the bottom-right corner
        // Approximate region: bottom 5%, right 15%
        watermarkRegion: [950, 850, 1000, 1000], // [ymin, xmin, ymax, xmax] in 0-1000 scale
      },
    }),
  })

  if (!response.success) {
    throw new Error(response.error ?? 'Watermark removal failed')
  }

  return response.cleanImage ?? ''
}

/**
 * Extract text blocks with coordinates using OCR
 */
async function extractText(imageBase64: string): Promise<TextBlock[]> {
  const response = await fetchWithRetry(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'ocr',
      image: imageBase64,
    }),
  })

  if (!response.success) {
    throw new Error(response.error ?? 'Text extraction failed')
  }

  // Convert API response to TextBlock format
  // Filter out the "NotebookLM" watermark text
  return (response.textBlocks ?? [])
    .filter((block: RawTextBlock) => {
      const text = block.text?.toLowerCase() || ''
      return !text.includes('notebooklm') && text.trim().length > 0
    })
    .map((block: RawTextBlock) => ({
      id: generateId(),
      text: block.text,
      box: {
        x: (block.box_2d[1] / 10), // xmin: convert from 0-1000 to 0-100%
        y: (block.box_2d[0] / 10), // ymin
        width: ((block.box_2d[3] - block.box_2d[1]) / 10), // xmax - xmin
        height: ((block.box_2d[2] - block.box_2d[0]) / 10), // ymax - ymin
      },
      style: {
        fontSize: block.font_size || 24,
        color: block.color || '#FFFFFF',
        bold: block.is_bold || false,
        align: (block.align || 'left') as 'left' | 'center' | 'right',
      },
    }))
}

interface RawTextBlock {
  text: string
  box_2d: [number, number, number, number] // [ymin, xmin, ymax, xmax]
  font_size?: number
  color?: string
  is_bold?: boolean
  align?: string
}

interface ApiResponse {
  success: boolean
  error?: string
  cleanImage?: string
  textBlocks?: RawTextBlock[]
}

/**
 * Fetch with retry logic for rate limiting
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<ApiResponse> {
  try {
    const response = await fetch(url, options)

    if (response.ok) {
      return await response.json()
    }

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const waitTime = RETRY_DELAYS[retryCount]
        console.log(`Rate limited, retrying in ${waitTime}ms...`)
        await delay(waitTime)
        return fetchWithRetry(url, options, retryCount + 1)
      }
    }

    // Handle server errors
    if (response.status >= 500) {
      if (retryCount < MAX_RETRIES) {
        await delay(2000)
        return fetchWithRetry(url, options, retryCount + 1)
      }
    }

    const errorJson = await response.json().catch(() => ({ error: undefined })) as { error?: string }
    throw new Error(
      errorJson.error ?? `HTTP ${response.status}: ${response.statusText}`
    )
  } catch (error) {
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      // Network error, retry
      await delay(RETRY_DELAYS[retryCount])
      return fetchWithRetry(url, options, retryCount + 1)
    }
    throw error
  }
}

/**
 * Direct Gemini API call (for development/testing without backend)
 */
export async function processSlideDirectly(
  originalImage: string,
  apiKey: string
): Promise<ProcessResult> {
  const base64 = dataUrlToBase64(originalImage)

  // OCR with structured output
  const ocrPrompt = `Analyze this presentation slide image. Extract ALL text blocks with their positions.

For each text block, provide:
- text: the exact text content
- box_2d: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale, where 0,0 is top-left and 1000,1000 is bottom-right)
- font_size: estimated font size in pixels
- is_bold: boolean
- align: "left", "center", or "right"
- color: hex color code

IMPORTANT:
- Do NOT include the "NotebookLM" watermark in the results
- Return coordinates in 0-1000 scale relative to image dimensions
- Detect Chinese characters accurately`

  const ocrResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: ocrPrompt },
              { inlineData: { mimeType: 'image/png', data: base64 } },
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

  const ocrData = await ocrResponse.json()
  const rawBlocks: RawTextBlock[] = JSON.parse(
    ocrData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  )

  // Inpainting for watermark removal
  const inpaintPrompt = `Remove the "NotebookLM" watermark text and small icon from the bottom-right corner of this presentation slide.
Fill the area naturally using the surrounding background texture and colors.
Maintain the quality and resolution of the original image.
Do not alter any other content on the slide.`

  const inpaintResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: inpaintPrompt },
              { inlineData: { mimeType: 'image/png', data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    }
  )

  const inpaintData = await inpaintResponse.json()
  const cleanImageBase64 =
    inpaintData.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data: string } }) => p.inlineData
    )?.inlineData?.data || base64

  // Convert and filter results
  const textBlocks: TextBlock[] = rawBlocks
    .filter((block) => {
      const text = block.text?.toLowerCase() || ''
      return !text.includes('notebooklm') && text.trim().length > 0
    })
    .map((block) => ({
      id: generateId(),
      text: block.text,
      box: {
        x: block.box_2d[1] / 10,
        y: block.box_2d[0] / 10,
        width: (block.box_2d[3] - block.box_2d[1]) / 10,
        height: (block.box_2d[2] - block.box_2d[0]) / 10,
      },
      style: {
        fontSize: block.font_size || 24,
        color: block.color || '#FFFFFF',
        bold: block.is_bold || false,
        align: (block.align || 'left') as 'left' | 'center' | 'right',
      },
    }))

  return {
    cleanImage: base64ToDataUrl(cleanImageBase64),
    textBlocks,
  }
}
