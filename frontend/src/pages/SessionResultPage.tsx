import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line } from 'recharts'
import { Trophy, AlertTriangle, ChevronLeft, Bot, Swords, ChevronDown, ChevronUp } from 'lucide-react'
import AppShell from '../components/AppShell'
import { sessionsApi } from '../api/sessions'
import type { SessionDetail, Hand } from '../api/sessions'
import { parseCard } from '../utils/cards'

// ─── Mini card ────────────────────────────────────────────────────────────────
function MiniCard({ code }: { code: string }) {
  const { rank, symbol: sym, color } = parseCard(code)
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      width: '26px', height: '36px', borderRadius: '3px',
      background: '#1e1e2a', border: '1px solid rgba(255,255,255,0.12)',
      fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 800,
      color, gap: '1px', justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    }}>
      <span style={{ lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: '9px', lineHeight: 1 }}>{sym}</span>
    </span>
  )
}

// ─── Hand log row ─────────────────────────────────────────────────────────────
function HandLogRow({ hand, botName, oppName, sessionId }: {
  hand: Hand
  botName: string
  oppName: string | null
  sessionId: string
}) {
  const [open, setOpen] = useState(false)
  const myEvents = hand.events.filter(e => e.player_seat === 1)
  const lastMyEvent = myEvents[myEvents.length - 1]
  const won = hand.winner_session_id === sessionId
  const profit = won ? hand.pot : -Math.abs(hand.events.filter(e => e.player_seat === 1).reduce((s, e) => s + e.amount, 0))

  const ACTION_COLOR: Record<string, string> = {
    fold: '#e05c5c', call: 'var(--primary)', raise: '#ffb74d', check: 'var(--secondary)',
  }

  return (
    <div style={{ borderBottom: '1px solid var(--outline)' }}>
      {/* Summary row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 14px', cursor: 'pointer',
          background: open ? 'rgba(124,127,255,0.06)' : 'transparent',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--on-surface-variant)', minWidth: '28px' }}>
          #{hand.hand_number}
        </span>
        {/* My hole cards */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {hand.player_1_hole.map((c, i) => <MiniCard key={i} code={c} />)}
        </div>
        {/* Community cards */}
        {hand.community_cards.length > 0 && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)' }}>|</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {hand.community_cards.map((c, i) => <MiniCard key={i} code={c} />)}
            </div>
          </>
        )}
        {/* Last action */}
        {lastMyEvent && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            color: ACTION_COLOR[lastMyEvent.action] ?? 'var(--on-surface-variant)',
            marginLeft: '4px',
          }}>
            {lastMyEvent.action}
          </span>
        )}
        {/* Hand rank */}
        {hand.winning_hand_rank && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)' }}>
            {hand.winning_hand_rank}
          </span>
        )}
        {/* Result */}
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          color: won ? 'var(--secondary)' : '#e05c5c',
        }}>
          {won ? `+${hand.pot}` : `${profit}`}
        </span>
        {open ? <ChevronUp size={11} color="var(--on-surface-variant)" /> : <ChevronDown size={11} color="var(--on-surface-variant)" />}
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ padding: '8px 14px 12px', background: 'rgba(0,0,0,0.15)' }}>
          {/* Both players' hole cards side by side */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                {botName}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {hand.player_1_hole.map((c, i) => <MiniCard key={i} code={c} />)}
              </div>
            </div>
            {hand.player_2_hole.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                  {oppName ?? 'Opponent'}
                </span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {hand.player_2_hole.map((c, i) => <MiniCard key={i} code={c} />)}
                </div>
              </div>
            )}
            {hand.community_cards.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Board</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {hand.community_cards.map((c, i) => <MiniCard key={i} code={c} />)}
                </div>
              </div>
            )}
          </div>

          {/* Event log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {hand.events.map((ev, idx) => {
              const isMine = ev.player_seat === 1
              const strength = ev.hand_strength
              return (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '3px 0',
                  opacity: isMine ? 1 : 0.55,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', minWidth: '38px', textTransform: 'uppercase' }}>
                    {ev.street}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '11px', color: isMine ? 'var(--on-surface)' : 'var(--on-surface-variant)', minWidth: '80px' }}>
                    {isMine ? botName : (oppName ?? 'Opp')}
                  </span>
                  {ev.hole_cards.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {ev.hole_cards.map((c, i) => {
                        const { rank, symbol, color } = parseCard(c)
                        return (
                          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color }}>
                            {rank}{symbol}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    color: ACTION_COLOR[ev.action] ?? 'var(--on-surface-variant)',
                  }}>
                    {ev.action}
                  </span>
                  {ev.amount > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ffb74d' }}>♟{ev.amount}</span>
                  )}
                  {strength !== null && strength !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <div style={{ width: '28px', height: '3px', background: 'var(--outline)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.round(strength * 100)}%`, height: '100%', borderRadius: '2px',
                          background: strength > 0.6 ? 'var(--secondary)' : strength > 0.35 ? '#ffb74d' : '#e05c5c',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)' }}>
                        {Math.round(strength * 100)}%
                      </span>
                    </div>
                  )}
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)' }}>
                    pot {ev.pot_after}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SessionResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHandLog, setShowHandLog] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    sessionsApi.get(sessionId)
      .then(r => setSession(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return (
    <AppShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-container)', animation: 'glowPulse 1.5s infinite' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>LOADING SESSION DATA...</span>
      </div>
    </AppShell>
  )

  if (!session) return (
    <AppShell>
      <div style={{ padding: 40, fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--tertiary)' }}>Session not found.</div>
    </AppShell>
  )

  const isWin = session.outcome === 'victory' || (session.kpis?.profit ?? 0) > 0

  const kpis = [
    { label: 'Net Profit',   value: session.kpis ? `${session.kpis.profit >= 0 ? '+' : ''}${session.kpis.profit}` : '—', color: (session.kpis?.profit ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' },
    { label: 'Hands Played', value: session.kpis?.hands_played ?? 0,                                                       color: 'var(--primary)' },
    { label: 'Win Rate',     value: session.kpis ? `${Math.round(session.kpis.winrate * 100)}%` : '—',                     color: 'var(--on-surface)' },
    { label: 'ELO Change',   value: session.kpis?.elo_change !== undefined ? `${session.kpis.elo_change >= 0 ? '+' : ''}${session.kpis.elo_change}` : '—', color: (session.kpis?.elo_change ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' },
  ]

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link to="/dashboard" className="btn-ghost" style={{ padding: 8 }}><ChevronLeft size={16} /></Link>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: 8 }}>Session Report</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isWin ? (
                <Trophy size={20} style={{ color: 'var(--secondary)', filter: 'drop-shadow(0 0 8px rgba(63,255,160,0.5))' }} />
              ) : (
                <AlertTriangle size={20} style={{ color: 'var(--tertiary)' }} />
              )}
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em',
                color: isWin ? 'var(--secondary)' : 'var(--tertiary)',
                textShadow: isWin ? '0 0 20px rgba(63,255,160,0.3)' : 'none',
              }}>
                Session {isWin ? 'Victory' : 'Defeat'}
              </h1>
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 6 }}>
              {session.arena_name ?? 'Arena'} · {session.kpis?.hands_played ?? 0} hands played
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 20 }}>
          {kpis.map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--surface-container)', padding: '20px 16px', textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        {session.performance && session.performance.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>Per-Hand Profit</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={session.performance.slice(0, 30)}>
                  <Bar dataKey="profit" fill="var(--primary-container)" radius={[2,2,0,0]} />
                  <XAxis dataKey="hand" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-high)', border: '1px solid var(--outline)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}`, 'Profit']}
                    labelFormatter={(l) => `Hand ${l}`}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>Cumulative Profit</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={session.performance}>
                  <Line type="monotone" dataKey="cumulative"
                    stroke={isWin ? 'var(--secondary)' : 'rgba(255,107,107,0.7)'}
                    strokeWidth={2} dot={false} />
                  <XAxis dataKey="hand" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-high)', border: '1px solid var(--outline)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}`, 'Cumulative']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Insights + Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>
          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>Architect Insights</div>

            {session.insights && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--outline)', marginBottom: 16 }}>
                {[
                  { label: 'Fold Rate',       value: `${Math.round((session.insights.fold_rate ?? 0) * 100)}%` },
                  { label: 'Aggression Rate', value: `${Math.round((session.insights.aggression_rate ?? 0) * 100)}%` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'var(--surface-container)', padding: '12px 14px' }}>
                    <div className="label" style={{ marginBottom: 5 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--on-surface)' }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {session.key_events && session.key_events.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {session.key_events.map((f, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: 3,
                    background: 'var(--surface-container)',
                    borderLeft: '2px solid var(--outline)',
                    fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)',
                    lineHeight: 1.5,
                  }}>
                    {f.message}
                  </div>
                ))}
              </div>
            )}

            {session.insights?.vulnerabilities && session.insights.vulnerabilities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {session.insights.vulnerabilities.map((insight, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 3,
                    background: 'rgba(124,127,255,0.06)',
                    borderLeft: '2px solid rgba(124,127,255,0.3)',
                  }}>
                    <Bot size={13} style={{ color: 'var(--primary)', marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                      {insight}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="label" style={{ marginBottom: 16 }}>Next Steps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Link to="/dashboard" className="btn-secondary" style={{ justifyContent: 'center', fontSize: 13 }}>
                Command Center
              </Link>
              <Link to="/bots" className="btn-ghost" style={{ justifyContent: 'center', fontSize: 13 }}>
                Tweak Strategy
              </Link>
              <Link to="/battle" className="btn-primary" style={{ justifyContent: 'center', fontSize: 13 }}>
                <Swords size={13} /> Battle Again
              </Link>
            </div>
          </div>
        </div>

        {/* Hand log */}
        {session.hands && session.hands.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowHandLog(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                background: 'var(--surface-container)', border: '1px solid var(--outline)',
                borderRadius: showHandLog ? '4px 4px 0 0' : '4px',
                padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', flex: 1 }}>
                Hand Log — {session.hands.length} hands
              </span>
              {showHandLog ? <ChevronUp size={13} color="var(--on-surface-variant)" /> : <ChevronDown size={13} color="var(--on-surface-variant)" />}
            </button>
            {showHandLog && (
              <div style={{ border: '1px solid var(--outline)', borderTop: 'none', borderRadius: '0 0 4px 4px', background: 'var(--surface-low)', maxHeight: '480px', overflowY: 'auto' }}>
                {session.hands.map(hand => (
                  <HandLogRow
                    key={hand.hand_number}
                    hand={hand}
                    botName={session.bot_name}
                    oppName={session.opponent_bot_name}
                    sessionId={session.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  )
}
