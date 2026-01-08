import { useCallback, useState, useRef } from 'react'
import { useSlidesStore } from '@/store/slides-store'
import { parsePdf } from '@/lib/pdf-parser'
import { cn } from '@/lib/utils'
import { Upload, FileText, Loader2, Sparkles } from 'lucide-react'

export function PdfDropzone() {
  const { setSlides, selectAllSlides } = useSlidesStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('請上傳 PDF 檔案')
      return
    }

    setIsLoading(true)
    setProgress({ current: 0, total: 0 })

    try {
      const slides = await parsePdf(file, {
        scale: 2.5,
        onProgress: (current, total) => {
          setProgress({ current, total })
        },
      })
      setSlides(slides)
      selectAllSlides() // Auto-select all by default
    } catch (error) {
      console.error('PDF parsing error:', error)
      alert('PDF 解析失敗，請確認檔案格式正確')
    } finally {
      setIsLoading(false)
    }
  }, [setSlides, selectAllSlides])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [handleFile])

  const handleClick = useCallback(() => {
    if (!isLoading) {
      fileInputRef.current?.click()
    }
  }, [isLoading])

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group',
        isDragging
          ? 'border-primary bg-primary/10 scale-[1.01] shadow-glow'
          : 'border-white/20 bg-surface-50/30 hover:border-primary/50 hover:bg-surface-50/50'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleInputChange}
        className="hidden"
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <Sparkles className="w-5 h-5 text-primary absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-white">
              正在解析 PDF...
            </p>
            {progress.total > 0 && (
              <>
                <p className="text-sm text-neutral-400">
                  處理中 {progress.current} / {progress.total} 頁
                </p>
                <div className="w-64 h-2 bg-dark-100 rounded-full overflow-hidden mx-auto">
                  <div
                    className="h-full bg-gradient-to-r from-primary-600 to-primary rounded-full transition-all shadow-glow"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            'w-16 h-16 rounded-xl flex items-center justify-center transition-all',
            isDragging
              ? 'bg-primary text-dark-400 scale-110 shadow-glow'
              : 'bg-primary/20 text-primary group-hover:scale-105 group-hover:bg-primary/30'
          )}>
            {isDragging ? (
              <FileText className="w-8 h-8" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xl font-bold text-white">
              {isDragging ? '放開以上傳' : '拖放 PDF 或點擊上傳'}
            </p>
            <p className="text-sm text-neutral-400">
              支援 NotebookLM 生成的圖文簡報 PDF
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
