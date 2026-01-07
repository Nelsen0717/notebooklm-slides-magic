import * as pdfjsLib from 'pdfjs-dist'
import type { Slide } from '@/store/slides-store'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export interface ParseOptions {
  scale?: number  // Render scale (default: 2.5 for high quality)
  onProgress?: (current: number, total: number) => void
}

/**
 * Parse a PDF file and extract all pages as images
 */
export async function parsePdf(
  file: File,
  options: ParseOptions = {}
): Promise<Slide[]> {
  const { scale = 2.5, onProgress } = options

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const slides: Slide[] = []
  const totalPages = pdf.numPages

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    // Create canvas for rendering
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.height = viewport.height
    canvas.width = viewport.width

    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise

    // Convert to base64
    const imageDataUrl = canvas.toDataURL('image/png')

    slides.push({
      id: `slide-${pageNum}`,
      pageNumber: pageNum,
      originalImage: imageDataUrl,
      textBlocks: [],
      status: 'pending',
    })

    // Report progress
    onProgress?.(pageNum, totalPages)

    // Clean up
    canvas.width = 0
    canvas.height = 0
  }

  return slides
}

/**
 * Extract a single page from PDF as base64 image
 */
export async function extractPageAsImage(
  file: File,
  pageNumber: number,
  scale: number = 2.5
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  canvas.height = viewport.height
  canvas.width = viewport.width

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise

  const imageDataUrl = canvas.toDataURL('image/png')

  canvas.width = 0
  canvas.height = 0

  return imageDataUrl
}

/**
 * Get PDF metadata (page count, dimensions)
 */
export async function getPdfMetadata(file: File): Promise<{
  pageCount: number
  width: number
  height: number
}> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })

  return {
    pageCount: pdf.numPages,
    width: viewport.width,
    height: viewport.height,
  }
}
