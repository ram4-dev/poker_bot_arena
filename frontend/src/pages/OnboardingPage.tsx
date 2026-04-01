import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronRight, Activity } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'

const PRESETS = [
  { key: 'aggressive',   label: 'The Aggressor',   desc: 'High pressure, constant raises. Rewards: great bluffs. Risk: overplays hands.' },
  { key: 'conservative', label: 'The Guardian',    desc: 'Tight, disciplined play. Only commits when the odds are right.' },
  { key: 'balanced',     label: 'The Operator',    desc: 'Adaptive strategy. Reads the table and adjusts accordingly.' },
  { key: 'bluffer',      label: 'The Phantom',     desc: 'Deception specialist. Wins by psychological pressure, not hand strength.' },
  { key: 'opportunist',  label: 'The Opportunist', desc: 'Exploits weaknesses. Shifts strategy based on opponent patterns.' },
]

export default function OnboardingPage() {
  const [step, setStep]       = useState(1)
  const [username, setUsername] = useState('')
  const [preset, setPreset]   = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const { refreshUser } = useAuth()
  const navigate = useNavigate()

  const handleFinish = async () => {
    if (!username.trim()) return setError('Username required')
    setLoading(true)
    setError('')
    try {
      await authApi.completeOnboarding({ username: username.trim(), preset_key: preset })
      await refreshUser()
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to complete setup')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-base)',
      backgroundImage: 'var(--grid-pattern)', backgroundSize: 'var(--grid-size)',
      padding: '40px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }} className="animate-fade-in">

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--glow-primary)',
          }}>
            <Activity size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--on-surface)' }}>
            CyberStrat
          </span>
        </div>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              height: 2, flex: 1, borderRadius: 1, transition: 'background 0.3s',
              background: s <= step ? 'var(--primary-container)' : 'var(--surface-highest)',
              boxShadow: s <= step ? '0 0 8px var(--primary-container)' : 'none',
            }} />
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="label" style={{ marginBottom: 12 }}>Step 01 / 02</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Identify Yourself
            </h1>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--on-surface-variant)', marginBottom: 28, lineHeight: 1.6 }}>
              Choose your operator codename. This is your identity in the arena.
            </p>

            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="input-field" placeholder="operator_codename" autoFocus
              style={{ fontSize: 17, marginBottom: error ? 12 : 20 }}
              onKeyDown={e => e.key === 'Enter' && username.trim() && (setError(''), setStep(2))}
            />

            {error && (
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--tertiary)', marginBottom: 16 }}>{error}</p>
            )}

            <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14, justifyContent: 'center' }}
              onClick={() => { if (username.trim()) { setError(''); setStep(2) } else setError('Enter a username') }}>
              Confirm Identity <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="label" style={{ marginBottom: 12 }}>Step 02 / 02</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Initialize Your Core
            </h1>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--on-surface-variant)', marginBottom: 24, lineHeight: 1.6 }}>
              Select a starting preset for your first bot. You can customize every parameter later.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => setPreset(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', textAlign: 'left', padding: '14px 16px',
                    borderRadius: 4, cursor: 'pointer',
                    background: preset === p.key ? 'rgba(124,127,255,0.1)' : 'var(--surface-low)',
                    border: `1px solid ${preset === p.key ? 'var(--primary-container)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.15s',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: preset === p.key ? 'rgba(124,127,255,0.2)' : 'var(--surface-highest)',
                  }}>
                    <Bot size={16} style={{ color: preset === p.key ? 'var(--primary)' : 'var(--on-surface-variant)' }} />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>
                      {p.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2, lineHeight: 1.5 }}>
                      {p.desc}
                    </div>
                  </div>
                  {preset === p.key && (
                    <div style={{
                      marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--primary-container)', boxShadow: '0 0 8px var(--primary-container)',
                    }} />
                  )}
                </button>
              ))}
            </div>

            {error && (
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--tertiary)', marginBottom: 16 }}>{error}</p>
            )}

            <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14, justifyContent: 'center' }}
              onClick={handleFinish} disabled={loading}>
              {loading ? 'Deploying...' : 'Launch Command Center'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
