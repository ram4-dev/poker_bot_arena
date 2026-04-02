import client from './client'

export const getPokerSkill = () =>
  client.get<{ content: string; url: string }>('/poker-skill')

export const getArenas = () =>
  client.get<{ arenas: Array<{
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
  }> }>('/arenas')
