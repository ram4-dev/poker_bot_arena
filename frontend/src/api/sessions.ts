import api from './client'

export interface SessionSummary {
  id: string
  bot_id?: string
  arena_id?: string
  arena_name: string
  bot_name: string
  opponent_bot_name: string | null
  status: 'queued' | 'playing' | 'completed' | 'cancelled'
  profit: number | null
  hands_played: number
  hands_won: number
  exit_reason: string | null
  elo_change: number | null
  completed_at: string | null
}

export interface HandEvent {
  sequence: number
  street: string
  player_seat: number
  action: string
  amount: number
  pot_after: number
  hand_strength: number | null
  hole_cards: string[]
}

export interface Hand {
  hand_number: number
  pot: number
  winner_session_id: string | null
  community_cards: string[]
  winning_hand_rank: string | null
  player_1_stack_after: number
  player_2_stack_after: number
  player_1_hole: string[]
  player_2_hole: string[]
  events: HandEvent[]
}

export interface SessionDetail {
  id: string
  status: string
  arena_name: string
  bot_name: string
  bot_version: number
  opponent_bot_name: string | null
  opponent_user: string | null
  outcome: 'victory' | 'defeat' | 'draw' | null
  kpis: {
    profit: number
    winrate: number
    elo_change: number
    hands_played: number
    hands_won: number
  }
  performance: Array<{ hand: number; profit: number; cumulative: number }>
  insights: {
    strengths: string[]
    vulnerabilities: string[]
    advisory: string
    fold_rate: number
    aggression_rate: number
  } | null
  key_events: Array<{
    type: string
    message: string
    hand_number?: number
    data?: Record<string, unknown>
  }>
  rivals: Array<{ bot_name: string; user: string | null; outcome: string }>
  hands: Hand[]
}

export const sessionsApi = {
  list: (offset = 0, limit = 20) =>
    api.get<{ items: SessionSummary[]; total: number; limit: number; offset: number }>(
      `/sessions?offset=${offset}&limit=${limit}`
    ),
  get: (id: string) => api.get<SessionDetail>(`/sessions/${id}`),
}
