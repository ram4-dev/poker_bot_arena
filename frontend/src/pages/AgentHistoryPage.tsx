import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, Activity, ChevronDown, ChevronRight } from 'lucide-react'
import AppShell from '../components/AppShell'
import { getAgentHistory, getSessionLog, type Agent, type SessionEntry, type HandDetail } from '../api/agents'

export default function AgentHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [handDetails, setHandDetails] = useState<Record<string, HandDetail[]>>({})
  const [loadingHands, setLoadingHands] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getAgentHistory(id, 50, 0)
      .then(r => {
        setAgent(r.data.agent)
        setSessions(r.data.sessions ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleToggleSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      return
    }
    setExpandedSession(sessionId)
    if (!handDetails[sessionId]) {
      setLoadingHands(sessionId)
      try {
        const res = await getSessionLog(sessionId)
        setHandDetails(prev => ({ ...prev, [sessionId]: res.data.hands ?? [] }))
      } catch {
        setHandDetails(prev => ({ ...prev, [sessionId]: [] }))
      } finally {
        setLoadingHands(null)
      }
    }
  }

  // Stats
  const totalProfit = sessions.reduce((acc, s) => acc + (s.profit ?? 0), 0)
  const totalHands = sessions.reduce((acc, s) => acc + (s.hands_played ?? 0), 0)
  const wins = sessions.filter(s => (s.profit ?? 0) > 0).length
  const winrate = sessions.length > 0 ? wins / sessions.length : 0
  const avgHandsPerSession = sessions.length > 0 ? Math.round(totalHands / sessions.length) : 0

  // Bankroll evolution chart data
  const bankrollData = [...sessions].reverse().reduce<Array<{ session: number; bankroll: number }>>((acc, s, idx) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].bankroll : 0
    acc.push({ session: idx + 1, bankroll: prev + (s.profit ?? 0) })
    return acc
  }, [])

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-container)', animation: 'glowPulse 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>LOADING AGENT DATA...</span>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 960 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Agent History</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            {agent?.name ?? 'Agent'}
          </h1>
          {agent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span className={`badge ${agent.status === 'idle' ? 'badge-mint status-idle' : agent.status === 'playing' ? 'badge-indigo status-in-battle' : agent.status === 'queued' ? 'badge-indigo' : 'badge-crimson'}`}>
                {agent.status.toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)' }}>
                ELO {agent.elo}
              </span>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 24 }}>
          {[
            { label: 'Win Rate', value: `${(winrate * 100).toFixed(1)}%`, color: winrate >= 0.5 ? 'var(--secondary)' : 'var(--tertiary)', icon: TrendingUp },
            { label: 'Total Profit', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? 'var(--secondary)' : 'var(--tertiary)', icon: TrendingUp },
            { label: 'Total Hands', value: totalHands.toLocaleString(), color: 'var(--primary)', icon: Activity },
            { label: 'Avg Hands/Session', value: avgHandsPerSession.toString(), color: 'var(--primary-container)', icon: Activity },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={{ background: 'var(--surface-container)', padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label">{label}</span>
                <Icon size={13} style={{ color, opacity: 0.7 }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', marginTop: 6, color }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Bankroll chart */}
        {bankrollData.length > 1 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="label" style={{ marginBottom: 16 }}>Bankroll Evolution</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={bankrollData}>
                <XAxis
                  dataKey="session"
                  tick={{ fill: 'var(--on-surface-variant)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={false} tickLine={false}
                  label={{ value: 'Session', position: 'insideBottom', offset: -5, style: { fontSize: 9, fill: 'var(--on-surface-variant)', fontFamily: 'JetBrains Mono' } }}
                />
                <YAxis
                  tick={{ fill: 'var(--on-surface-variant)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-high)',
                    border: '1px solid var(--outline)',
                    borderRadius: 4, fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(v: number) => [`\u2659 ${v.toLocaleString()}`, 'Cumulative P/L']}
                />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="var(--primary-container)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sessions table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)' }}>
            <span className="label">Sessions ({sessions.length})</span>
          </div>

          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Activity size={28} style={{ color: 'var(--outline)', margin: '0 auto 10px' }} />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                No sessions recorded yet
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Date</th>
                  <th>Arena</th>
                  <th>Rival</th>
                  <th>Hands</th>
                  <th>Profit</th>
                  <th>ELO</th>
                  <th>Exit</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <>
                    <tr
                      key={s.session_id}
                      onClick={() => handleToggleSession(s.session_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ width: 30, textAlign: 'center' }}>
                        {expandedSession === s.session_id
                          ? <ChevronDown size={12} style={{ color: 'var(--primary-container)' }} />
                          : <ChevronRight size={12} style={{ color: 'var(--on-surface-variant)' }} />
                        }
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                        {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : '\u2014'}
                      </td>
                      <td style={{ color: 'var(--on-surface-2)' }}>{s.arena_name}</td>
                      <td style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>{s.rival_agent ?? '\u2014'}</td>
                      <td style={{ color: 'var(--on-surface-variant)' }}>{s.hands_played}</td>
                      <td className="text-numeric" style={{ fontWeight: 700, color: (s.profit ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                        {(s.profit ?? 0) >= 0 ? '+' : ''}{s.profit ?? 0}
                      </td>
                      <td className="text-numeric" style={{ color: (s.elo_change ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                        {(s.elo_change ?? 0) >= 0 ? '+' : ''}{s.elo_change ?? 0}
                      </td>
                      <td>
                        {s.exit_reason && (
                          <span className="badge badge-grey">{s.exit_reason}</span>
                        )}
                      </td>
                    </tr>
                    {expandedSession === s.session_id && (
                      <tr key={`${s.session_id}-detail`}>
                        <td colSpan={8} style={{ padding: 0, background: 'var(--surface-container)' }}>
                          <div style={{ padding: '16px 20px' }}>
                            {loadingHands === s.session_id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '16px 0' }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary-container)', animation: 'glowPulse 1.5s infinite' }} />
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>LOADING HANDS...</span>
                              </div>
                            ) : (handDetails[s.session_id]?.length ?? 0) === 0 ? (
                              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)', textAlign: 'center', padding: '12px 0' }}>
                                No hand details available
                              </p>
                            ) : (
                              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline)' }}>Hand #</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline)' }}>Pot</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline)' }}>Community</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline)' }}>Winner</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--outline)' }}>Rank</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {handDetails[s.session_id]?.map(hand => (
                                      <tr key={hand.hand_number}>
                                        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface)' }}>
                                          #{hand.hand_number}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--secondary)' }}>
                                          {'\u2659'} {hand.pot}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-2)' }}>
                                          {hand.community_cards.length > 0 ? hand.community_cards.join(' ') : '\u2014'}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-container)' }}>
                                          {hand.winner_session_id ? `Seat` : 'Draw'}
                                        </td>
                                        <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                                          {hand.winning_hand_rank ?? '\u2014'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
