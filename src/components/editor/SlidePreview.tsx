import { useState, useRef, useEffect } from 'react'
import type { Slide } from '@/store/slides-store'
import { cn } from '@/lib/utils'
import { Wand2, Loader2, ImageIcon, AlertCircle, Download, Eye } from 'lucide-react'
import { downloadImage } from '@/lib/utils'

interface SlidePreviewProps {
  slide: Slide
  onProcess: () => void
}

type ViewMode = 'processed' | 'original' | 'preview'

// Original slide dimensions (16:9 at 1920x1080)
const ORIGINAL_WIDTH = 1920

export function SlidePreview({ slide, onProcess }: SlidePreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('processed')
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

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

  // Calculate scale factor for font size
  const scaleFactor = containerSize.width > 0 ? containerSize.width / ORIGINAL_WIDTH : 0.5

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
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-surface-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('processed')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all',
                viewMode === 'processed'
                  ? 'bg-white text-primary shadow-soft'
                  : 'text-dark-50 hover:text-dark'
              )}
            >
              純背景
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-1',
                viewMode === 'preview'
                  ? 'bg-white text-primary shadow-soft'
                  : 'text-dark-50 hover:text-dark'
              )}
            >
              <Eye className="w-3 h-3" />
              最終預覽
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all',
                viewMode === 'original'
                  ? 'bg-white text-primary shadow-soft'
                  : 'text-dark-50 hover:text-dark'
              )}
            >
              原圖
            </button>
          </div>

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
      )}

      {/* Image Preview */}
      <div ref={containerRef} className="relative aspect-video bg-dark-400 rounded-xl overflow-hidden">
        <img
          src={displayImage}
          alt={`Slide ${slide.pageNumber}`}
          className="w-full h-full object-contain"
        />

        {/* Text blocks overlay for preview mode */}
        {showTextOverlay && slide.textBlocks.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {slide.textBlocks.map((block) => {
              // Check if text contains line breaks (multi-line)
              const isMultiLine = block.text.includes('\n')
              // Calculate scaled font size based on container width
              const scaledFontSize = Math.max(8, Math.round(block.style.fontSize * scaleFactor))

              return (
                <div
                  key={block.id}
                  className="absolute"
                  style={{
                    left: `${block.box.x}%`,
                    top: `${block.box.y}%`,
                    maxWidth: `${Math.max(block.box.width, 50)}%`, // Use maxWidth, minimum 50%
                    fontSize: `${scaledFontSize}px`,
                    color: block.style.color,
                    fontWeight: block.style.bold ? 'bold' : 'normal',
                    textAlign: block.style.align,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                    lineHeight: 1.3,
                    whiteSpace: isMultiLine ? 'pre-wrap' : 'nowrap',
                  }}
                >
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

        {/* Watermark indicator (only on original) */}
        {(isPending || viewMode === 'original') && (
          <div className="absolute bottom-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-md">
            📍 NotebookLM 浮水印
          </div>
        )}

        {/* Preview mode badge */}
        {viewMode === 'preview' && (
          <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1">
            <Eye className="w-3 h-3" />
            最終預覽 (圖片+文字)
          </div>
        )}

        {/* Completed badge */}
        {isCompleted && viewMode === 'processed' && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1">
            <Wand2 className="w-3 h-3" />
            文字已清除
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ImageIcon className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                處理完成！
              </p>
              <p className="text-xs text-green-600 mt-1">
                背景已清理，文字已提取 ({slide.textBlocks.length} 個區塊)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
