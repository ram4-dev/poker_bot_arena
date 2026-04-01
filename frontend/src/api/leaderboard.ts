import api from './client'

export interface LeaderboardItem {
  rank: number
  entity_id: string
  name: string
  elo: number
  winrate: number
  total_wins: number
  total_losses: number
  badges: string[]
  // bots only
  creator?: string
}

export interface LeaderboardResponse {
  items: LeaderboardItem[]
  total: number
  season: string
  my_position?: { rank: number; username: string; elo: number }
}

export interface SeasonsResponse {
  current: string
  available: string[]
}

export const leaderboardApi = {
  users: (season?: string) =>
    api.get<LeaderboardResponse>(`/leaderboard/users${season ? `?season=${season}` : ''}`),
  bots: (season?: string) =>
    api.get<LeaderboardResponse>(`/leaderboard/bots${season ? `?season=${season}` : ''}`),
  seasons: () => api.get<SeasonsResponse>('/leaderboard/seasons'),
}
