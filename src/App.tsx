import { useEffect, useState } from 'react'
import { useSlidesStore } from '@/store/slides-store'
import { PdfDropzone } from '@/components/upload/PdfDropzone'
import { SlideGrid } from '@/components/upload/SlideGrid'
import { SlideEditor } from '@/components/editor/SlideEditor'
import { ExportPanel } from '@/components/export/ExportPanel'
import { LoginPage } from '@/components/auth/LoginPage'
import { cn } from '@/lib/utils'
import { FileText, Wand2, Download, ChevronRight, Sparkles, LogOut, Loader2 } from 'lucide-react'

function App() {
  const { step, slides, selectedSlideIds, setStep, reset, isAuthenticated, authToken, logout, setAuthToken } = useSlidesStore()
  const [isVerifying, setIsVerifying] = useState(true)

  // 驗證 token 是否有效
  useEffect(() => {
    async function verifyToken() {
      if (!authToken) {
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', token: authToken }),
        })
        const data = await response.json()
        if (!data.success) {
          // Token 無效，清除
          setAuthToken(null)
        }
      } catch (error) {
        console.error('Token verification error:', error)
      } finally {
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [authToken, setAuthToken])

  // 顯示載入中
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">驗證中...</p>
        </div>
      </div>
    )
  }

  // 未登入顯示登入頁
  if (!isAuthenticated) {
    return <LoginPage />
  }

  const steps = [
    { number: 1, label: '上傳 PDF', icon: FileText },
    { number: 2, label: '處理 & 編輯', icon: Wand2 },
    { number: 3, label: '匯出', icon: Download },
  ] as const

  const canProceedToStep2 = slides.length > 0 && selectedSlideIds.size > 0
  const canProceedToStep3 = slides.some((s) => s.status === 'completed')

  return (
    <div className="min-h-screen bg-dark relative">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Header */}
      <header className="bg-dark-300/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-600 rounded-lg flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-dark-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                簡報<span className="text-gradient">魔法師</span>
              </h1>
              <p className="text-xs text-neutral-400">NotebookLM PDF → 可編輯 PPT</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {slides.length > 0 && (
              <button
                onClick={reset}
                className="btn-ghost text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                重新開始
              </button>
            )}
            <button
              onClick={logout}
              className="btn-ghost text-sm text-neutral-400 hover:text-white flex items-center gap-1"
              title="登出"
            >
              <LogOut className="w-4 h-4" />
              登出
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-dark-200/50 backdrop-blur-sm border-b border-white/5">
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
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    step === s.number
                      ? 'bg-primary text-dark-400 shadow-glow font-bold'
                      : step > s.number
                      ? 'bg-primary/20 text-primary border border-primary/30 cursor-pointer hover:bg-primary/30'
                      : 'bg-dark-100 text-neutral-500 border border-white/5 cursor-not-allowed'
                  )}
                >
                  <s.icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{s.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-neutral-600 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {step === 1 && (
          <div className="space-y-8">
            {/* Step 1: Upload */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-primary text-dark-400 rounded-lg flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h2 className="text-xl font-bold text-white">上傳 NotebookLM 簡報</h2>
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
                    <span className="text-sm text-neutral-400">
                      已選擇 <span className="font-bold text-primary">{selectedSlideIds.size}</span> 頁
                    </span>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
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
      <footer className="border-t border-white/5 bg-dark-300/50 mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-neutral-500">
            © 2026 <span className="text-primary">FUNRAISE</span> 方睿科技 | Powered by Gemini AI
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
