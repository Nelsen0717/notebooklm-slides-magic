import { useState, useRef, useEffect, useCallback } from 'react'
import { useSlidesStore, type Slide, type TextBlock } from '@/store/slides-store'
import { cn } from '@/lib/utils'
import { Wand2, Loader2, ImageIcon, AlertCircle, Download, Eye, RotateCcw, Pipette, Move, MousePointer } from 'lucide-react'
import { downloadImage } from '@/lib/utils'

interface SlidePreviewProps {
  slide: Slide
  onProcess: () => void
}

type ViewMode = 'processed' | 'original' | 'preview'

// Original slide dimensions (16:9 at 1920x1080)
const ORIGINAL_WIDTH = 1920
const IMAGE_ASPECT_RATIO = 16 / 9 // NotebookLM slides are always 16:9

interface DragState {
  blockId: string
  startX: number
  startY: number
  startBoxX: number
  startBoxY: number
}

export function SlidePreview({ slide, onProcess }: SlidePreviewProps) {
  const { eyedropperActiveBlockId, setEyedropperActiveBlockId, updateTextBlock } = useSlidesStore()
  const [viewMode, setViewMode] = useState<ViewMode>('processed')
  const [editMode, setEditMode] = useState(false) // 拖曳編輯模式
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [isCanvasReady, setIsCanvasReady] = useState(false)

  // Track container size for proper font scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Calculate actual image bounds within container
  // This accounts for object-contain letterboxing
  const getImageBounds = () => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { imgWidth: 0, imgHeight: 0, imgLeft: 0, imgTop: 0 }
    }

    const containerAspect = containerSize.width / containerSize.height
    let imgWidth: number, imgHeight: number, imgLeft: number, imgTop: number

    if (containerAspect > IMAGE_ASPECT_RATIO) {
      // Container is wider than image - horizontal padding (letterboxing on sides)
      imgHeight = containerSize.height
      imgWidth = imgHeight * IMAGE_ASPECT_RATIO
      imgLeft = (containerSize.width - imgWidth) / 2
      imgTop = 0
    } else {
      // Container is taller than image - vertical padding (letterboxing on top/bottom)
      imgWidth = containerSize.width
      imgHeight = imgWidth / IMAGE_ASPECT_RATIO
      imgLeft = 0
      imgTop = (containerSize.height - imgHeight) / 2
    }

    return { imgWidth, imgHeight, imgLeft, imgTop }
  }

  const imageBounds = getImageBounds()

  // Calculate scale factor for font size based on actual image width
  const scaleFactor = imageBounds.imgWidth > 0 ? imageBounds.imgWidth / ORIGINAL_WIDTH : 0.5

  // Drag handlers for text blocks
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, block: TextBlock) => {
    if (!editMode || eyedropperActiveBlockId) return
    e.preventDefault()
    e.stopPropagation()

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    setDragState({
      blockId: block.id,
      startX: clientX,
      startY: clientY,
      startBoxX: block.box.x,
      startBoxY: block.box.y,
    })
  }, [editMode, eyedropperActiveBlockId])

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState || !imageBounds.imgWidth) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // Calculate delta in pixels
    const deltaX = clientX - dragState.startX
    const deltaY = clientY - dragState.startY

    // Convert pixel delta to percentage of image dimensions
    const deltaXPct = (deltaX / imageBounds.imgWidth) * 100
    const deltaYPct = (deltaY / imageBounds.imgHeight) * 100

    // Calculate new position (clamped to 0-100)
    const newX = Math.max(0, Math.min(100, dragState.startBoxX + deltaXPct))
    const newY = Math.max(0, Math.min(100, dragState.startBoxY + deltaYPct))

    // Update the block position
    const block = slide.textBlocks.find(b => b.id === dragState.blockId)
    if (block) {
      updateTextBlock(slide.id, dragState.blockId, {
        box: { ...block.box, x: newX, y: newY },
      })
    }
  }, [dragState, imageBounds, slide.id, slide.textBlocks, updateTextBlock])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
  }, [])

  // Add global mouse/touch event listeners for drag
  useEffect(() => {
    if (dragState) {
      const handleMove = (e: MouseEvent | TouchEvent) => handleDragMove(e)
      const handleEnd = () => handleDragEnd()

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleEnd)
      window.addEventListener('touchmove', handleMove, { passive: false })
      window.addEventListener('touchend', handleEnd)

      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleEnd)
        window.removeEventListener('touchmove', handleMove)
        window.removeEventListener('touchend', handleEnd)
      }
    }
  }, [dragState, handleDragMove, handleDragEnd])

  // Load image into hidden canvas for color picking
  useEffect(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || !slide.originalImage) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loadImage = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      setIsCanvasReady(true)
    }

    if (img.complete && img.naturalWidth > 0) {
      loadImage()
    } else {
      img.onload = loadImage
    }
  }, [slide.originalImage])

  // Handle eyedropper click
  const handleEyedropperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!eyedropperActiveBlockId || !canvasRef.current || !isCanvasReady) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Calculate position relative to the actual image (accounting for letterboxing)
    const relX = clickX - imageBounds.imgLeft
    const relY = clickY - imageBounds.imgTop

    // Check if click is within image bounds
    if (relX < 0 || relX > imageBounds.imgWidth || relY < 0 || relY > imageBounds.imgHeight) {
      return
    }

    // Convert to canvas coordinates
    const canvasX = Math.floor((relX / imageBounds.imgWidth) * canvas.width)
    const canvasY = Math.floor((relY / imageBounds.imgHeight) * canvas.height)

    try {
      const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data
      const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`

      // Find the block and update its color
      const block = slide.textBlocks.find(b => b.id === eyedropperActiveBlockId)
      if (block) {
        updateTextBlock(slide.id, eyedropperActiveBlockId, {
          style: { ...block.style, color: hex }
        })
      }
      setEyedropperActiveBlockId(null)
    } catch (err) {
      console.error('無法讀取顏色:', err)
      setEyedropperActiveBlockId(null)
    }
  }, [eyedropperActiveBlockId, isCanvasReady, imageBounds, slide.textBlocks, slide.id, updateTextBlock, setEyedropperActiveBlockId])

  const isProcessing = slide.status === 'processing'
  const isCompleted = slide.status === 'completed'
  const isError = slide.status === 'error'
  const isPending = slide.status === 'pending'

  const displayImage = viewMode === 'original'
    ? slide.originalImage
    : slide.cleanImage || slide.originalImage

  const showTextOverlay = viewMode === 'preview' && isCompleted

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      {isCompleted && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center bg-surface-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('processed')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-md transition-all',
                viewMode === 'processed'
                  ? 'bg-primary text-dark-400 shadow-glow'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              純背景
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-1',
                viewMode === 'preview'
                  ? 'bg-primary text-dark-400 shadow-glow'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              <Eye className="w-3 h-3" />
              最終預覽
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-md transition-all',
                viewMode === 'original'
                  ? 'bg-primary text-dark-400 shadow-glow'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              原圖
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Mode Toggle - only visible in preview mode */}
            {viewMode === 'preview' && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-all',
                  editMode
                    ? 'bg-amber-500 text-dark-400 shadow-lg'
                    : 'bg-surface-100 text-neutral-400 hover:bg-surface-50 hover:text-white'
                )}
              >
                {editMode ? <Move className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
                {editMode ? '拖曳模式' : '編輯位置'}
              </button>
            )}

            {viewMode === 'processed' && slide.cleanImage && (
              <button
                onClick={() => downloadImage(slide.cleanImage!, `slide-${slide.pageNumber}-clean.png`)}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" />
                下載圖片
              </button>
            )}
          </div>
        </div>
      )}

      {/* Image Preview */}
      <div
        ref={containerRef}
        className={cn(
          "relative aspect-video bg-dark-400 rounded-xl overflow-hidden",
          eyedropperActiveBlockId && "cursor-crosshair ring-2 ring-primary ring-offset-2",
          editMode && "ring-2 ring-amber-500/50",
          dragState && "select-none"
        )}
        onClick={eyedropperActiveBlockId ? handleEyedropperClick : undefined}
      >
        {/* Hidden canvas for color picking */}
        <canvas ref={canvasRef} className="hidden" />
        {/* Hidden image to load original for color picking */}
        <img
          ref={imgRef}
          src={slide.originalImage}
          alt=""
          className="hidden"
          crossOrigin="anonymous"
        />

        <img
          src={displayImage}
          alt={`Slide ${slide.pageNumber}`}
          className="w-full h-full object-contain"
        />

        {/* Text blocks overlay for preview mode */}
        {/* 與 PPT 導出保持一致：使用百分比定位 + 垂直置中 */}
        {showTextOverlay && slide.textBlocks.length > 0 && (
          <div className={cn("absolute inset-0", !editMode && "pointer-events-none")}>
            {slide.textBlocks.map((block) => {
              // 使用百分比定位（與 PPT 導出一致）
              const topPct = block.box.y
              const leftPct = block.box.x
              const widthPct = block.box.width
              const heightPct = block.box.height

              // 字體大小縮放
              // PPT 導出用原始 fontSize，但預覽容器較小需要縮放
              // scaleFactor = containerWidth / 1920
              const scaledFontSize = Math.max(8, Math.round(block.style.fontSize * scaleFactor))

              const isDragging = dragState?.blockId === block.id
              const isHovered = hoveredBlockId === block.id

              return (
                <div
                  key={block.id}
                  className={cn(
                    "absolute flex items-center transition-all",
                    editMode && "cursor-move",
                    editMode && (isDragging || isHovered) && "ring-2 ring-primary ring-offset-1 ring-offset-transparent rounded-md bg-primary/10",
                    isDragging && "z-50 opacity-90"
                  )}
                  style={{
                    top: `${topPct}%`,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    fontSize: `${scaledFontSize}px`,
                    color: block.style.color,
                    fontWeight: block.style.bold ? 'bold' : 'normal',
                    textAlign: block.style.align,
                    justifyContent: block.style.align === 'center' ? 'center' : block.style.align === 'right' ? 'flex-end' : 'flex-start',
                    lineHeight: 1.3,
                    fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                  onMouseDown={(e) => handleDragStart(e, block)}
                  onTouchStart={(e) => handleDragStart(e, block)}
                  onMouseEnter={() => editMode && setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                >
                  {/* Drag handle indicator */}
                  {editMode && (isHovered || isDragging) && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary text-dark-400 text-[10px] px-2 py-0.5 rounded-md font-semibold whitespace-nowrap flex items-center gap-1 shadow-lg">
                      <Move className="w-3 h-3" />
                      拖曳移動
                    </div>
                  )}
                  {block.text}
                </div>
              )
            })}
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-dark/60 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <span className="text-white font-semibold">AI 處理中...</span>
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-3 p-4">
            <AlertCircle className="w-10 h-10 text-white" />
            <span className="text-white font-semibold text-center">
              處理失敗
            </span>
            {slide.error && (
              <span className="text-white/80 text-sm text-center max-w-xs">
                {slide.error}
              </span>
            )}
            <button
              onClick={onProcess}
              className="mt-2 bg-white text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              重試
            </button>
          </div>
        )}


        {/* Preview mode badge */}
        {viewMode === 'preview' && !editMode && !eyedropperActiveBlockId && (
          <div className="absolute top-2 left-2 bg-primary text-dark-400 text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1 shadow-glow">
            <Eye className="w-3 h-3" />
            最終預覽 (圖片+文字)
          </div>
        )}

        {/* Edit mode badge */}
        {editMode && !eyedropperActiveBlockId && (
          <div className="absolute top-2 left-2 bg-amber-500 text-dark-400 text-xs px-2 py-1.5 rounded-md font-semibold flex items-center gap-1.5 shadow-lg animate-pulse">
            <Move className="w-3.5 h-3.5" />
            拖曳模式：點擊並拖曳文字區塊移動位置
          </div>
        )}

        {/* Completed badge */}
        {isCompleted && viewMode === 'processed' && !eyedropperActiveBlockId && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1">
            <Wand2 className="w-3 h-3" />
            文字已清除
          </div>
        )}

        {/* Eyedropper active badge */}
        {eyedropperActiveBlockId && (
          <div className="absolute top-2 left-2 bg-primary text-dark-400 text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-2 animate-pulse shadow-glow">
            <Pipette className="w-4 h-4" />
            點擊圖片吸取顏色
          </div>
        )}
      </div>

      {/* Action button */}
      {isPending && (
        <button
          onClick={onProcess}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Wand2 className="w-5 h-5" />
          處理此頁
        </button>
      )}

      {isCompleted && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <ImageIcon className="w-5 h-5 text-green-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-400">
                  處理完成！
                </p>
                <p className="text-xs text-green-500/80 mt-1">
                  背景已清理，文字已提取 ({slide.textBlocks.length} 個區塊)
                </p>
              </div>
            </div>
            <button
              onClick={onProcess}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-colors"
              title="重新處理此頁"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新處理
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
