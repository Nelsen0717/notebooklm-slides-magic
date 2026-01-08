import type { TextBlock } from '@/store/slides-store'
import { dataUrlToBase64, base64ToDataUrl, generateId, delay } from './utils'

const API_ENDPOINT = '/api/process-slide'

// Retry configuration
const MAX_RETRIES = 5
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]

// Image compression settings
// Vercel has 4.5MB body limit, we target max 3MB for safety
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024 // 3MB
const COMPRESSION_QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5]
const MAX_DIMENSION = 1920 // Max width/height

interface ProcessResult {
  cleanImage: string
  textBlocks: TextBlock[]
}

/**
 * Compress image to fit within size limit
 * This is critical for mobile devices which may have larger images
 */
async function compressImage(base64WithoutPrefix: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Resize if too large
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
        console.log(`[compressImage] Resizing from ${img.width}x${img.height} to ${width}x${height}`)
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        console.warn('[compressImage] Failed to get canvas context')
        resolve(base64WithoutPrefix)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Try different quality levels until size is acceptable
      for (const quality of COMPRESSION_QUALITY_STEPS) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1]
        const sizeBytes = Math.round(base64.length * 0.75) // Base64 overhead

        if (sizeBytes <= MAX_IMAGE_SIZE_BYTES) {
          console.log(`[compressImage] Compressed to ${(sizeBytes / 1024 / 1024).toFixed(2)}MB at quality ${quality}`)
          resolve(base64)
          return
        }
      }

      // If still too large, use lowest quality
      const finalDataUrl = canvas.toDataURL('image/jpeg', 0.4)
      const finalBase64 = finalDataUrl.split(',')[1]
      console.log(`[compressImage] Used minimum quality, size: ${(finalBase64.length * 0.75 / 1024 / 1024).toFixed(2)}MB`)
      resolve(finalBase64)
    }

    img.onerror = (e) => {
      console.error('[compressImage] Image load failed', e)
      resolve(base64WithoutPrefix)
    }

    img.src = `data:image/png;base64,${base64WithoutPrefix}`
  })
}

/**
 * Apply a BLACK MASK over the watermark area before sending to AI
 *
 * Key insight from working implementation:
 * - AI is better at "removing a black box" than "finding and removing a watermark"
 * - The black mask forces AI to understand what needs to be inpainted
 *
 * NotebookLM watermark location: Bottom-right corner
 * Mask size: 13% width, 6% height (based on working implementation)
 */
async function applyBlackMask(base64WithoutPrefix: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Resize if too large (same as compressImage)
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        console.warn('[applyBlackMask] Failed to get canvas context, returning original')
        resolve(base64WithoutPrefix)
        return
      }

      // Draw original image (resized)
      ctx.drawImage(img, 0, 0, width, height)

      // Apply black mask over watermark area
      // NotebookLM watermark is consistently at bottom-right
      const maskW = width * 0.13  // 13% width covers logo + text
      const maskH = height * 0.06 // 6% height
      const x = width - maskW     // Right edge
      const y = height - maskH    // Bottom edge

      ctx.fillStyle = '#000000' // Pure black mask
      ctx.fillRect(x, y, maskW, maskH)

      // Compress output
      for (const quality of COMPRESSION_QUALITY_STEPS) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1]
        const sizeBytes = Math.round(base64.length * 0.75)

        if (sizeBytes <= MAX_IMAGE_SIZE_BYTES) {
          resolve(base64)
          return
        }
      }

      // Fallback to lowest quality
      const dataUrl = canvas.toDataURL('image/jpeg', 0.4)
      resolve(dataUrl.split(',')[1])
    }

    img.onerror = (e) => {
      console.error('[applyBlackMask] Image load failed', e)
      resolve(base64WithoutPrefix)
    }

    img.src = `data:image/png;base64,${base64WithoutPrefix}`
  })
}

/**
 * Process a slide: remove all text (including watermark) and extract text
 *
 * Strategy (from working implementation):
 * 1. Apply BLACK MASK over watermark area
 * 2. Send MASKED image to AI with prompts that explicitly mention "remove black box"
 * 3. OCR on ORIGINAL image (without mask) for accurate text detection
 *
 * CRITICAL: Images are compressed to avoid HTTP 413 errors on mobile
 */
export async function processSlide(originalImage: string): Promise<ProcessResult> {
  const base64 = dataUrlToBase64(originalImage)

  // Step 1: Apply black mask over watermark AND compress
  // This also resizes to max 1920px and compresses to JPEG
  const maskedImage = await applyBlackMask(base64)
  const cleanImage = await removeAllText(maskedImage)

  // Step 2: Extract text with OCR (compress image first)
  const compressedBase64 = await compressImage(base64)
  const textBlocks = await extractText(compressedBase64)

  return {
    cleanImage: base64ToDataUrl(cleanImage),
    textBlocks,
  }
}

/**
 * Remove ALL text from slide using AI inpainting
 *
 * EXPECTS: Image with black mask already applied over watermark area
 * The API prompts explicitly tell AI to "remove the black box"
 */
async function removeAllText(imageBase64: string): Promise<string> {
  const response = await fetchWithRetry(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'inpaint',
      image: imageBase64,
    }),
  })

  if (!response.success) {
    throw new Error(response.error ?? 'Text removal failed')
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
 * 獲取 auth token
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
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
    // 加入 auth token
    const token = getAuthToken()
    const headers = new Headers(options.headers)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(url, { ...options, headers })

    if (response.ok) {
      return await response.json()
    }

    // Handle unauthorized - token expired
    if (response.status === 401) {
      // 清除過期的 token
      localStorage.removeItem('auth_token')
      window.location.reload() // 強制重新載入以顯示登入頁
      throw new Error('登入已過期，請重新登入')
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
