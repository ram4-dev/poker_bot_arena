import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Monitor, Swords, Clock } from 'lucide-react'
import AppShell from '../components/AppShell'
import { matchesApi, type MatchInfo } from '../api/matches'

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m ago`
}

function MatchCard({ match, onClick }: { match: MatchInfo; onClick: () => void }) {
  const s1 = match.seat_1
  const s2 = match.seat_2

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--surface-low)',
        border: '1px solid var(--outline)',
        borderRadius: 4, padding: 16,
        transition: 'border-color 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-container)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--outline)')}
    >
      {/* Top row: arena + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
            color: 'var(--on-surface)',
          }}>
            {match.arena.name}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--on-surface-variant)',
          }}>
            {match.arena.small_blind}/{match.arena.big_blind}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} style={{ color: 'var(--on-surface-variant)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--on-surface-variant)',
          }}>
            {match.started_at ? timeSince(match.started_at) : '--'}
          </span>
        </div>
      </div>

      {/* Matchup */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 10,
      }}>
        {/* Seat 1 */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
            color: 'var(--on-surface)',
          }}>
            {s1?.agent_name ?? 'Empty'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--on-surface-variant)', marginTop: 2,
          }}>
            {s1 ? `${s1.username} \u00B7 ELO ${s1.elo}` : '--'}
          </div>
        </div>

        {/* VS */}
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
          color: 'var(--primary-container)', letterSpacing: '0.05em',
        }}>
          VS
        </div>

        {/* Seat 2 */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14,
            color: 'var(--on-surface)',
          }}>
            {s2?.agent_name ?? 'Empty'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--on-surface-variant)', marginTop: 2,
          }}>
            {s2 ? `${s2.username} \u00B7 ELO ${s2.elo}` : '--'}
          </div>
        </div>
      </div>

      {/* Bottom stats row */}
      <div style={{
        display: 'flex', gap: 16, paddingTop: 10,
        borderTop: '1px solid var(--outline)',
      }}>
        {[
          { label: 'Hands', value: match.hands_played },
          { label: 'S1 Stack', value: s1?.stack ?? '--' },
          { label: 'S2 Stack', value: s2?.stack ?? '--' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)', marginTop: 2 }}>{value}</div>
          </div>
        ))}
        {match.winner && (
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Result</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, marginTop: 2,
              color: match.winner === 'draw' ? 'var(--on-surface-variant)' : 'var(--secondary)',
            }}>
              {match.winner === 'seat_1' ? s1?.agent_name ?? 'Seat 1' : match.winner === 'seat_2' ? s2?.agent_name ?? 'Seat 2' : 'Draw'}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

export default function MatchesPage() {
  const [active, setActive] = useState<MatchInfo[]>([])
  const [completed, setCompleted] = useState<MatchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchMatches = () => {
    matchesApi.list()
      .then(r => {
        setActive(r.data.active)
        setCompleted(r.data.recently_completed)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMatches()
    const interval = setInterval(fetchMatches, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Live Games</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22,
            color: 'var(--on-surface)', letterSpacing: '-0.02em',
          }}>
            Matches
          </h1>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: 'var(--on-surface-variant)', marginTop: 4,
          }}>
            Active and recently completed matches across all arenas.
          </p>
        </div>

        {/* Active section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <Monitor size={14} style={{ color: 'var(--secondary)' }} />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase' as const,
              color: 'var(--on-surface-variant)',
            }}>
              Active ({active.length})
            </span>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: active.length > 0 ? 'var(--secondary)' : 'var(--outline)',
              boxShadow: active.length > 0 ? '0 0 6px var(--secondary)' : 'none',
            }} />
          </div>

          {loading ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              fontFamily: 'var(--font-display)', fontSize: 13,
              color: 'var(--on-surface-variant)',
            }}>
              Loading matches...
            </div>
          ) : active.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              background: 'var(--surface-low)',
              border: '1px solid var(--outline)',
              borderRadius: 4,
            }}>
              <Swords size={28} style={{ color: 'var(--outline)', margin: '0 auto 10px' }} />
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 13,
                color: 'var(--on-surface-variant)',
              }}>
                No active matches. Agents join via API.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {active.map(m => (
                <MatchCard
                  key={m.table_id}
                  match={m}
                  onClick={() => navigate(`/matches/${m.table_id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        {completed.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            }}>
              <Clock size={14} style={{ color: 'var(--on-surface-variant)' }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                color: 'var(--on-surface-variant)',
              }}>
                Recently Completed ({completed.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {completed.map(m => (
                <MatchCard
                  key={m.table_id}
                  match={m}
                  onClick={() => navigate(`/matches/${m.table_id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
