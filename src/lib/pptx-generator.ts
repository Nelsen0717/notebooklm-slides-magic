import PptxGenJS from 'pptxgenjs'
import type { Slide, ExportMode } from '@/store/slides-store'

export interface ExportOptions {
  mode: ExportMode
  filename: string
  layout: '16:9' | '4:3' | '9:16'
}

/**
 * Generate PPTX from processed slides
 */
export async function generatePptx(
  slides: Slide[],
  options: ExportOptions
): Promise<void> {
  const pptx = new PptxGenJS()

  // Set layout
  configureLayout(pptx, options.layout)

  // Set presentation properties
  pptx.author = 'FUNRAISE Slides Magic'
  pptx.company = 'FUNRAISE 方睿科技'
  pptx.subject = 'NotebookLM Presentation Export'
  pptx.title = options.filename

  // Generate slides based on mode
  for (const slide of slides) {
    if (slide.status !== 'completed') continue

    const pptSlide = pptx.addSlide()

    switch (options.mode) {
      case 'images':
        addImageOnlySlide(pptSlide, slide)
        break
      case 'text':
        addTextOnlySlide(pptSlide, slide)
        break
      case 'combined':
        addCombinedSlide(pptSlide, slide)
        break
    }
  }

  // Download the file
  await pptx.writeFile({ fileName: `${options.filename}.pptx` })
}

/**
 * Configure PPTX layout based on aspect ratio
 */
function configureLayout(pptx: PptxGenJS, layout: '16:9' | '4:3' | '9:16'): void {
  switch (layout) {
    case '16:9':
      pptx.layout = 'LAYOUT_WIDE'
      break
    case '4:3':
      pptx.layout = 'LAYOUT_4x3'
      break
    case '9:16':
      pptx.defineLayout({ name: 'MOBILE', width: 5.625, height: 10 })
      pptx.layout = 'MOBILE'
      break
  }
}

/**
 * Add slide with image only (watermark removed)
 */
function addImageOnlySlide(pptSlide: PptxGenJS.Slide, slide: Slide): void {
  const imageData = slide.cleanImage || slide.originalImage

  pptSlide.addImage({
    data: imageData,
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    sizing: { type: 'contain', w: '100%', h: '100%' },
  })
}

/**
 * Add slide with text boxes only (no background image)
 */
function addTextOnlySlide(pptSlide: PptxGenJS.Slide, slide: Slide): void {
  // Set dark background like original
  pptSlide.background = { fill: '1A1A2E' }

  // Add each text block
  for (const block of slide.textBlocks) {
    pptSlide.addText(block.text, {
      x: `${block.box.x}%`,
      y: `${block.box.y}%`,
      w: `${block.box.width}%`,
      h: `${block.box.height}%`,
      fontSize: block.style.fontSize,
      color: block.style.color.replace('#', ''),
      bold: block.style.bold,
      align: block.style.align,
      valign: 'middle',
      fontFace: 'Noto Sans TC',
      wrap: true,
    })
  }
}

/**
 * Add slide with image background + text overlay
 */
function addCombinedSlide(pptSlide: PptxGenJS.Slide, slide: Slide): void {
  // Add clean image as background
  const imageData = slide.cleanImage || slide.originalImage

  pptSlide.addImage({
    data: imageData,
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    sizing: { type: 'contain', w: '100%', h: '100%' },
  })

  // Add text blocks on top
  for (const block of slide.textBlocks) {
    pptSlide.addText(block.text, {
      x: `${block.box.x}%`,
      y: `${block.box.y}%`,
      w: `${block.box.width}%`,
      h: `${block.box.height}%`,
      fontSize: block.style.fontSize,
      color: block.style.color.replace('#', ''),
      bold: block.style.bold,
      align: block.style.align,
      valign: 'middle',
      fontFace: 'Noto Sans TC',
      wrap: true,
    })
  }
}

/**
 * Preview what the export will look like
 */
export function getExportPreview(slides: Slide[], mode: ExportMode): {
  totalSlides: number
  hasImages: boolean
  hasText: boolean
  textBlockCount: number
} {
  const completedSlides = slides.filter((s) => s.status === 'completed')
  const totalTextBlocks = completedSlides.reduce(
    (sum, s) => sum + s.textBlocks.length,
    0
  )

  return {
    totalSlides: completedSlides.length,
    hasImages: mode === 'images' || mode === 'combined',
    hasText: mode === 'text' || mode === 'combined',
    textBlockCount: totalTextBlocks,
  }
}
