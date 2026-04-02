import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Monitor, Radio } from 'lucide-react'
import AppShell from '../components/AppShell'
import { matchesApi, type MatchLiveInfo, type HandInfo } from '../api/matches'

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
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
      width: 36, height: 48, borderRadius: 4,
      background: isNew ? 'rgba(124,127,255,0.12)' : 'var(--surface-container)',
      border: `1px solid ${isNew ? 'var(--primary)' : 'var(--outline)'}`,
      color: suit.color,
      letterSpacing: '-0.02em',
      transition: 'background 0.4s, border-color 0.4s',
    }}>
      {rank}{suit.symbol}
    </span>
  )
}

function SeatCard({ label, seat }: {
  label: string
  seat: MatchLiveInfo['seat_1']
}) {
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
        {seat.username} {'\u00B7'} ELO {seat.elo}
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

function streetLabel(street: string): string {
  return street.charAt(0).toUpperCase() + street.slice(1)
}

function actionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'fold': return 'var(--tertiary)'
    case 'raise': return 'var(--secondary)'
    case 'bet': return 'var(--secondary)'
    case 'call': return 'var(--primary)'
    case 'check': return 'var(--on-surface-variant)'
    case 'all_in': return '#f59e0b'
    default: return 'var(--on-surface)'
  }
}

export default function MatchLivePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<MatchLiveInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null)
  const [followLive, setFollowLive] = useState(true)
  const [newEventSeqs, setNewEventSeqs] = useState<Set<number>>(new Set())
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set())
  const prevHandRef = useRef<HandInfo | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tableId) return

    const fetchLive = () => {
      matchesApi.live(tableId)
        .then(r => {
          setData(prev => {
            const next = r.data

            // Figure out which hand to show
            if (next.recent_hands?.length) {
              const latestHand = next.recent_hands[next.recent_hands.length - 1]

              if (followLive || !selectedHandId) {
                setSelectedHandId(latestHand.hand_id)
              }

              // Detect new events on the currently shown hand
              const prevHand = prevHandRef.current
              const shown = next.recent_hands.find(h =>
                h.hand_id === (followLive ? latestHand.hand_id : selectedHandId)
              )
              if (shown && prevHand && prevHand.hand_id === shown.hand_id) {
                const prevSeqs = new Set(prevHand.events.map(e => e.sequence))
                const added = shown.events.filter(e => !prevSeqs.has(e.sequence))
                if (added.length) {
                  setNewEventSeqs(new Set(added.map(e => e.sequence)))
                  setTimeout(() => setNewEventSeqs(new Set()), 2000)
                }

                // Detect new community cards
                const prevCount = prevHand.community_cards.length
                if (shown.community_cards.length > prevCount) {
                  const indices = new Set<number>()
                  for (let i = prevCount; i < shown.community_cards.length; i++) indices.add(i)
                  setNewCardIndices(indices)
                  setTimeout(() => setNewCardIndices(new Set()), 2000)
                }
              } else if (shown && (!prevHand || prevHand.hand_id !== shown.hand_id)) {
                // New hand started — all cards are "new"
                if (shown.community_cards.length > 0) {
                  setNewCardIndices(new Set(shown.community_cards.map((_, i) => i)))
                  setTimeout(() => setNewCardIndices(new Set()), 2000)
                }
                setNewEventSeqs(new Set(shown.events.map(e => e.sequence)))
                setTimeout(() => setNewEventSeqs(new Set()), 2000)
              }

              prevHandRef.current = shown ?? null
            }

            return next
          })
          setError(null)
        })
        .catch(() => setError('Failed to load match data'))
        .finally(() => setLoading(false))
    }

    fetchLive()
    const interval = setInterval(fetchLive, 2000)
    return () => clearInterval(interval)
  }, [tableId, followLive, selectedHandId])

  // Auto-scroll events to bottom when new ones arrive
  useEffect(() => {
    if (newEventSeqs.size > 0) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [newEventSeqs])

  const latestHandId = data?.recent_hands?.length
    ? data.recent_hands[data.recent_hands.length - 1].hand_id
    : null

  const displayHandId = followLive ? latestHandId : selectedHandId
  const selectedHand = data?.recent_hands?.find(h => h.hand_id === displayHandId) ?? null

  return (
    <AppShell>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .event-new { animation: fadeSlideIn 0.25s ease-out; }
      `}</style>

      <div style={{ maxWidth: 960 }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/matches')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 12,
            color: 'var(--on-surface-variant)', marginBottom: 20,
            padding: 0,
          }}
        >
          <ArrowLeft size={14} />
          Back to Matches
        </button>

        {loading ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: 'var(--on-surface-variant)',
          }}>
            Loading match data...
          </div>
        ) : error || !data ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: 13,
            color: 'var(--tertiary)',
          }}>
            {error ?? 'Match not found'}
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Monitor size={18} style={{ color: 'var(--primary)' }} />
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
                  color: 'var(--on-surface)', letterSpacing: '-0.02em',
                }}>
                  {data.arena.name} Arena
                </h1>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: 'var(--on-surface-variant)', marginTop: 2,
                }}>
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

            {/* Live hand panel */}
            {selectedHand && (
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
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                      color: 'var(--on-surface-variant)',
                    }}>
                      Hand #{selectedHand.hand_number} {'\u00B7'} {selectedHand.phase}
                    </div>
                    {followLive && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                        color: 'var(--secondary)',
                        padding: '2px 6px', borderRadius: 3,
                        background: 'rgba(52,211,153,0.1)',
                        border: '1px solid rgba(52,211,153,0.2)',
                      }}>
                        <Radio size={8} />
                        Live
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!followLive && (
                      <button
                        onClick={() => setFollowLive(true)}
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
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                      color: 'var(--secondary)',
                    }}>
                      Pot: {selectedHand.pot}
                    </div>
                  </div>
                </div>

                {/* Community cards */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)',
                    marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  }}>
                    Community
                  </div>
                  <div style={{ display: 'flex', gap: 6, minHeight: 48, alignItems: 'center' }}>
                    {selectedHand.community_cards.length > 0 ? (
                      selectedHand.community_cards.map((c, i) => (
                        <CardDisplay key={i} card={c} isNew={newCardIndices.has(i)} />
                      ))
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                        No community cards yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Hole cards */}
                <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                  {[
                    { label: `Seat 1 (${data.seat_1?.agent_name ?? '?'})`, cards: selectedHand.player_1_hole },
                    { label: `Seat 2 (${data.seat_2?.agent_name ?? '?'})`, cards: selectedHand.player_2_hole },
                  ].map(({ label, cards }) => (
                    <div key={label}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)',
                        marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                      }}>
                        {label}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {cards.length > 0 ? (
                          cards.map((c, i) => <CardDisplay key={i} card={c} />)
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>--</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Winner info */}
                {selectedHand.winner_seat && (
                  <div style={{
                    marginBottom: 12, paddingBottom: 12,
                    borderBottom: '1px solid var(--outline)',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--secondary)',
                  }}>
                    Winner: Seat {selectedHand.winner_seat}
                    {selectedHand.winning_hand_rank && ` \u00B7 ${selectedHand.winning_hand_rank.replace(/_/g, ' ')}`}
                  </div>
                )}

                {/* Events */}
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--on-surface-variant)',
                    marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                  }}>
                    Actions
                  </div>
                  {selectedHand.events.length === 0 ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                      Waiting for actions...
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 3,
                      maxHeight: 220, overflowY: 'auto',
                    }}>
                      {selectedHand.events.map(ev => {
                        const isNew = newEventSeqs.has(ev.sequence)
                        return (
                          <div
                            key={ev.sequence}
                            className={isNew ? 'event-new' : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              fontFamily: 'var(--font-mono)', fontSize: 11,
                              padding: '3px 6px', borderRadius: 3,
                              background: isNew ? 'rgba(124,127,255,0.06)' : 'transparent',
                              transition: 'background 0.5s',
                            }}
                          >
                            <span style={{
                              width: 52, fontSize: 9, color: 'var(--on-surface-variant)',
                              textTransform: 'uppercase' as const,
                            }}>
                              {streetLabel(ev.street)}
                            </span>
                            <span style={{ width: 44, color: 'var(--on-surface-variant)' }}>
                              Seat {ev.player_seat}
                            </span>
                            <span style={{
                              fontWeight: 600, color: actionColor(ev.action),
                              textTransform: 'uppercase' as const, fontSize: 10,
                              width: 52,
                            }}>
                              {ev.action}
                            </span>
                            {ev.amount > 0 && (
                              <span style={{ color: 'var(--on-surface)', fontWeight: 600 }}>
                                {ev.amount}
                              </span>
                            )}
                            <span style={{ marginLeft: 'auto', color: 'var(--on-surface-variant)', fontSize: 10 }}>
                              pot {ev.pot_after}
                            </span>
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
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                  color: 'var(--on-surface-variant)', marginBottom: 8,
                }}>
                  Recent Hands
                </div>
                <div style={{
                  maxHeight: 220, overflowY: 'auto',
                  border: '1px solid var(--outline)', borderRadius: 4,
                }}>
                  {[...data.recent_hands].reverse().map(hand => {
                    const isSelected = hand.hand_id === displayHandId
                    const isLatest = hand.hand_id === latestHandId
                    return (
                      <button
                        key={hand.hand_id}
                        onClick={() => {
                          setSelectedHandId(hand.hand_id)
                          setFollowLive(isLatest)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          padding: '10px 14px', textAlign: 'left',
                          background: isSelected ? 'rgba(124,127,255,0.08)' : 'var(--surface-low)',
                          borderBottom: '1px solid var(--outline)',
                          border: 'none',
                          borderLeft: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                      >
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                          color: 'var(--on-surface)', width: 60,
                        }}>
                          #{hand.hand_number}
                        </span>
                        {isLatest && !hand.winner_seat && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                            color: 'var(--secondary)', marginRight: 8,
                            letterSpacing: '0.08em',
                          }}>
                            IN PLAY
                          </span>
                        )}
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: 'var(--on-surface-variant)', width: 70,
                        }}>
                          Pot {hand.pot}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: 'var(--on-surface-variant)', flex: 1,
                        }}>
                          {hand.community_cards.join(' ')}
                        </span>
                        {hand.winner_seat && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                            color: 'var(--secondary)',
                          }}>
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
                background: 'var(--surface-low)',
                border: '1px solid var(--outline)',
                borderRadius: 4,
                fontFamily: 'var(--font-display)', fontSize: 13,
                color: 'var(--on-surface-variant)',
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
