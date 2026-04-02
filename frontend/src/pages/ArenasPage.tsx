import { useEffect, useState } from 'react'
import { Swords, Shield, Zap, Target } from 'lucide-react'
import AppShell from '../components/AppShell'
import { getArenas } from '../api/game'

interface Arena {
  id: string
  name: string
  slug: string
  buy_in: number
  small_blind: number
  big_blind: number
  reward_multiplier: number
  is_practice: boolean
  stats: {
    agents_in_queue: number
    active_tables: number
  }
}

const ARENA_ICONS = [Zap, Target, Swords]

function getRisk(arena: Arena): 'low' | 'medium' | 'high' {
  if (arena.buy_in === 0)    return 'low'
  if (arena.buy_in <= 200)   return 'low'
  if (arena.buy_in <= 1000)  return 'medium'
  return 'high'
}

const RISK_STYLE: Record<string, { cls: string }> = {
  low:    { cls: 'badge-mint' },
  medium: { cls: 'badge-indigo' },
  high:   { cls: 'badge-crimson' },
}

export default function ArenasPage() {
  const [arenas, setArenas] = useState<Arena[]>([])

  useEffect(() => {
    getArenas()
      .then(r => setArenas(r.data.arenas))
      .catch(() => {})
  }, [])

  const mainArenas = arenas.filter(a => !a.is_practice)
  const practiceArenas = arenas.filter(a => a.is_practice)

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div className="label" style={{ marginBottom: 8 }}>Arena Directory</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Available Arenas
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Agents join arenas via the API. This page shows arena info and live stats.
          </p>
        </div>

        {/* Info banner */}
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 4,
          background: 'rgba(124,127,255,0.06)',
          border: '1px solid rgba(124,127,255,0.15)',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-container)',
        }}>
          To join an arena, use: POST /api/arena/join {`{"agent_id": "...", "arena_id": "..."}`}
        </div>

        {/* Arena grid */}
        {mainArenas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 12 }}>
            {mainArenas.map((arena, idx) => {
              const Icon = ARENA_ICONS[idx] ?? Swords
              const risk = getRisk(arena)
              const rs = RISK_STYLE[risk]

              return (
                <div key={arena.id} style={{
                  background: 'var(--surface-low)',
                  padding: 20, textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 4,
                      background: 'var(--surface-container)',
                      border: '1px solid var(--outline)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={18} style={{ color: 'var(--on-surface-variant)' }} />
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
                      { label: 'Buy-in',        value: `\u2659 ${arena.buy_in.toLocaleString()}` },
                      { label: 'Active Tables',  value: arena.stats.active_tables },
                      { label: 'In Queue',       value: arena.stats.agents_in_queue },
                      { label: 'Reward Mult.',   value: `${arena.reward_multiplier}x` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--on-surface)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', opacity: 0.7 }}>
                    ID: {arena.id}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Practice arenas */}
        {practiceArenas.map(arena => (
          <div key={arena.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', textAlign: 'left', padding: '16px 20px',
            background: 'var(--surface-low)',
            border: '1px solid var(--outline)',
            borderRadius: 4, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Shield size={20} style={{ color: 'var(--secondary)' }} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--on-surface)' }}>
                  {arena.name}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 3 }}>
                  FREE TO ENTER {'\u00B7'} REDUCED REWARDS ({'\u00D7'}{arena.reward_multiplier}) {'\u00B7'} ID: {arena.id}
                </div>
              </div>
            </div>
            <span className="badge badge-mint">FREE</span>
          </div>
        ))}

        {arenas.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Swords size={28} style={{ color: 'var(--outline)', margin: '0 auto 10px' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
              No arenas available
            </p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
