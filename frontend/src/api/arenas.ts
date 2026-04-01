import api from './client'

export interface Arena {
  id: string
  name: string
  slug: string
  buy_in: number
  small_blind: number
  big_blind: number
  reward_multiplier: number
  is_practice: boolean
  stats: {
    bots_in_queue: number
    active_tables: number
    estimated_reward: number
  }
}

export const arenasApi = {
  list: () => api.get<{ arenas: Arena[] }>('/arenas'),

  queue: (arena_id: string, bot_id: string) =>
    api.post(`/arenas/${arena_id}/queue`, { bot_id }),

  dequeue: (arena_id: string, session_id: string) =>
    api.delete(`/arenas/${arena_id}/queue/${session_id}`),
}
