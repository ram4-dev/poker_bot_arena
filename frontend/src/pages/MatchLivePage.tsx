import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Radio, Clock } from 'lucide-react'
import AppShell from '../components/AppShell'
import { getLiveMatch } from '../api/matches'
import type { LiveMatchResponse, LiveHand, LiveHandEvent } from '../api/matches'
import { parseCard } from '../utils/cards'

// ─── Card display ────────────────────────────────────────────────────────────

function Card({ code, faceDown = false }: { code: string; faceDown?: boolean }) {
  if (faceDown) return (
    <div style={{
      width: '34px', height: '48px', borderRadius: '4px',
      background: 'linear-gradient(135deg, #2a2a3e, #1a1a2e)',
      border: '1px solid var(--outline)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', color: 'var(--on-surface-variant)',
    }}>?</div>
  )
  const { rank, color, symbol } = parseCard(code)
  return (
    <div style={{
      width: '34px', height: '48px', borderRadius: '4px',
      background: '#1e1e2a', border: '1px solid rgba(255,255,255,0.15)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '2px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color, lineHeight: 1 }}>{rank}</span>
      <span style={{ fontSize: '12px', color, lineHeight: 1 }}>{symbol}</span>
    </div>
  )
}

// ─── Hand strength bar ────────────────────────────────────────────────────────

function StrengthBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value > 0.6 ? 'var(--secondary)' : value > 0.35 ? '#ffb74d' : '#e05c5c'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ width: '36px', height: '3px', background: 'var(--outline)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, fontWeight: 600 }}>{pct}%</span>
    </div>
  )
}

// ─── Action badge ─────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; color: string }> = {
  fold:  { bg: 'rgba(224,92,92,0.15)',  color: '#e05c5c' },
  call:  { bg: 'rgba(124,127,255,0.15)', color: 'var(--primary)' },
  raise: { bg: 'rgba(255,183,77,0.15)', color: '#ffb74d' },
  check: { bg: 'rgba(124,255,178,0.12)', color: 'var(--secondary)' },
}

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action.toLowerCase()] ?? { bg: 'rgba(255,255,255,0.08)', color: 'var(--on-surface-variant)' }
  return (
    <span style={{
      ...style,
      padding: '1px 7px', borderRadius: '3px',
      fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {action}
    </span>
  )
}

// ─── Event feed row ───────────────────────────────────────────────────────────

function EventRow({ event, botName, visible }: {
  event: LiveHandEvent
  botName: string
  visible: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0)' : 'translateX(-8px)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
        color: 'var(--on-surface-variant)', textTransform: 'uppercase',
        letterSpacing: '0.08em', minWidth: '42px',
      }}>
        {event.street}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px',
        color: 'var(--on-surface)', minWidth: '90px', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {botName}
      </span>
      {/* Hole cards */}
      {event.hole_cards.length > 0 && (
        <div style={{ display: 'flex', gap: '3px' }}>
          {event.hole_cards.map((c, i) => {
            const { rank, symbol, color } = parseCard(c)
            return (
              <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, fontWeight: 700 }}>
                {rank}{symbol}
              </span>
            )
          })}
        </div>
      )}
      <ActionBadge action={event.action} />
      {event.amount > 0 && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#ffb74d' }}>
          ♟{event.amount}
        </span>
      )}
      {event.hand_strength !== null && event.hand_strength !== undefined && (
        <StrengthBar value={event.hand_strength} />
      )}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
        pot {event.pot_after}
      </span>
    </div>
  )
}

// ─── Seat panel ───────────────────────────────────────────────────────────────

function LiveSeatPanel({
  seat, stack, isActive, isWinner,
}: {
  seat: NonNullable<LiveMatchResponse['seat_1']>
  stack: number
  isActive: boolean
  isWinner: boolean | null
}) {
  const profit = stack - seat.initial_stack
  return (
    <div style={{
      flex: 1, padding: '14px 16px',
      background: isWinner === true
        ? 'rgba(124,255,178,0.06)'
        : isWinner === false ? 'rgba(224,92,92,0.04)' : 'var(--surface-container)',
      border: `1px solid ${isWinner === true ? 'rgba(124,255,178,0.25)' : isActive ? 'var(--primary)' : 'var(--outline)'}`,
      borderRadius: '5px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--on-surface)' }}>
          {seat.bot_name}
        </span>
        {isWinner === true && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--secondary)', fontWeight: 800 }}>WIN ✓</span>
        )}
        {isWinner === false && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#e05c5c', fontWeight: 800 }}>LOSS</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>@{seat.username}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>ELO {seat.elo}</span>
      </div>
      {/* Stack */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '18px', color: 'var(--on-surface)' }}>
          ♟{stack.toLocaleString()}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
          color: profit >= 0 ? 'var(--secondary)' : '#e05c5c',
        }}>
          {profit >= 0 ? '+' : ''}{profit}
        </span>
      </div>
      {/* Stack bar */}
      <div style={{ height: '3px', background: 'var(--outline)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, (stack / (seat.initial_stack || 1)) * 100)}%`,
          height: '100%',
          background: profit >= 0 ? 'var(--secondary)' : '#e05c5c',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatchLivePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const [data, setData] = useState<LiveMatchResponse | null>(null)

  // Animation state
  const [currentHand, setCurrentHand] = useState<LiveHand | null>(null)
  const [visibleEvents, setVisibleEvents] = useState<number>(0)
  const [handResult, setHandResult] = useState<{ winner: 1 | 2 | null; rank: string | null } | null>(null)
  const [seat1Stack, setSeat1Stack] = useState<number>(0)
  const [seat2Stack, setSeat2Stack] = useState<number>(0)

  // Track last animated hand so we don't replay
  const lastAnimatedHandRef = useRef<number>(-1)
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimeouts = () => {
    animTimeoutsRef.current.forEach(clearTimeout)
    animTimeoutsRef.current = []
  }

  const animateHand = useCallback((hand: LiveHand) => {
    clearTimeouts()
    setCurrentHand(hand)
    setVisibleEvents(0)
    setHandResult(null)

    const EVENT_DELAY = 500 // ms per event

    hand.events.forEach((_, idx) => {
      const t = setTimeout(() => {
        setVisibleEvents(idx + 1)
      }, (idx + 1) * EVENT_DELAY)
      animTimeoutsRef.current.push(t)
    })

    // Show result after all events
    const resultDelay = (hand.events.length + 1) * EVENT_DELAY + 300
    const rt = setTimeout(() => {
      setHandResult({ winner: hand.winner_seat, rank: hand.winning_hand_rank })
      setSeat1Stack(hand.player_1_stack_after)
      setSeat2Stack(hand.player_2_stack_after)
    }, resultDelay)
    animTimeoutsRef.current.push(rt)
  }, [])

  const load = useCallback(async () => {
    if (!tableId) return
    try {
      const res = await getLiveMatch(tableId)
      setData(res)

      // Initialize stacks on first load
      if (res.seat_1 && seat1Stack === 0) setSeat1Stack(res.seat_1.stack)
      if (res.seat_2 && seat2Stack === 0) setSeat2Stack(res.seat_2.stack)

      // Animate the latest hand if it's new
      if (res.recent_hands.length > 0) {
        const latestHand = res.recent_hands[res.recent_hands.length - 1]
        if (latestHand.hand_number > lastAnimatedHandRef.current) {
          lastAnimatedHandRef.current = latestHand.hand_number
          animateHand(latestHand)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [tableId, animateHand, seat1Stack, seat2Stack])

  useEffect(() => {
    load()
    const interval = setInterval(load, 4000)
    return () => {
      clearInterval(interval)
      clearTimeouts()
    }
  }, [load])

  const isLive = data?.status === 'active'

  const bot1Name = data?.seat_1?.bot_name ?? 'Player 1'
  const bot2Name = data?.seat_2?.bot_name ?? 'Player 2'

  const currentPot = currentHand?.events.length
    ? currentHand.events[Math.min(visibleEvents, currentHand.events.length) - 1]?.pot_after ?? 0
    : 0

  const communityCards = currentHand?.community_cards ?? []

  // Determine winner for current hand
  const currentWinner = handResult?.winner ?? null

  return (
    <AppShell>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link to="/matches" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          color: 'var(--on-surface-variant)', textDecoration: 'none',
        }}>
          <ArrowLeft size={13} /> Back
        </Link>
        <div style={{ width: '1px', height: '14px', background: 'var(--outline)' }} />
        {data && (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
              {data.arena.name} — SB {data.arena.small_blind} / BB {data.arena.big_blind}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
              {data.hands_played} hands total
            </span>
            {isLive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 6px var(--secondary)', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Live
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                <Clock size={11} color="var(--on-surface-variant)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--on-surface-variant)' }}>Completed</span>
              </div>
            )}
          </>
        )}
      </div>

      {!data && (
        <div style={{ textAlign: 'center', padding: '80px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
          Loading match...
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px', alignItems: 'start' }}>

          {/* ── Left: table + action ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Seat panels + hole cards */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {data.seat_1 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <LiveSeatPanel
                    seat={data.seat_1}
                    stack={seat1Stack || data.seat_1.stack}
                    isActive={currentHand !== null && visibleEvents > 0 &&
                      currentHand.events[visibleEvents - 1]?.player_seat === 1}
                    isWinner={currentWinner !== null ? currentWinner === 1 : null}
                  />
                  {currentHand?.player_1_hole && currentHand.player_1_hole.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      {currentHand.player_1_hole.map((c, i) => <Card key={i} code={c} />)}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '16px', color: 'var(--on-surface-variant)' }}>VS</span>
              </div>
              {data.seat_2 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <LiveSeatPanel
                    seat={data.seat_2}
                    stack={seat2Stack || data.seat_2.stack}
                    isActive={currentHand !== null && visibleEvents > 0 &&
                      currentHand.events[visibleEvents - 1]?.player_seat === 2}
                    isWinner={currentWinner !== null ? currentWinner === 2 : null}
                  />
                  {currentHand?.player_2_hole && currentHand.player_2_hole.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      {currentHand.player_2_hole.map((c, i) => <Card key={i} code={c} />)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Table surface */}
            <div style={{
              background: 'radial-gradient(ellipse at center, #0e2318 0%, #081510 60%, var(--surface-low) 100%)',
              border: '2px solid rgba(124,255,178,0.15)',
              borderRadius: '80px',
              padding: '28px 40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
              boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.3)',
              minHeight: '160px',
              position: 'relative',
            }}>
              {/* Hand number */}
              {currentHand && (
                <div style={{ position: 'absolute', top: '12px', left: '20px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
                    HAND #{currentHand.hand_number}
                  </span>
                </div>
              )}

              {/* Community cards */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {communityCards.length > 0
                  ? communityCards.map((c, i) => <Card key={i} code={c} />)
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                      Waiting for cards...
                    </span>
                }
              </div>

              {/* Pot */}
              {currentPot > 0 && (
                <div style={{
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,183,77,0.3)',
                  borderRadius: '20px', padding: '4px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: '#ffb74d',
                }}>
                  POT ♟{currentPot}
                </div>
              )}

              {/* Hand result */}
              {handResult && handResult.winner !== null && (
                <div style={{
                  background: 'rgba(124,255,178,0.12)',
                  border: '1px solid rgba(124,255,178,0.3)',
                  borderRadius: '6px', padding: '6px 18px',
                  fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700,
                  color: 'var(--secondary)', textAlign: 'center',
                  animation: 'fadeIn 0.4s ease',
                }}>
                  {handResult.winner === 1 ? bot1Name : bot2Name} wins
                  {handResult.rank && ` · ${handResult.rank}`}
                </div>
              )}
            </div>

            {/* Action feed */}
            {currentHand && (
              <div style={{
                background: 'var(--surface-low)',
                border: '1px solid var(--outline)',
                borderRadius: '6px',
                padding: '14px 16px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--primary)', marginBottom: '10px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <Radio size={9} />
                  Hand #{currentHand.hand_number} — Live Action
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {currentHand.events.map((ev, idx) => (
                    <EventRow
                      key={`${currentHand.hand_number}-${ev.sequence}`}
                      event={ev}
                      botName={ev.player_seat === 1 ? bot1Name : bot2Name}
                      visible={idx < visibleEvents}
                    />
                  ))}
                </div>
                {visibleEvents < currentHand.events.length && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px',
                    fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 0.8s infinite' }} />
                    Playing...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right: recent hands log ── */}
          <div style={{
            background: 'var(--surface-low)',
            border: '1px solid var(--outline)',
            borderRadius: '6px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--outline)',
              fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--on-surface-variant)',
            }}>
              Recent Hands
            </div>
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {[...data.recent_hands].reverse().map(hand => {
                const winnerName = hand.winner_seat === 1 ? bot1Name : hand.winner_seat === 2 ? bot2Name : 'Draw'
                const isCurrentHand = currentHand?.hand_number === hand.hand_number
                return (
                  <div
                    key={hand.hand_number}
                    onClick={() => animateHand(hand)}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--outline)',
                      cursor: 'pointer',
                      background: isCurrentHand ? 'rgba(124,127,255,0.08)' : 'transparent',
                      transition: 'background 0.15s',
                      borderLeft: isCurrentHand ? '2px solid var(--primary)' : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isCurrentHand) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (!isCurrentHand) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--on-surface-variant)' }}>
                        #{hand.hand_number}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                        color: hand.winner_seat === 1 ? 'var(--secondary)' : hand.winner_seat === 2 ? '#e05c5c' : 'var(--on-surface-variant)',
                      }}>
                        {winnerName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {hand.community_cards.slice(0, 5).map((c, i) => {
                          const { rank, symbol, color } = parseCard(c)
                          return (
                            <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color, fontWeight: 600 }}>
                              {rank}{symbol}
                            </span>
                          )
                        })}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)' }}>
                        pot ♟{hand.pot}
                      </span>
                    </div>
                    {hand.winning_hand_rank && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>
                        {hand.winning_hand_rank}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </AppShell>
  )
}
