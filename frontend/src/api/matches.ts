import client from './client'

export interface MatchSeat {
  session_id: string
  bot_id: string
  bot_name: string
  username: string
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

export interface ActiveMatch {
  table_id: string
  arena: ArenaInfo
  hands_played: number
  started_at: string
  seat_1: MatchSeat
  seat_2: MatchSeat
}

export interface CompletedMatch {
  table_id: string
  arena: ArenaInfo
  hands_played: number
  completed_at: string | null
  winner: 'seat_1' | 'seat_2' | 'draw'
  seat_1: MatchSeat
  seat_2: MatchSeat
}

export interface MatchesResponse {
  active: ActiveMatch[]
  recently_completed: CompletedMatch[]
  total_active: number
}

export const getMatches = (): Promise<MatchesResponse> =>
  client.get('/matches').then(r => r.data)

export interface LiveHandEvent {
  sequence: number
  street: string
  player_seat: 1 | 2
  action: string
  amount: number
  pot_after: number
  hand_strength: number | null
  hole_cards: string[]
}

export interface LiveHand {
  hand_number: number
  pot: number
  community_cards: string[]
  winner_seat: 1 | 2 | null
  winning_hand_rank: string | null
  player_1_stack_after: number
  player_2_stack_after: number
  player_1_hole: string[]
  player_2_hole: string[]
  events: LiveHandEvent[]
}

export interface LiveMatchResponse {
  table_id: string
  status: string
  arena: ArenaInfo
  hands_played: number
  seat_1: MatchSeat | null
  seat_2: MatchSeat | null
  recent_hands: LiveHand[]
}

export const getLiveMatch = (tableId: string): Promise<LiveMatchResponse> =>
  client.get(`/matches/${tableId}/live`).then(r => r.data)
