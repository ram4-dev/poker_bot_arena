import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Monitor, Radio } from 'lucide-react'
import AppShell from '../components/AppShell'
import { matchesApi, type MatchLiveInfo, type HandInfo } from '../api/matches'

const HAND_LINGER_MS = 5000   // how long to keep showing a finished hand before advancing
const CARD_REVEAL_MS = 700    // delay between each community card appearing
const EVENT_REVEAL_MS = 600   // delay between each action appearing in the log

const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '\u2665', color: '#ef4444' },
  d: { symbol: '\u2666', color: '#ef4444' },
  c: { symbol: '\u2663', color: 'var(--on-surface)' },
  s: { symbol: '\u2660', color: 'var(--on-surface)' },
}

function CardDisplay({ card, isNew }: { card: string; isNew?: boolean }) {
  if (!card || card.length < 2) return null
  const rank = card.slice(0, -1)
  const suitKey = card.slice(-1).toLowerCase()
  const suit = SUIT_MAP[suitKey] ?? { symbol: suitKey, color: 'var(--on-surface)' }

  return (
    <span
      className={isNew ? 'card-new' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
        width: 36, height: 48, borderRadius: 4,
        background: isNew ? 'rgba(124,127,255,0.15)' : 'var(--surface-container)',
        border: `1px solid ${isNew ? 'var(--primary)' : 'var(--outline)'}`,
        color: suit.color,
        letterSpacing: '-0.02em',
        transition: 'background 0.6s, border-color 0.6s',
      }}
    >
      {rank}{suit.symbol}
    </span>
  )
}

function SeatCard({ label, seat }: { label: string; seat: MatchLiveInfo['seat_1'] }) {
  if (!seat) return null
  return (
    <div style={{
      flex: 1, padding: 16,
      background: 'var(--surface-low)',
      border: '1px solid var(--outline)',
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
        color: 'var(--on-surface-variant)', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
        color: 'var(--on-surface)', marginBottom: 4,
      }}>
        {seat.agent_name}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--on-surface-variant)', marginBottom: 12,
      }}>
        ELO {seat.elo}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Stack', value: seat.stack },
          { label: 'Won', value: seat.hands_won },
          { label: 'WR', value: `${(seat.winrate * 100).toFixed(0)}%` },
        ].map(({ label: l, value }) => (
          <div key={l}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function streetLabel(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

// ── Extended event rows (actions + street dividers) ───────────────────────────
type ActionRow   = { type: 'action' } & import('../api/matches').HandEventInfo
type DividerRow  = { type: 'divider'; street: string; cards: string[] }
type ExtendedRow = ActionRow | DividerRow

const STREET_CARD_SLICES: Record<string, [number, number]> = {
  flop:  [0, 3],
  turn:  [3, 4],
  river: [4, 5],
}

function buildExtendedEvents(
  events: import('../api/matches').HandEventInfo[],
  communityCards: string[],
): ExtendedRow[] {
  const rows: ExtendedRow[] = []
  let lastStreet = ''
  for (const ev of events) {
    if (ev.street !== lastStreet) {
      const slice = STREET_CARD_SLICES[ev.street]
      if (slice) {
        rows.push({ type: 'divider', street: ev.street, cards: communityCards.slice(...slice) })
      }
      lastStreet = ev.street
    }
    rows.push({ type: 'action', ...ev })
  }
  return rows
}

function actionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'fold':   return 'var(--tertiary)'
    case 'raise':  return 'var(--secondary)'
    case 'bet':    return 'var(--secondary)'
    case 'call':   return 'var(--primary)'
    case 'check':  return 'var(--on-surface-variant)'
    case 'all_in': return '#f59e0b'
    default:       return 'var(--on-surface)'
  }
}

export default function MatchLivePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()

  const [data, setData]         = useState<MatchLiveInfo | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [followLive, setFollowLive] = useState(true)
  // visibleHandId = what's displayed; lags latestHandId by HAND_LINGER_MS in live mode
  const [visibleHandId, setVisibleHandId] = useState<string | null>(null)
  // how many community cards are currently revealed
  const [revealedCards, setRevealedCards] = useState(0)
  // how many events are currently revealed (for step-by-step action log)
  const [revealedEvents, setRevealedEvents] = useState(0)

  const lingerTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventsEndRef        = useRef<HTMLDivElement>(null)
  // Holds the latest counts so effect #3 can read them without adding as deps.
  const targetCardCountRef  = useRef(0)
  const targetEventCountRef = useRef(0)

  // ── 1. Poll API (clean — no state logic here) ──────────────────────────────
  useEffect(() => {
    if (!tableId) return
    const poll = () => {
      matchesApi.live(tableId)
        .then(r => { setData(r.data); setError(null) })
        .catch(() => setError('Failed to load match data'))
        .finally(() => setLoading(false))
    }
    poll()
    const iv = setInterval(poll, 1000)
    return () => clearInterval(iv)
  }, [tableId])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const latestHandId = data?.recent_hands?.length
    ? data.recent_hands[data.recent_hands.length - 1].hand_id
    : null

  const visibleHand: HandInfo | null =
    data?.recent_hands?.find(h => h.hand_id === visibleHandId) ?? null

  // Counts derived from visibleHand — computed before effects so refs stay in sync
  const targetCardCount = visibleHand?.community_cards.length ?? 0
  const extendedEvents: ExtendedRow[] = visibleHand
    ? buildExtendedEvents(visibleHand.events, visibleHand.community_cards)
    : []
  const targetEventCount = extendedEvents.length

  // ── 2. Live hand transition with linger ────────────────────────────────────
  useEffect(() => {
    if (!latestHandId) return

    if (!visibleHandId) {
      // First load — use timer so setState is in a callback, not synchronous in effect
      const t = setTimeout(() => setVisibleHandId(latestHandId), 0)
      return () => clearTimeout(t)
    }

    if (!followLive) return

    if (latestHandId !== visibleHandId && !lingerTimerRef.current) {
      // New hand arrived — wait HAND_LINGER_MS before switching
      lingerTimerRef.current = setTimeout(() => {
        setVisibleHandId(latestHandId)
        lingerTimerRef.current = null
      }, HAND_LINGER_MS)
    }
  }, [latestHandId, followLive, visibleHandId])

  useEffect(() => () => {
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
  }, [])

  // Sync refs inside effects — declared before effect #3 so they fire first
  // when visibleHandId and counts change in the same commit.
  useEffect(() => {
    targetCardCountRef.current = targetCardCount
  }, [targetCardCount])

  useEffect(() => {
    targetEventCountRef.current = targetEventCount
  }, [targetEventCount])

  // ── 3. Reset card/event reveal when visible hand changes ──────────────────
  useEffect(() => {
    // Show existing cards/events immediately; only animate NEW ones arriving.
    setRevealedCards(targetCardCountRef.current)
    setRevealedEvents(targetEventCountRef.current)
  }, [visibleHandId])

  // ── 4. Reveal community cards one by one ───────────────────────────────────
  useEffect(() => {
    if (revealedCards >= targetCardCount) return
    const t = setTimeout(() => setRevealedCards(c => c + 1), CARD_REVEAL_MS)
    return () => clearTimeout(t)
  }, [revealedCards, targetCardCount])

  // ── 5. Reveal events one by one ────────────────────────────────────────────
  useEffect(() => {
    if (revealedEvents >= targetEventCount) return
    const t = setTimeout(() => setRevealedEvents(c => c + 1), EVENT_REVEAL_MS)
    return () => clearTimeout(t)
  }, [revealedEvents, targetEventCount])

  // ── 6. Auto-scroll events ──────────────────────────────────────────────────
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [revealedEvents])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleManualSelect = (handId: string, isLatest: boolean) => {
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null }
    setVisibleHandId(handId)
    setFollowLive(isLatest)
  }

  const handleFollowLive = () => {
    if (lingerTimerRef.current) { clearTimeout(lingerTimerRef.current); lingerTimerRef.current = null }
    if (latestHandId) setVisibleHandId(latestHandId)
    setFollowLive(true)
  }

  // Is there a pending linger (visible != latest)?
  const isLingering = followLive && latestHandId !== null && latestHandId !== visibleHandId

  return (
    <AppShell>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFlip {
          0%   { opacity: 0; transform: rotateY(90deg) scale(0.8); }
          60%  { transform: rotateY(-8deg) scale(1.05); }
          100% { opacity: 1; transform: rotateY(0deg) scale(1); }
        }
        .event-new { animation: fadeSlideIn 0.25s ease-out; }
        .card-new  { animation: cardFlip 0.4s ease-out; }
      `}</style>

      <div style={{ maxWidth: 960 }}>
        <button
          onClick={() => navigate('/matches')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 12,
            color: 'var(--on-surface-variant)', marginBottom: 20, padding: 0,
          }}
        >
          <ArrowLeft size={14} />
          Back to Matches
        </button>

        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Loading match data...
          </div>
        ) : error || !data ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--tertiary)' }}>
            {error ?? 'Match not found'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Monitor size={18} style={{ color: 'var(--primary)' }} />
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  {data.arena.name} Arena
                </h1>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                  BLINDS {data.arena.small_blind}/{data.arena.big_blind} {'\u00B7'} HANDS {data.hands_played}
                </div>
              </div>
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                padding: '4px 10px', borderRadius: 3,
                background: data.status === 'active' ? 'rgba(52,211,153,0.1)' : 'rgba(124,127,255,0.08)',
                color: data.status === 'active' ? 'var(--secondary)' : 'var(--primary-container)',
                border: `1px solid ${data.status === 'active' ? 'rgba(52,211,153,0.2)' : 'rgba(124,127,255,0.15)'}`,
              }}>
                {data.status}
              </span>
            </div>

            {/* Seats */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <SeatCard label="Seat 1" seat={data.seat_1} />
              <SeatCard label="Seat 2" seat={data.seat_2} />
            </div>

            {/* Hand panel */}
            {visibleHand && (
              <div style={{
                marginBottom: 20, padding: 16,
                background: 'var(--surface-low)',
                border: `1px solid ${followLive ? 'rgba(52,211,153,0.25)' : 'var(--outline)'}`,
                borderRadius: 4,
                transition: 'border-color 0.3s',
              }}>
                {/* Hand header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--on-surface-variant)' }}>
                      Hand #{visibleHand.hand_number} {'\u00B7'} {visibleHand.phase}
                    </div>
                    {followLive && !isLingering && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                        color: 'var(--secondary)', padding: '2px 6px', borderRadius: 3,
                        background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                      }}>
                        <Radio size={8} /> Live
                      </span>
                    )}
                    {isLingering && (
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                        color: 'var(--on-surface-variant)', padding: '2px 6px', borderRadius: 3,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--outline)',
                      }}>
                        Next hand starting...
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!followLive && (
                      <button
                        onClick={handleFollowLive}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                          color: 'var(--secondary)', background: 'rgba(52,211,153,0.08)',
                          border: '1px solid rgba(52,211,153,0.2)', borderRadius: 3,
                          padding: '3px 8px', cursor: 'pointer',
                        }}
                      >
                        Follow Live
                      </button>
                    )}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--secondary)' }}>
                      Pot: {visibleHand.pot}
                    </div>
                  </div>
                </div>

                {/* Community cards — revealed one by one */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                    Community
                  </div>
                  <div style={{ display: 'flex', gap: 6, minHeight: 48, alignItems: 'center' }}>
                    {visibleHand.community_cards.length === 0 ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                        No community cards yet
                      </span>
                    ) : (
                      visibleHand.community_cards.slice(0, revealedCards).map((c, i) => (
                        <CardDisplay key={i} card={c} isNew={i === revealedCards - 1} />
                      ))
                    )}
                  </div>
                </div>

                {/* Hole cards */}
                <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                  {[
                    { label: `Seat 1 (${data.seat_1?.agent_name ?? '?'})`, cards: visibleHand.player_1_hole },
                    { label: `Seat 2 (${data.seat_2?.agent_name ?? '?'})`, cards: visibleHand.player_2_hole },
                  ].map(({ label, cards }) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                        {label}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {cards.length > 0
                          ? cards.map((c, i) => <CardDisplay key={i} card={c} />)
                          : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>--</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Winner */}
                {visibleHand.winner_seat && (
                  <div style={{
                    marginBottom: 12, paddingBottom: 12,
                    borderBottom: '1px solid var(--outline)',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--secondary)',
                  }}>
                    Winner: Seat {visibleHand.winner_seat}
                    {visibleHand.winning_hand_rank && ` \u00B7 ${visibleHand.winning_hand_rank.replace(/_/g, ' ')}`}
                  </div>
                )}

                {/* Events */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                    Actions
                  </div>
                  {revealedEvents === 0 ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                      Waiting for actions...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
                      {extendedEvents.slice(0, revealedEvents).map((row, idx) => {
                        const isNew = idx === revealedEvents - 1
                        if (row.type === 'divider') {
                          return (
                            <div
                              key={`divider-${row.street}`}
                              className={isNew ? 'event-new' : undefined}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                marginTop: 4, marginBottom: 2,
                                fontFamily: 'var(--font-mono)', fontSize: 9,
                                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                                color: 'var(--primary)',
                              }}
                            >
                              <span style={{
                                width: 40, fontWeight: 700,
                              }}>
                                {streetLabel(row.street)}
                              </span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {row.cards.length > 0
                                  ? row.cards.map((c, i) => <CardDisplay key={i} card={c} isNew={isNew} />)
                                  : <span style={{ color: 'var(--on-surface-variant)', fontSize: 9 }}>—</span>
                                }
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div
                            key={row.sequence}
                            className={isNew ? 'event-new' : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              fontFamily: 'var(--font-mono)', fontSize: 11,
                              padding: '3px 6px', borderRadius: 3,
                              background: isNew ? 'rgba(124,127,255,0.06)' : 'transparent',
                              transition: 'background 0.5s',
                            }}
                          >
                            <span style={{ width: 44, color: 'var(--on-surface-variant)' }}>Seat {row.player_seat}</span>
                            <span style={{ fontWeight: 600, color: actionColor(row.action), textTransform: 'uppercase' as const, fontSize: 10, width: 52 }}>{row.action}</span>
                            {row.amount > 0 && <span style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{row.amount}</span>}
                            <span style={{ marginLeft: 'auto', color: 'var(--on-surface-variant)', fontSize: 10 }}>pot {row.pot_after}</span>
                          </div>
                        )
                      })}
                      <div ref={eventsEndRef} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent hands list */}
            {data.recent_hands.length > 0 ? (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                  Recent Hands
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--outline)', borderRadius: 4 }}>
                  {[...data.recent_hands].reverse().map(hand => {
                    const isSelected = hand.hand_id === visibleHandId
                    const isLatest   = hand.hand_id === latestHandId
                    return (
                      <button
                        key={hand.hand_id}
                        onClick={() => handleManualSelect(hand.hand_id, isLatest)}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 14px', textAlign: 'left',
                          background: isSelected ? 'rgba(124,127,255,0.08)' : 'var(--surface-low)',
                          borderBottom: '1px solid var(--outline)',
                          border: 'none',
                          borderLeft: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--on-surface)', width: 60 }}>
                          #{hand.hand_number}
                        </span>
                        {isLatest && !hand.winner_seat && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--secondary)', marginRight: 8, letterSpacing: '0.08em' }}>
                            IN PLAY
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', width: 70 }}>
                          Pot {hand.pot}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', flex: 1 }}>
                          {hand.community_cards.join(' ')}
                        </span>
                        {hand.winner_seat && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--secondary)' }}>
                            S{hand.winner_seat} wins
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{
                padding: '30px 20px', textAlign: 'center',
                background: 'var(--surface-low)', border: '1px solid var(--outline)', borderRadius: 4,
                fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)',
              }}>
                No hands played yet
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
