import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { Zap, Activity } from 'lucide-react'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [isSignup, setIsSignup] = useState(searchParams.get('signup') === '1')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = isSignup ? authApi.register : authApi.login
      const { data } = await fn({ email, password })
      await login(data.access_token, data.refresh_token)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? (isSignup ? 'Registration failed.' : 'Invalid credentials.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100svh', display: 'flex',
      background: 'var(--surface-base)',
      backgroundImage: 'var(--grid-pattern)', backgroundSize: 'var(--grid-size)',
    }}>

      {/* ── Left: Form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '360px' }} className="animate-fade-in">

          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '4px',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(124,127,255,0.4)',
            }}>
              <Activity size={14} color="#fff" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--on-surface)' }}>
              CyberStrat
            </span>
          </Link>

          <div className="label" style={{ marginBottom: '12px' }}>
            {isSignup ? 'New Operator' : 'Auth Protocol'}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '26px',
            letterSpacing: '-0.03em', color: 'var(--on-surface)', marginBottom: '6px',
          }}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--on-surface-2)', marginBottom: '28px' }}>
            {isSignup ? 'Deploy your first bot in minutes.' : 'Access the command center.'}
          </p>

          {error && (
            <div style={{
              marginBottom: '20px', padding: '10px 14px', borderRadius: '3px',
              background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)',
              fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tertiary)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{
                display: 'block', marginBottom: '6px',
                fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--on-surface-variant)',
              }}>
                Operator ID
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="you@domain.com" required autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', marginBottom: '6px',
                fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--on-surface-variant)',
              }}>
                Encryption Key
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="••••••••" required minLength={6}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}
              style={{ width: '100%', padding: '11px', fontSize: '14px', justifyContent: 'center' }}>
              <Zap size={14} />
              {loading ? 'Connecting...' : isSignup ? 'Initialize Uplink' : 'Access System'}
            </button>
          </form>

          <p style={{
            marginTop: '20px', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--on-surface-variant)',
          }}>
            {isSignup ? 'Have an account? ' : 'No account? '}
            <button onClick={() => { setIsSignup(!isSignup); setError('') }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
            }}>
              {isSignup ? 'Sign In' : 'Register'}
            </button>
          </p>

          {/* Demo hint */}
          <div style={{
            marginTop: '28px', padding: '12px 14px', borderRadius: '3px',
            background: 'var(--surface-container)', border: '1px solid var(--outline)',
          }}>
            <div className="label" style={{ marginBottom: '6px' }}>Demo Access</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-2)' }}>
              demo@botarena.com<br />
              <span style={{ color: 'var(--on-surface-variant)' }}>demo1234</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Visual panel ── */}
      <div style={{
        width: '420px', flexShrink: 0,
        background: 'var(--surface-low)',
        borderLeft: '1px solid var(--outline)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--primary-container), transparent)',
        }} />

        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(124,127,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="label" style={{ marginBottom: '24px' }}>Platform Status</div>

        {[
          { label: 'Active Arenas',   value: '4',      unit: 'live' },
          { label: 'Bot Presets',     value: '5',      unit: 'configs' },
          { label: 'Starting Chips',  value: '5,000',  unit: '♟ free' },
          { label: 'Config Params',   value: '17',     unit: 'per bot' },
        ].map(({ label, value, unit }) => (
          <div key={label} style={{
            padding: '16px 0',
            borderBottom: '1px solid var(--outline-variant)',
          }}>
            <div className="label" style={{ marginBottom: '6px', color: 'var(--on-surface-variant)' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '24px', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                {value}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
                {unit}
              </span>
            </div>
          </div>
        ))}

        <p style={{
          marginTop: '28px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--on-surface-variant)', lineHeight: 1.6,
        }}>
          Build configurable bots, compete in ELO-matched arenas, and analyze your strategic edge — all with fictional stakes.
        </p>
      </div>
    </div>
  )
}
