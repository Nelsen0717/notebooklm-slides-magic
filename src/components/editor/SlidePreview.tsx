import { useState } from 'react'
import type { Slide } from '@/store/slides-store'
import { cn } from '@/lib/utils'
import { Wand2, Loader2, ImageIcon, AlertCircle, Download } from 'lucide-react'
import { downloadImage } from '@/lib/utils'

interface SlidePreviewProps {
  slide: Slide
  onProcess: () => void
}

export function SlidePreview({ slide, onProcess }: SlidePreviewProps) {
  const [showOriginal, setShowOriginal] = useState(false)

  const isProcessing = slide.status === 'processing'
  const isCompleted = slide.status === 'completed'
  const isError = slide.status === 'error'
  const isPending = slide.status === 'pending'

  const displayImage = showOriginal
    ? slide.originalImage
    : slide.cleanImage || slide.originalImage

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      {isCompleted && (
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-surface-100 p-1 rounded-xl">
            <button
              onClick={() => setShowOriginal(false)}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all',
                !showOriginal
                  ? 'bg-white text-primary shadow-soft'
                  : 'text-dark-50 hover:text-dark'
              )}
            >
              處理後
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-lg transition-all',
                showOriginal
                  ? 'bg-white text-primary shadow-soft'
                  : 'text-dark-50 hover:text-dark'
              )}
            >
              原圖
            </button>
          </div>

          {!showOriginal && slide.cleanImage && (
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
      <div className="relative aspect-video bg-dark-400 rounded-xl overflow-hidden">
        <img
          src={displayImage}
          alt={`Slide ${slide.pageNumber}`}
          className="w-full h-full object-contain"
        />

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
        {(isPending || showOriginal) && (
          <div className="absolute bottom-2 right-2 bg-dark/70 text-white text-xs px-2 py-1 rounded-md">
            📍 NotebookLM 浮水印
          </div>
        )}

        {/* Completed badge */}
        {isCompleted && !showOriginal && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-semibold flex items-center gap-1">
            <Wand2 className="w-3 h-3" />
            浮水印已移除
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
                浮水印已移除，文字已提取 ({slide.textBlocks.length} 個區塊)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
