import api from './client'

export interface BotConfig {
  hand_threshold: number
  raise_tendency: number
  three_bet_frequency: number
  aggression: number
  bluff_frequency: number
  fold_to_pressure: number
  continuation_bet: number
  bet_size_tendency: number
  overbet_willingness: number
  risk_tolerance: number
  survival_priority: number
  adaptation_speed: number
  leave_threshold_up: number
  leave_threshold_down: number
  min_hands_before_leave: number
  rebuy_willingness: number
  session_max_hands: number
}

export interface BotVersion {
  id: string
  version_number: number
  config_json: BotConfig   // aliased: backend sends "config", we remap in the API layer
  preset_origin: string | null
  wins: number
  losses: number
  hands_played: number
  total_profit: number
  created_at: string
}

export interface Bot {
  id: string
  name: string
  avatar: string | null
  status: 'idle' | 'queued' | 'playing' | 'paused'
  elo: number
  total_wins: number
  total_losses: number
  total_hands: number
  winrate: number
  active_version: BotVersion | null
  created_at: string
  // derived helpers used by components
  wins: number
  losses: number
  total_sessions: number
}

export interface CreateBotPayload {
  name: string
  avatar?: string
  preset?: string
}

export const botsApi = {
  list: () =>
    api.get<{ bots: any[]; stats: any }>('/bots').then(r => ({
      ...r,
      data: r.data.bots.map(normalizeBot) as Bot[],
    })),

  get: (id: string) =>
    api.get<any>(`/bots/${id}`).then(r => ({ ...r, data: normalizeBot(r.data) as Bot })),

  create: (data: CreateBotPayload) =>
    api.post<any>('/bots', { name: data.name, avatar: data.avatar ?? 'bot_default', preset: data.preset ?? 'balanced' })
      .then(r => ({ ...r, data: normalizeBot(r.data) as Bot })),

  update: (id: string, data: Partial<CreateBotPayload>) =>
    api.put<any>(`/bots/${id}`, data).then(r => ({ ...r, data: normalizeBot(r.data) as Bot })),

  delete: (id: string) => api.delete(`/bots/${id}`),

  getVersions: (id: string) =>
    api.get<{ versions: any[] }>(`/bots/${id}/versions`).then(r => ({
      ...r,
      data: r.data.versions.map(normalizeVersion) as BotVersion[],
    })),

  createVersion: (id: string, config: BotConfig) =>
    api.post<any>(`/bots/${id}/versions`, { config })
      .then(r => ({ ...r, data: normalizeVersion(r.data) as BotVersion })),
}

function normalizeVersion(v: any): BotVersion {
  return {
    ...v,
    config_json: v.config ?? v.config_json ?? {},
  }
}

function normalizeBot(b: any): Bot {
  return {
    ...b,
    // alias helpers for legacy component usage
    wins: b.total_wins ?? b.wins ?? 0,
    losses: b.total_losses ?? b.losses ?? 0,
    total_sessions: b.total_hands ?? b.total_sessions ?? 0,
    active_version: b.active_version ? normalizeVersion(b.active_version) : null,
  }
}
