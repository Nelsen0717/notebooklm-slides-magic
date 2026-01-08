import { useState, useCallback } from 'react'
import { useSlidesStore } from '@/store/slides-store'
import { Sparkles, Mail, Lock, Loader2, AlertCircle } from 'lucide-react'

export function LoginPage() {
  const { setAuthToken } = useSlidesStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email,
          password,
        }),
      })

      const data = await response.json()

      if (data.success && data.token) {
        // 儲存 token 到 localStorage 和 store
        localStorage.setItem('auth_token', data.token)
        setAuthToken(data.token)
      } else {
        setError(data.error || '登入失敗')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('網路錯誤，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }, [email, password, setAuthToken])

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-500 via-dark-400 to-dark-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            簡報<span className="text-primary">魔法師</span>
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            NotebookLM PDF → 可編輯 PPT
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-surface-100 rounded-2xl p-6 shadow-xl border border-white/10">
          <h2 className="text-lg font-bold text-white mb-6 text-center">
            登入使用
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase mb-2 block">
                電子郵件
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                  className="input pl-11 w-full"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-neutral-400 uppercase mb-2 block">
                密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input pl-11 w-full"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                登入中...
              </>
            ) : (
              '登入'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-neutral-500 text-xs mt-6">
          © 2026 <a href="https://www.funraise.com.tw" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">FUNRAISE</a> 方睿科技
        </p>
      </div>
    </div>
  )
}
