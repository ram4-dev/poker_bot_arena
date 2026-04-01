import { useEffect, useState } from 'react'
import { Swords, Shield, Zap, AlertTriangle, Target } from 'lucide-react'
import AppShell from '../components/AppShell'
import { arenasApi, type Arena } from '../api/arenas'
import { botsApi, type Bot } from '../api/bots'
import { useAuth } from '../context/AuthContext'

const ARENA_ICONS = [Zap, Target, Swords]

function getRisk(arena: Arena): 'low' | 'medium' | 'high' {
  if (arena.buy_in === 0)    return 'low'
  if (arena.buy_in <= 200)   return 'low'
  if (arena.buy_in <= 1000)  return 'medium'
  return 'high'
}

const RISK_STYLE: Record<string, { cls: string; color: string; bg: string }> = {
  low:    { cls: 'badge-mint',    color: 'var(--secondary)',  bg: 'rgba(63,255,160,0.08)' },
  medium: { cls: 'badge-indigo',  color: 'var(--primary)',    bg: 'rgba(124,127,255,0.08)' },
  high:   { cls: 'badge-crimson', color: 'var(--tertiary)',   bg: 'rgba(255,107,107,0.08)' },
}

export default function ArenasPage() {
  const { user, refreshUser } = useAuth()
  const [arenas, setArenas]         = useState<Arena[]>([])
  const [bots, setBots]             = useState<Bot[]>([])
  const [selectedArena, setSelectedArena] = useState<Arena | null>(null)
  const [selectedBot, setSelectedBot]     = useState<string>('')
  const [queueing, setQueueing]     = useState(false)
  const [message, setMessage]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    arenasApi.list().then(r => setArenas(r.data.arenas)).catch(() => {})
    botsApi.list().then(r => {
      const available = r.data.filter(b => b.status === 'idle')
      setBots(available)
      if (available.length > 0) setSelectedBot(available[0].id)
    }).catch(() => {})
  }, [])

  const handleQueue = async () => {
    if (!selectedArena || !selectedBot) return
    setQueueing(true)
    setMessage(null)
    try {
      await arenasApi.queue(selectedArena.id, selectedBot)
      await refreshUser()
      const updatedBots = await botsApi.list()
      const available = updatedBots.data.filter(b => b.status === 'idle')
      setBots(available)
      setSelectedBot(available[0]?.id ?? '')
      setMessage({ type: 'success', text: `Bot deployed to ${selectedArena.name}. Waiting for match...` })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: msg ?? 'Failed to queue bot' })
    } finally {
      setQueueing(false)
    }
  }

  const canAfford = selectedArena ? (user?.balance ?? 0) >= selectedArena.buy_in : false
  const mainArenas = arenas.filter(a => !a.is_practice)
  const practiceArenas = arenas.filter(a => a.is_practice)

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Battlegrounds</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Select Arena
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Higher stakes — greater rewards.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            marginBottom: 20, padding: '10px 14px', borderRadius: 3,
            background: message.type === 'success' ? 'rgba(63,255,160,0.08)' : 'rgba(255,107,107,0.08)',
            border: `1px solid ${message.type === 'success' ? 'rgba(63,255,160,0.2)' : 'rgba(255,107,107,0.2)'}`,
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: message.type === 'success' ? 'var(--secondary)' : 'var(--tertiary)',
          }}>
            {message.text}
          </div>
        )}

        {/* Arena grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 12 }}>
          {mainArenas.map((arena, idx) => {
            const Icon = ARENA_ICONS[idx] ?? Swords
            const risk = getRisk(arena)
            const rs = RISK_STYLE[risk]
            const selected = selectedArena?.id === arena.id

            return (
              <button key={arena.id} onClick={() => setSelectedArena(arena)}
                style={{
                  background: selected ? 'rgba(124,127,255,0.08)' : 'var(--surface-low)',
                  padding: 20, textAlign: 'left', cursor: 'pointer', border: 'none',
                  borderBottom: selected ? '2px solid var(--primary-container)' : '2px solid transparent',
                  transition: 'all 0.15s', position: 'relative',
                }}>

                {/* Top glow on selected */}
                {selected && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
                    background: 'linear-gradient(90deg, transparent, var(--primary-container), transparent)',
                  }} />
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 4,
                    background: selected ? 'rgba(124,127,255,0.2)' : 'var(--surface-container)',
                    border: `1px solid ${selected ? 'rgba(124,127,255,0.3)' : 'var(--outline)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} style={{ color: selected ? 'var(--primary)' : 'var(--on-surface-variant)' }} />
                  </div>
                  <span className={`badge ${rs.cls}`}>{risk.toUpperCase()}</span>
                </div>

                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--on-surface)', marginBottom: 4 }}>
                  {arena.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
                  BLINDS {arena.small_blind}/{arena.big_blind}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Buy-in',        value: `♟ ${arena.buy_in.toLocaleString()}`, color: 'var(--on-surface)' },
                    { label: 'Active Tables', value: arena.stats.active_tables,              color: 'var(--on-surface)' },
                    { label: 'In Queue',      value: arena.stats.bots_in_queue,              color: 'var(--on-surface)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {/* Practice arenas */}
        {practiceArenas.map(arena => (
          <button key={arena.id}
            onClick={() => setSelectedArena(arena)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', textAlign: 'left', padding: '16px 20px',
              background: selectedArena?.id === arena.id ? 'rgba(63,255,160,0.05)' : 'var(--surface-low)',
              border: `1px solid ${selectedArena?.id === arena.id ? 'rgba(63,255,160,0.3)' : 'var(--outline)'}`,
              borderRadius: 4, cursor: 'pointer', marginBottom: 12, transition: 'all 0.15s',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Shield size={20} style={{ color: 'var(--secondary)' }} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>
                  {arena.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 3 }}>
                  FREE TO ENTER · REDUCED REWARDS (×{arena.reward_multiplier}) · SAFE ENVIRONMENT
                </div>
              </div>
            </div>
            <span className="badge badge-mint">FREE</span>
          </button>
        ))}

        {/* Deploy panel */}
        {selectedArena && (
          <div className="card animate-fade-in">
            <div className="label" style={{ marginBottom: 16 }}>
              Deploy Unit — {selectedArena.name}
            </div>

            {bots.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                No idle bots available. All your bots may be queued or in battle.
              </p>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Select Unit</div>
                  <select value={selectedBot} onChange={e => setSelectedBot(e.target.value)} className="input-field">
                    {bots.map(b => (
                      <option key={b.id} value={b.id}>{b.name} (ELO {b.elo})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 16 }}>
                  {[
                    { label: 'Entry Cost',    value: `♟ ${selectedArena.buy_in.toLocaleString()}`,                                                         color: canAfford ? 'var(--on-surface)' : 'var(--tertiary)' },
                    { label: 'Your Balance',  value: `♟ ${(user?.balance ?? 0).toLocaleString()}`,                                                          color: canAfford ? 'var(--secondary)' : 'var(--tertiary)' },
                    { label: 'Max Return',    value: `♟ ${Math.round(selectedArena.buy_in * 2 * selectedArena.reward_multiplier).toLocaleString()}`,         color: 'var(--primary)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--surface-container)', padding: '14px 16px', textAlign: 'center' }}>
                      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {!canAfford && selectedArena.buy_in > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                    fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--tertiary)',
                  }}>
                    <AlertTriangle size={14} /> Insufficient balance for this arena.
                  </div>
                )}

                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  onClick={handleQueue}
                  disabled={queueing || (!canAfford && selectedArena.buy_in > 0)}>
                  <Swords size={14} />
                  {queueing ? 'Deploying...' : 'Confirm & Deploy'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
