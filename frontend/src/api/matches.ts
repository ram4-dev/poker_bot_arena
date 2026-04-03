import client from './client'

export interface SeatInfo {
  label: string
  agent_name: string
  elo: number
  stack: number
  initial_stack: number
  hands_won: number
  winrate: number
}

export interface ArenaInfo {
  name: string
  slug: string
  small_blind: number
  big_blind: number
}

export interface MatchInfo {
  table_id: string
  arena: ArenaInfo
  hands_played: number
  started_at: string
  seat_1: SeatInfo | null
  seat_2: SeatInfo | null
  winner?: 'seat_1' | 'seat_2' | 'draw'
}

export interface HandEventInfo {
  sequence: number
  street: string
  player_seat: number
  action: string
  amount: number
  pot_after: number
}

export interface HandInfo {
  hand_id: string
  hand_number: number
  phase: string
  pot: number
  community_cards: string[]
  winner_seat: number | null
  winning_hand_rank: string | null
  player_1_stack_after: number | null
  player_2_stack_after: number | null
  player_1_hole: string[]
  player_2_hole: string[]
  events: HandEventInfo[]
}

export interface MatchLiveInfo extends MatchInfo {
  status: string
  recent_hands: HandInfo[]
}

export interface MatchListResponse {
  active: MatchInfo[]
  recently_completed: MatchInfo[]
  total_active: number
}

export const matchesApi = {
  list: () => client.get<MatchListResponse>('/matches'),
  live: (tableId: string) => client.get<MatchLiveInfo>(`/matches/${tableId}/live`),
}
