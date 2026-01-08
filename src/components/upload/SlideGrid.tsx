import { useState, useCallback } from 'react'
import { useSlidesStore } from '@/store/slides-store'
import { cn } from '@/lib/utils'
import { Check, Minus, RefreshCw } from 'lucide-react'

export function SlideGrid() {
  const {
    slides,
    selectedSlideIds,
    toggleSlideSelection,
    selectAllSlides,
    deselectAllSlides,
    invertSelection,
  } = useSlidesStore()

  const [thumbnailSize, setThumbnailSize] = useState(200)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

  const handleSlideClick = useCallback((slideId: string, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
      // Shift+click for range selection
      const start = Math.min(lastClickedIndex, index)
      const end = Math.max(lastClickedIndex, index)
      const slidesInRange = slides.slice(start, end + 1)

      // Toggle all slides in range
      const allSelected = slidesInRange.every((s) => selectedSlideIds.has(s.id))
      slidesInRange.forEach((slide) => {
        if (allSelected) {
          if (selectedSlideIds.has(slide.id)) {
            toggleSlideSelection(slide.id)
          }
        } else {
          if (!selectedSlideIds.has(slide.id)) {
            toggleSlideSelection(slide.id)
          }
        }
      })
    } else {
      toggleSlideSelection(slideId)
    }
    setLastClickedIndex(index)
  }, [lastClickedIndex, slides, selectedSlideIds, toggleSlideSelection])

  const allSelected = slides.length > 0 && selectedSlideIds.size === slides.length
  const someSelected = selectedSlideIds.size > 0 && selectedSlideIds.size < slides.length

  return (
    <div className="card">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? deselectAllSlides : selectAllSlides}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              allSelected
                ? 'bg-primary text-dark-400 shadow-glow'
                : someSelected
                ? 'bg-primary/20 text-primary'
                : 'bg-surface-50 text-neutral-300 hover:bg-surface-100 hover:text-white'
            )}
          >
            {allSelected ? (
              <Check className="w-4 h-4" />
            ) : someSelected ? (
              <Minus className="w-4 h-4" />
            ) : null}
            {allSelected ? '取消全選' : '全選'}
          </button>

          <button
            onClick={invertSelection}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-surface-50 text-neutral-300 hover:bg-surface-100 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            反轉選擇
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-400 uppercase">縮圖大小</span>
          <input
            type="range"
            min={150}
            max={400}
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(Number(e.target.value))}
            className="w-32 h-2 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
        }}
      >
        {slides.map((slide, index) => {
          const isSelected = selectedSlideIds.has(slide.id)

          return (
            <div
              key={slide.id}
              onClick={(e) => handleSlideClick(slide.id, index, e)}
              className={cn(
                'group relative rounded-xl overflow-hidden cursor-pointer transition-all border-2',
                isSelected
                  ? 'border-primary shadow-glow ring-2 ring-primary/30'
                  : 'border-white/10 hover:border-primary/50 hover:shadow-soft'
              )}
            >
              {/* Image */}
              <div className="aspect-video bg-dark-400 relative overflow-hidden">
                <img
                  src={slide.originalImage}
                  alt={`Slide ${slide.pageNumber}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />

                {/* Selection indicator */}
                <div
                  className={cn(
                    'absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-primary text-dark-400 shadow-glow'
                      : 'bg-dark/60 text-white/50 opacity-0 group-hover:opacity-100'
                  )}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </div>

                {/* Watermark indicator */}
                <div className="absolute bottom-2 right-2 bg-dark/80 text-neutral-400 text-[10px] px-2 py-0.5 rounded-md font-medium border border-white/10">
                  浮水印
                </div>
              </div>

              {/* Page number */}
              <div className="bg-surface-50 px-3 py-2 text-center border-t border-white/5">
                <span className={cn(
                  'text-sm font-bold',
                  isSelected ? 'text-primary' : 'text-neutral-400'
                )}>
                  第 {slide.pageNumber} 頁
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-neutral-500 text-center mt-6">
        按住 Shift 點擊可以範圍選取
      </p>
    </div>
  )
}
