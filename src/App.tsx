import { useSlidesStore } from '@/store/slides-store'
import { PdfDropzone } from '@/components/upload/PdfDropzone'
import { SlideGrid } from '@/components/upload/SlideGrid'
import { SlideEditor } from '@/components/editor/SlideEditor'
import { ExportPanel } from '@/components/export/ExportPanel'
import { cn } from '@/lib/utils'
import { FileText, Wand2, Download, ChevronRight } from 'lucide-react'

function App() {
  const { step, slides, selectedSlideIds, setStep, reset } = useSlidesStore()

  const steps = [
    { number: 1, label: '上傳 PDF', icon: FileText },
    { number: 2, label: '處理 & 編輯', icon: Wand2 },
    { number: 3, label: '匯出', icon: Download },
  ] as const

  const canProceedToStep2 = slides.length > 0 && selectedSlideIds.size > 0
  const canProceedToStep3 = slides.some((s) => s.status === 'completed')

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-dark">方睿簡報魔法師</h1>
              <p className="text-xs text-dark-50">NotebookLM PDF → 可編輯 PPT</p>
            </div>
          </div>

          {slides.length > 0 && (
            <button
              onClick={reset}
              className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              重新開始
            </button>
          )}
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center">
                <button
                  onClick={() => {
                    if (s.number === 1) setStep(1)
                    else if (s.number === 2 && canProceedToStep2) setStep(2)
                    else if (s.number === 3 && canProceedToStep3) setStep(3)
                  }}
                  disabled={
                    (s.number === 2 && !canProceedToStep2) ||
                    (s.number === 3 && !canProceedToStep3)
                  }
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                    step === s.number
                      ? 'bg-primary text-white shadow-soft'
                      : step > s.number
                      ? 'bg-primary-50 text-primary cursor-pointer hover:bg-primary-100'
                      : 'bg-surface-200 text-dark-50 cursor-not-allowed'
                  )}
                >
                  <s.icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{s.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-surface-300 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {step === 1 && (
          <div className="space-y-8">
            {/* Step 1: Upload */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-dark text-white rounded-lg flex items-center justify-center font-bold">
                  1
                </div>
                <h2 className="text-xl font-bold text-dark">上傳 NotebookLM 簡報</h2>
              </div>
              <PdfDropzone />
            </section>

            {/* Slide Selection */}
            {slides.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="badge-dark">
                      {slides.length} 頁
                    </div>
                    <span className="text-sm text-dark-50">
                      已選擇 <span className="font-bold text-primary">{selectedSlideIds.size}</span> 頁
                    </span>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    開始處理
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <SlideGrid />
              </section>
            )}
          </div>
        )}

        {step === 2 && <SlideEditor />}

        {step === 3 && <ExportPanel />}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-dark-50">
            © 2026 FUNRAISE 方睿科技 | Powered by Gemini AI
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
