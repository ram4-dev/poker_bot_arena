import { useEffect, useState } from 'react'
import { Trophy, Bot, Crown } from 'lucide-react'
import AppShell from '../components/AppShell'
import { leaderboardApi, type LeaderboardItem } from '../api/leaderboard'
import { useAuth } from '../context/AuthContext'

type Tab = 'users' | 'bots'

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Crown size={13} style={{ color: '#FFD700' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#FFD700' }}>#1</span>
    </div>
  )
  if (rank === 2) return (
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#C0C0C0' }}>#2</span>
  )
  if (rank === 3) return (
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color: '#CD7F32' }}>#3</span>
  )
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--on-surface-variant)' }}>#{rank}</span>
  )
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
  const [season, setSeason] = useState<string>('')
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [items, setItems] = useState<LeaderboardItem[]>([])
  const [myPosition, setMyPosition] = useState<{ rank: number; username: string; elo: number } | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    leaderboardApi.seasons().then(r => {
      setAvailableSeasons(r.data.available)
      setSeason(r.data.current)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const fn = tab === 'users' ? leaderboardApi.users : leaderboardApi.bots
    fn(season || undefined)
      .then(r => {
        setItems(r.data.items)
        setMyPosition(r.data.my_position)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, season])

  return (
    <AppShell>
      <div style={{ maxWidth: 760 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Global Rankings</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              Ascend the Hierarchy
            </h1>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Global rankings of architects and their bots
            </p>
          </div>

          {availableSeasons.length > 0 && (
            <select value={season} onChange={e => setSeason(e.target.value)} className="input-field" style={{ width: 160 }}>
              {availableSeasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {(['users', 'bots'] as Tab[]).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'users' ? 'Architects' : 'Top Bots'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-container)', animation: 'glowPulse 1.5s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>LOADING RANKINGS...</span>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>{tab === 'users' ? 'Architect' : 'Bot'}</th>
                    {tab === 'bots' && <th>Owner</th>}
                    <th>ELO</th>
                    <th>Win Rate</th>
                    <th>W / L</th>
                    {tab === 'users' && <th>Badges</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.entity_id}
                      style={item.name === user?.username ? {
                        background: 'rgba(124,127,255,0.06)',
                        borderLeft: '2px solid var(--primary-container)',
                      } : {}}>
                      <td style={{ width: 60 }}>
                        <RankMedal rank={item.rank} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                            background: tab === 'users' ? 'var(--gradient-primary)' : 'var(--surface-container)',
                            border: `1px solid ${tab === 'users' ? 'transparent' : 'var(--outline)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#fff',
                          }}>
                            {tab === 'users' ? (item.name?.[0]?.toUpperCase() ?? '?') : <Bot size={12} style={{ color: 'var(--on-surface-variant)' }} />}
                          </div>
                          <div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>
                              {item.name}
                            </span>
                            {tab === 'users' && item.name === user?.username && (
                              <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--primary-container)', background: 'rgba(124,127,255,0.1)', padding: '1px 5px', borderRadius: 2 }}>
                                YOU
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {tab === 'bots' && (
                        <td style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>{item.creator}</td>
                      )}
                      <td className="text-numeric" style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.elo}</td>
                      <td className="text-numeric" style={{ color: item.winrate >= 0.5 ? 'var(--secondary)' : 'var(--on-surface-variant)' }}>
                        {(item.winrate * 100).toFixed(1)}%
                      </td>
                      <td className="text-numeric" style={{ fontSize: 13 }}>
                        <span style={{ color: 'var(--secondary)' }}>{item.total_wins}</span>
                        <span style={{ color: 'var(--outline)', margin: '0 3px' }}>/</span>
                        <span style={{ color: 'var(--tertiary)' }}>{item.total_losses}</span>
                      </td>
                      {tab === 'users' && (
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.badges?.map(b => (
                              <span key={b} className="badge badge-indigo">{b.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* My rank */}
              {myPosition && myPosition.rank > 10 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 20px',
                  background: 'rgba(124,127,255,0.06)',
                  borderTop: '1px solid var(--outline)',
                }}>
                  <Trophy size={14} style={{ color: 'var(--primary)' }} />
                  <span className="label">Your Rank</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
                    #{myPosition.rank}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    ELO {myPosition.elo}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
