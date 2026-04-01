import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Clock, Loader, Target } from 'lucide-react'
import AppShell from '../components/AppShell'
import { botsApi, type Bot } from '../api/bots'
import { arenasApi, type Arena } from '../api/arenas'
import { sessionsApi, type SessionSummary } from '../api/sessions'
import { useAuth } from '../context/AuthContext'

export default function BattlePage() {
  const { user, refreshUser } = useAuth()
  const [bots, setBots]             = useState<Bot[]>([])
  const [arenas, setArenas]         = useState<Arena[]>([])
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([])
  const [selectedBot, setSelectedBot]   = useState('')
  const [selectedArena, setSelectedArena] = useState('')
  const [deploying, setDeploying]   = useState(false)
  const [message, setMessage]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    const [botsRes, arenasRes, sessionsRes] = await Promise.all([
      botsApi.list().catch(() => ({ data: [] as Bot[] })),
      arenasApi.list().catch(() => ({ data: { arenas: [] as Arena[] } })),
      sessionsApi.list(0, 10).catch(() => ({ data: { items: [] as SessionSummary[] } })),
    ])
    const available = botsRes.data.filter(b => b.status === 'idle')
    setBots(available)
    setArenas(arenasRes.data.arenas)
    setActiveSessions(sessionsRes.data.items.filter(s => s.status === 'queued' || s.status === 'playing'))
    if (available.length > 0 && !selectedBot) setSelectedBot(available[0].id)
    if (arenasRes.data.arenas.length > 0 && !selectedArena) setSelectedArena(arenasRes.data.arenas[0].id)
  }

  useEffect(() => { load() }, [])

  const handleDeploy = async () => {
    if (!selectedBot || !selectedArena) return
    setDeploying(true)
    setMessage(null)
    try {
      await arenasApi.queue(selectedArena, selectedBot)
      await refreshUser()
      await load()
      setMessage({ type: 'success', text: 'Unit deployed! Waiting for opponent match...' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: msg ?? 'Deployment failed' })
    } finally {
      setDeploying(false)
    }
  }

  const arena = arenas.find(a => a.id === selectedArena)
  const bot   = bots.find(b => b.id === selectedBot)
  const canAfford = arena ? (user?.balance ?? 0) >= arena.buy_in : false

  return (
    <AppShell>
      <div style={{ maxWidth: 840 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Combat Operations</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Battle Setup
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Deploy your bot and enter the arena queue
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>

          {/* Setup panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Bot selector */}
            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>Primary Unit</div>
              {bots.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  No idle bots.{' '}
                  <Link to="/bots" style={{ color: 'var(--primary)' }}>Create or free a bot</Link>
                </div>
              ) : (
                <select value={selectedBot} onChange={e => setSelectedBot(e.target.value)} className="input-field">
                  {bots.map(b => (
                    <option key={b.id} value={b.id}>{b.name} · ELO {b.elo}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Arena selector */}
            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>Battleground</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {arenas.map(a => (
                  <button key={a.id} onClick={() => setSelectedArena(a.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 3, border: 'none', cursor: 'pointer',
                      background: selectedArena === a.id ? 'rgba(124,127,255,0.1)' : 'var(--surface-container)',
                      borderLeft: `2px solid ${selectedArena === a.id ? 'var(--primary-container)' : 'transparent'}`,
                      transition: 'all 0.12s',
                    }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface)', fontWeight: selectedArena === a.id ? 600 : 400 }}>
                      {a.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                      ♟ {a.buy_in.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Risk summary + deploy */}
            {arena && bot && (
              <div className="card animate-fade-in">
                <div className="label" style={{ marginBottom: 14 }}>Risk Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 16 }}>
                  {[
                    { label: 'Entry Cost', value: `♟ ${arena.buy_in.toLocaleString()}`,                                       color: canAfford ? 'var(--on-surface)' : 'var(--tertiary)' },
                    { label: 'Max Reward', value: `♟ ${Math.round(arena.buy_in * 2 * arena.reward_multiplier).toLocaleString()}`, color: 'var(--secondary)' },
                    { label: 'Bot ELO',    value: bot.elo,                                                                     color: 'var(--primary)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: 'var(--surface-container)', padding: '12px 10px', textAlign: 'center' }}>
                      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {message && (
                  <div style={{
                    marginBottom: 14, padding: '8px 12px', borderRadius: 3,
                    background: message.type === 'success' ? 'rgba(63,255,160,0.08)' : 'rgba(255,107,107,0.08)',
                    fontFamily: 'var(--font-display)', fontSize: 12,
                    color: message.type === 'success' ? 'var(--secondary)' : 'var(--tertiary)',
                  }}>
                    {message.text}
                  </div>
                )}

                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  onClick={handleDeploy}
                  disabled={deploying || (!canAfford && arena.buy_in > 0) || bots.length === 0}>
                  <Zap size={14} />
                  {deploying ? 'Deploying...' : 'Confirm & Deploy'}
                </button>
              </div>
            )}
          </div>

          {/* Active deployments */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="label" style={{ marginBottom: 16 }}>Active Deployments</div>

            {activeSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 4, margin: '0 auto 12px',
                  background: 'var(--surface-container)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Target size={20} style={{ color: 'var(--on-surface-variant)' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  No active deployments
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeSessions.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 3,
                    background: s.status === 'playing' ? 'rgba(124,127,255,0.06)' : 'var(--surface-container)',
                    borderLeft: `2px solid ${s.status === 'playing' ? 'var(--primary-container)' : 'var(--outline)'}`,
                  }}>
                    {s.status === 'queued' ? (
                      <Clock size={15} style={{ color: 'var(--on-surface-variant)', flexShrink: 0 }} />
                    ) : (
                      <Loader size={15} className="animate-spin" style={{ color: 'var(--primary-container)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.arena_name ?? 'Unknown Arena'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                        {s.status === 'queued' ? 'WAITING FOR MATCH' : `PLAYING · ${s.hands_played} HANDS`}
                      </div>
                    </div>
                    <span className={`badge ${s.status === 'playing' ? 'badge-indigo' : 'badge-grey'}`}>
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--outline-variant)' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
                MATCHES EVERY ~30 SECONDS · SESSIONS RUN AUTOMATICALLY
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
