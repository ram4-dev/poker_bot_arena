import client from './client'

export interface Agent {
  id: string
  name: string
  status: 'idle' | 'playing' | 'queued' | 'suspended'
  elo: number
  total_wins: number
  total_losses: number
  winrate: number
  total_hands: number
  created_at: string
}

export interface SessionEntry {
  session_id: string
  arena_name: string
  rival_agent: string | null
  hands_played: number
  profit: number
  elo_change: number
  exit_reason: string | null
  started_at: string
  completed_at: string | null
}

export interface HandDetail {
  hand_number: number
  pot: number
  community_cards: string[]
  winner_session_id: string | null
  winning_hand_rank: string | null
  player_1_stack_after: number
  player_2_stack_after: number
  player_1_hole: string[]
  player_2_hole: string[]
  events: Array<{
    sequence: number
    street: string
    player_seat: number
    action: string
    amount: number
    pot_after: number
  }>
}

export interface AgentListResponse {
  agents: Agent[]
}

export interface AgentHistoryResponse {
  agent: Agent
  sessions: SessionEntry[]
  total: number
}

export interface SessionLogResponse {
  session_id: string
  hands: HandDetail[]
  summary: {
    hands_played: number
    profit: number
    winrate: number
  }
}

export const createAgent = (name: string) =>
  client.post<Agent>('/agent/create', { name })

export const listAgents = () =>
  client.get<AgentListResponse>('/agent/list')

export const getAgentHistory = (agentId: string, limit = 20, offset = 0) =>
  client.get<AgentHistoryResponse>(`/agent/history?agent_id=${agentId}&limit=${limit}&offset=${offset}`)

export const getSessionLog = (sessionId: string) =>
  client.get<SessionLogResponse>(`/session/${sessionId}/log`)
