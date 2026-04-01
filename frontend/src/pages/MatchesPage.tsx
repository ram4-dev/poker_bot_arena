import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Radio, Clock, TrendingUp, TrendingDown, RefreshCw, CheckCircle } from 'lucide-react'
import AppShell from '../components/AppShell'
import { getMatches } from '../api/matches'
import type { ActiveMatch, CompletedMatch, MatchSeat } from '../api/matches'

const ARENA_BADGES: Record<string, string> = {
  practice: 'badge-grey',
  low:      'badge-mint',
  mid:      'badge-indigo',
  high:     'badge-crimson',
}

function StackBar({ stack, initial }: { stack: number; initial: number }) {
  const base = initial > 0 ? initial : 1000
  const pct = Math.min(Math.max((stack / base) * 100, 0), 200)
  const color = stack >= base ? 'var(--secondary)' : 'var(--tertiary)'
  return (
    <div style={{ width: '100%', height: '4px', background: 'var(--outline)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`,
        height: '100%',
        background: color,
        borderRadius: '2px',
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

function SeatPanel({ seat, isWinner }: { seat: MatchSeat; isWinner?: boolean | null }) {
  const profit = seat.stack - seat.initial_stack
  const profitColor = profit >= 0 ? 'var(--secondary)' : 'var(--tertiary)'
  return (
    <div style={{
      flex: 1, padding: '14px 16px',
      background: isWinner ? 'rgba(124,255,178,0.05)' : 'var(--surface-container)',
      border: `1px solid ${isWinner ? 'rgba(124,255,178,0.2)' : 'var(--outline)'}`,
      borderRadius: '4px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {/* Bot name */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px',
          color: 'var(--on-surface)',
        }}>
          {seat.bot_name}
        </span>
        {isWinner === true && (
          <span style={{ fontSize: '10px', color: 'var(--secondary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            WIN
          </span>
        )}
        {isWinner === false && (
          <span style={{ fontSize: '10px', color: 'var(--tertiary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            LOSS
          </span>
        )}
      </div>

      {/* Owner + ELO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
          @{seat.username}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
          ELO {seat.elo}
        </span>
      </div>

      {/* Stack */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
            Stack
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--on-surface)' }}>
            ♟ {seat.stack.toLocaleString()}
          </span>
        </div>
        <StackBar stack={seat.stack} initial={seat.initial_stack} />
      </div>

      {/* Profit / winrate */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {profit >= 0
            ? <TrendingUp size={11} color="var(--secondary)" />
            : <TrendingDown size={11} color="var(--tertiary)" />}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: profitColor }}>
            {profit >= 0 ? '+' : ''}{profit}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
          {(seat.winrate * 100).toFixed(0)}% WR
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
          {seat.hands_won}W
        </span>
      </div>
    </div>
  )
}

function ActiveMatchCard({ match }: { match: ActiveMatch }) {
  return (
    <Link to={`/matches/${match.table_id}`} style={{ textDecoration: 'none', display: 'block' }}>
    <div style={{
      background: 'var(--surface-low)',
      border: '1px solid var(--outline)',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--outline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(124,127,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`badge ${ARENA_BADGES[match.arena.slug] ?? 'badge-grey'}`}>
            {match.arena.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
            SB {match.arena.small_blind} / BB {match.arena.big_blind}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
            Hand #{match.hands_played}
          </span>
          {/* Live pulse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--secondary)',
              animation: 'pulse 1.5s infinite',
              boxShadow: '0 0 6px var(--secondary)',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Seats */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'stretch' }}>
        <SeatPanel seat={match.seat_1} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '14px',
          color: 'var(--on-surface-variant)',
        }}>VS</div>
        <SeatPanel seat={match.seat_2} />
      </div>
    </div>
    </Link>
  )
}

function CompletedMatchCard({ match }: { match: CompletedMatch }) {
  const seat1Won = match.winner === 'seat_1'
  const seat2Won = match.winner === 'seat_2'
  const isDraw = match.winner === 'draw'

  const completedAt = match.completed_at ? new Date(match.completed_at) : null
  const elapsed = completedAt ? Math.floor((Date.now() - completedAt.getTime()) / 60000) : null

  return (
    <Link to={`/matches/${match.table_id}`} style={{ textDecoration: 'none', display: 'block' }}>
    <div style={{
      background: 'var(--surface-low)',
      border: '1px solid var(--outline)',
      borderRadius: '6px',
      overflow: 'hidden',
      opacity: 0.85,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--outline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={12} color="var(--on-surface-variant)" />
          <span className={`badge ${ARENA_BADGES[match.arena.slug] ?? 'badge-grey'}`}>
            {match.arena.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
            {match.hands_played} hands
          </span>
        </div>
        {elapsed !== null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
            {elapsed}m ago
          </span>
        )}
        {isDraw && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
            DRAW
          </span>
        )}
      </div>

      {/* Seats */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: '8px' }}>
        <SeatPanel seat={match.seat_1} isWinner={isDraw ? null : seat1Won} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--on-surface-variant)',
        }}>vs</div>
        <SeatPanel seat={match.seat_2} isWinner={isDraw ? null : seat2Won} />
      </div>
    </div>
    </Link>
  )
}

export default function MatchesPage() {
  const [data, setData] = useState<{ active: ActiveMatch[]; recently_completed: CompletedMatch[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    try {
      const res = await getMatches()
      setData(res)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <AppShell>
      {/* Page header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Radio size={18} color="var(--secondary)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--on-surface)', margin: 0 }}>
              Live Matches
            </h1>
            {data && (
              <span style={{
                background: 'rgba(124,255,178,0.12)', color: 'var(--secondary)',
                border: '1px solid rgba(124,255,178,0.3)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.06em',
              }}>
                {data.active.length} ACTIVE
              </span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)', margin: 0 }}>
            Auto-refresh every 5s — last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
          Loading matches...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Active matches */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--secondary)', marginBottom: '12px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 6px var(--secondary)' }} />
              In Progress ({data.active.length})
            </div>

            {data.active.length === 0 ? (
              <div style={{
                padding: '40px', textAlign: 'center',
                border: '1px dashed var(--outline)', borderRadius: '6px',
                color: 'var(--on-surface-variant)', fontFamily: 'var(--font-mono)', fontSize: '12px',
              }}>
                No active matches right now.{' '}
                <Link to="/battle" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  Deploy a bot
                </Link>{' '}
                to start one.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '12px' }}>
                {data.active.map(m => <ActiveMatchCard key={m.table_id} match={m} />)}
              </div>
            )}
          </div>

          {/* Recently completed */}
          {data.recently_completed.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--on-surface-variant)', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Clock size={11} />
                Recently Completed ({data.recently_completed.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '10px' }}>
                {data.recently_completed.map(m => <CompletedMatchCard key={m.table_id} match={m} />)}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
