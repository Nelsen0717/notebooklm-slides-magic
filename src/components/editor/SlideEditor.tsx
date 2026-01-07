import { useState, useCallback } from 'react'
import { useSlidesStore } from '@/store/slides-store'
import { processSlide } from '@/lib/gemini-client'
import { cn, delay } from '@/lib/utils'
import { SlidePreview } from './SlidePreview'
import { TextBlockEditor } from './TextBlockEditor'
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react'

export function SlideEditor() {
  const {
    slides,
    selectedSlideIds,
    currentSlideIndex,
    setCurrentSlideIndex,
    updateSlide,
    setStep,
    isProcessing,
    setIsProcessing,
    processingProgress,
    setProcessingProgress,
  } = useSlidesStore()

  const [isPaused, setIsPaused] = useState(false)

  // Get selected slides
  const selectedSlides = slides.filter((s) => selectedSlideIds.has(s.id))
  const currentSlide = selectedSlides[currentSlideIndex]

  // Process a single slide
  const processOneSlide = useCallback(async (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId)
    if (!slide) return

    updateSlide(slideId, { status: 'processing' })

    try {
      const result = await processSlide(slide.originalImage)

      updateSlide(slideId, {
        cleanImage: result.cleanImage,
        textBlocks: result.textBlocks,
        status: 'completed',
      })
    } catch (error) {
      console.error('Processing error:', error)
      updateSlide(slideId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [slides, updateSlide])

  // Process all selected slides
  const processAllSlides = useCallback(async () => {
    setIsProcessing(true)
    setIsPaused(false)
    setProcessingProgress(0)

    const slidesToProcess = selectedSlides.filter((s) => s.status === 'pending')

    for (let i = 0; i < slidesToProcess.length; i++) {
      // Check if paused
      while (isPaused) {
        await delay(100)
      }

      const slide = slidesToProcess[i]
      await processOneSlide(slide.id)
      setProcessingProgress(((i + 1) / slidesToProcess.length) * 100)

      // Rate limiting: wait 4 seconds between requests
      if (i < slidesToProcess.length - 1) {
        await delay(4000)
      }
    }

    setIsProcessing(false)
  }, [selectedSlides, isPaused, processOneSlide, setIsProcessing, setProcessingProgress])

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  // Navigation
  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1)
    }
  }, [currentSlideIndex, setCurrentSlideIndex])

  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < selectedSlides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1)
    }
  }, [currentSlideIndex, selectedSlides.length, setCurrentSlideIndex])

  // Stats
  const completedCount = selectedSlides.filter((s) => s.status === 'completed').length
  const pendingCount = selectedSlides.filter((s) => s.status === 'pending').length
  const processingCount = selectedSlides.filter((s) => s.status === 'processing').length
  const errorCount = selectedSlides.filter((s) => s.status === 'error').length

  const canProceed = completedCount > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(1)}
            className="btn-ghost flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            返回選擇
          </button>
          <div className="w-px h-6 bg-surface-300" />
          <h2 className="text-xl font-bold text-dark">處理 & 編輯</h2>
        </div>

        <div className="flex items-center gap-3">
          {!isProcessing && pendingCount > 0 && (
            <button
              onClick={processAllSlides}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              批次處理 ({pendingCount})
            </button>
          )}

          {isProcessing && (
            <button
              onClick={togglePause}
              className="btn-secondary flex items-center gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  繼續
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  暫停
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setStep(3)}
            disabled={!canProceed}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            前往匯出
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Stats */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm">
                <span className="font-bold text-green-600">{completedCount}</span>
                <span className="text-dark-50"> 已完成</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-dark-50" />
              <span className="text-sm">
                <span className="font-bold text-dark">{pendingCount}</span>
                <span className="text-dark-50"> 待處理</span>
              </span>
            </div>
            {processingCount > 0 && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm">
                  <span className="font-bold text-primary">{processingCount}</span>
                  <span className="text-dark-50"> 處理中</span>
                </span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm">
                  <span className="font-bold text-red-600">{errorCount}</span>
                  <span className="text-dark-50"> 錯誤</span>
                </span>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3">
              <div className="w-48 h-2 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-dark-50">
                {Math.round(processingProgress)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      {currentSlide && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slide Preview */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-dark">
                第 {currentSlide.pageNumber} 頁
                <span className="text-dark-50 font-normal ml-2">
                  ({currentSlideIndex + 1} / {selectedSlides.length})
                </span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrevSlide}
                  disabled={currentSlideIndex === 0}
                  className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNextSlide}
                  disabled={currentSlideIndex === selectedSlides.length - 1}
                  className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <SlidePreview
              slide={currentSlide}
              onProcess={() => processOneSlide(currentSlide.id)}
            />
          </div>

          {/* Text Editor */}
          <div className="card">
            <h3 className="font-bold text-dark mb-4">文字區塊</h3>
            <TextBlockEditor slide={currentSlide} />
          </div>
        </div>
      )}

      {/* Slide Thumbnails */}
      <div className="card">
        <h3 className="font-bold text-dark mb-4">所有選取的簡報</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {selectedSlides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(index)}
              className={cn(
                'flex-shrink-0 w-32 rounded-xl overflow-hidden border-2 transition-all',
                currentSlideIndex === index
                  ? 'border-primary ring-2 ring-primary-200'
                  : 'border-surface-200 hover:border-primary-300'
              )}
            >
              <div className="aspect-video relative">
                <img
                  src={slide.cleanImage || slide.originalImage}
                  alt={`Slide ${slide.pageNumber}`}
                  className="w-full h-full object-contain bg-dark-400"
                />

                {/* Status indicator */}
                <div className={cn(
                  'absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center',
                  slide.status === 'completed' && 'bg-green-500',
                  slide.status === 'processing' && 'bg-primary',
                  slide.status === 'error' && 'bg-red-500',
                  slide.status === 'pending' && 'bg-surface-300'
                )}>
                  {slide.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-white" />}
                  {slide.status === 'processing' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                  {slide.status === 'error' && <AlertCircle className="w-3 h-3 text-white" />}
                </div>
              </div>
              <div className="bg-white px-2 py-1 text-center">
                <span className="text-xs font-semibold text-dark-50">
                  {slide.pageNumber}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
