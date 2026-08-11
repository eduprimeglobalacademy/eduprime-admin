import { useState } from 'react'
import { Shield } from 'lucide-react'
import { signIn } from '../lib/auth'
import { Button } from './ui/Button'

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email.trim(), password)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSignedIn()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="p-2 rounded-lg" style={{ background: 'var(--brand-primary)' }}>
            <Shield className="w-5 h-5" style={{ color: 'var(--brand-on-primary)' }} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ink">Platform Console</h1>
            <p className="text-xs text-ink-faint">EduPrime staff only</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stat-card space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="you@eduprime.app"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  )
}
