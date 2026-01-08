import { useState, useCallback } from 'react'
import { useSlidesStore, type ExportMode } from '@/store/slides-store'
import { generatePptx, getExportPreview } from '@/lib/pptx-generator'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  Download,
  Image,
  Type,
  Layers,
  FileOutput,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

export function ExportPanel() {
  const {
    slides,
    selectedSlideIds,
    exportMode,
    setExportMode,
    exportFilename,
    setExportFilename,
    setStep,
  } = useSlidesStore()

  const [layout, setLayout] = useState<'16:9' | '4:3' | '9:16'>('16:9')
  const [isExporting, setIsExporting] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)

  // Get selected and completed slides
  const selectedSlides = slides.filter(
    (s) => selectedSlideIds.has(s.id) && s.status === 'completed'
  )

  const preview = getExportPreview(selectedSlides, exportMode)

  const handleExport = useCallback(async () => {
    if (selectedSlides.length === 0) return

    setIsExporting(true)
    setExportComplete(false)

    try {
      await generatePptx(selectedSlides, {
        mode: exportMode,
        filename: exportFilename,
        layout,
      })
      setExportComplete(true)
    } catch (error) {
      console.error('Export error:', error)
      alert('匯出失敗，請稍後再試')
    } finally {
      setIsExporting(false)
    }
  }, [selectedSlides, exportMode, exportFilename, layout])

  const exportModes: { value: ExportMode; label: string; description: string; icon: typeof Image }[] = [
    {
      value: 'images',
      label: '純圖片',
      description: '只匯出已移除浮水印的圖片，每頁一張全版圖片',
      icon: Image,
    },
    {
      value: 'text',
      label: '純文字',
      description: '只匯出文字區塊，保留位置與樣式，可完全編輯',
      icon: Type,
    },
    {
      value: 'combined',
      label: '圖片 + 文字',
      description: '圖片作為背景，文字疊加在上方，兩者都可編輯',
      icon: Layers,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(2)}
            className="btn-ghost flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            返回編輯
          </button>
          <div className="w-px h-6 bg-white/20" />
          <h2 className="text-xl font-bold text-white">匯出簡報</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* Export Mode Selection */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">匯出格式</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {exportModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setExportMode(mode.value)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    exportMode === mode.value
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-glow'
                      : 'border-white/10 hover:border-primary/50 bg-surface-100/50'
                  )}
                >
                  <mode.icon
                    className={cn(
                      'w-8 h-8 mb-3',
                      exportMode === mode.value ? 'text-primary' : 'text-neutral-400'
                    )}
                  />
                  <p className={cn(
                    'font-bold',
                    exportMode === mode.value ? 'text-primary' : 'text-white'
                  )}>
                    {mode.label}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {mode.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Layout Selection */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">簡報比例</h3>
            <div className="flex gap-4">
              {[
                { value: '16:9', label: '16:9', desc: '寬螢幕 (推薦)' },
                { value: '4:3', label: '4:3', desc: '標準' },
                { value: '9:16', label: '9:16', desc: '直式' },
              ].map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLayout(l.value as '16:9' | '4:3' | '9:16')}
                  className={cn(
                    'flex-1 p-4 rounded-xl border-2 transition-all',
                    layout === l.value
                      ? 'border-primary bg-primary/10 shadow-glow'
                      : 'border-white/10 hover:border-primary/50 bg-surface-100/50'
                  )}
                >
                  <div
                    className={cn(
                      'mx-auto mb-2 border-2 rounded',
                      layout === l.value ? 'border-primary bg-primary/20' : 'border-white/20',
                      l.value === '16:9' && 'w-16 h-9',
                      l.value === '4:3' && 'w-12 h-9',
                      l.value === '9:16' && 'w-9 h-16'
                    )}
                  />
                  <p className={cn(
                    'font-bold text-center',
                    layout === l.value ? 'text-primary' : 'text-white'
                  )}>
                    {l.label}
                  </p>
                  <p className="text-xs text-neutral-400 text-center">{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Filename */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">檔案名稱</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                className="input flex-1"
                placeholder="輸入檔案名稱..."
              />
              <span className="text-neutral-400 font-medium">.pptx</span>
            </div>
          </div>
        </div>

        {/* Export Summary */}
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-surface-50 to-surface-100 border border-primary/30 rounded-xl p-6 text-white shadow-glow">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-primary">
              <FileOutput className="w-5 h-5" />
              匯出摘要
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-400">頁數</span>
                <span className="font-bold text-white">{preview.totalSlides} 頁</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">包含圖片</span>
                <span className="font-bold text-white">
                  {preview.hasImages ? '是' : '否'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">包含文字</span>
                <span className="font-bold text-white">
                  {preview.hasText ? '是' : '否'}
                </span>
              </div>
              {preview.hasText && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">文字區塊</span>
                  <span className="font-bold text-white">{preview.textBlockCount} 個</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-400">比例</span>
                <span className="font-bold text-white">{layout}</span>
              </div>
            </div>

            <hr className="my-4 border-white/10" />

            <button
              onClick={handleExport}
              disabled={isExporting || selectedSlides.length === 0}
              className={cn(
                'w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                isExporting
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : exportComplete
                  ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg'
                  : 'bg-primary text-dark-400 hover:bg-primary-300 shadow-glow'
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  匯出中...
                </>
              ) : exportComplete ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  匯出成功！
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  下載 PPTX
                </>
              )}
            </button>

            {selectedSlides.length === 0 && (
              <p className="text-xs text-neutral-500 text-center mt-3">
                沒有已處理完成的簡報可以匯出
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="card bg-primary/5 border border-primary/20">
            <h4 className="font-bold text-primary mb-2">小提示</h4>
            <ul className="text-sm text-neutral-300 space-y-1">
              <li>• 「圖片 + 文字」模式最適合需要編輯的場合</li>
              <li>• 「純圖片」模式保持最佳視覺效果</li>
              <li>• 匯出後可在 PowerPoint 中繼續編輯</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
