import { useEffect, useState, useCallback } from 'react'
import { Shield, TrendingUp, Activity, Bot } from 'lucide-react'
import AppShell from '../components/AppShell'
import AgentCard from '../components/AgentCard'
import { useAuth } from '../context/AuthContext'
import { listAgents, type Agent } from '../api/agents'
import { walletApi, type WalletInfo } from '../api/wallet'
import client from '../api/client'

interface RecentSession {
  session_id: string
  arena_name: string
  rival_agent: string | null
  hands_played: number
  profit: number
  elo_change: number
  completed_at: string | null
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960 },
  hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  h1: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 24 },
  kpiCell: { background: 'var(--surface-container)', padding: '18px 16px' },
  kpiVal: { fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', marginTop: 6 },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  const loadData = useCallback(async () => {
    try {
      const [agentsRes, walletRes] = await Promise.all([
        listAgents(),
        walletApi.get(),
      ])
      const agentList: Agent[] = Array.isArray(agentsRes.data) ? agentsRes.data : (agentsRes.data as unknown as { agents: Agent[] }).agents ?? []
      setAgents(agentList)
      setWallet(walletRes.data)

      // Collect recent sessions from all agents (first 5)
      const allSessions: RecentSession[] = []
      for (const agent of agentList.slice(0, 5)) {
        try {
          const histRes = await client.get(`/agent/history?agent_id=${agent.id}&limit=3&offset=0`)
          const sessions = histRes.data?.sessions ?? []
          for (const s of sessions) {
            allSessions.push(s)
          }
        } catch {
          // skip
        }
      }
      allSessions.sort((a, b) => {
        const da = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const db = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return db - da
      })
      setRecentSessions(allSessions.slice(0, 5))
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [loadData])

  const kpis = [
    {
      label: 'Balance',
      value: `\u2659 ${wallet?.balance?.toLocaleString() ?? user?.balance?.toLocaleString() ?? 0}`,
      sub: wallet && wallet.locked_balance > 0 ? `\u2659 ${wallet.locked_balance.toLocaleString()} locked` : undefined,
      color: 'var(--secondary)',
      icon: Shield,
    },
    {
      label: 'ELO Rating',
      value: user?.elo ?? 1000,
      color: 'var(--primary)',
      icon: TrendingUp,
    },
    {
      label: 'Active Agents',
      value: agents.length,
      sub: `${agents.filter(a => a.status === 'playing').length} playing`,
      color: 'var(--primary-container)',
      icon: Activity,
    },
  ]

  return (
    <AppShell>
      <div style={S.page}>
        {/* Header */}
        <div style={S.hdr}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Dashboard</div>
            <h1 style={S.h1}>
              Welcome back, {user?.username ?? 'User'}
            </h1>
          </div>
        </div>

        {/* KPI strip */}
        <div style={S.kpiGrid}>
          {kpis.map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} style={S.kpiCell}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label">{label}</span>
                <Icon size={13} style={{ color, opacity: 0.7 }} />
              </div>
              <div style={{ ...S.kpiVal, color }}>{value}</div>
              {sub && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                  {sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agents grid */}
        <div style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 16 }}>Your Agents</div>
          {agents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Bot size={28} style={{ color: 'var(--outline)', margin: '0 auto 10px' }} />
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                No agents yet. Create one via the API:
              </p>
              <pre style={{
                marginTop: 12, padding: 12,
                background: 'var(--surface-container)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--primary-container)',
                display: 'inline-block', textAlign: 'left',
              }}>
                POST /api/agent/create {`{"name": "my-agent"}`}
              </pre>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>Recent Sessions</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Arena</th>
                  <th>Rival</th>
                  <th>Result</th>
                  <th>Profit</th>
                  <th>ELO Change</th>
                  <th>Hands</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s, idx) => (
                  <tr key={s.session_id ?? idx}>
                    <td style={{ color: 'var(--on-surface-2)' }}>{s.arena_name ?? '\u2014'}</td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>{s.rival_agent ?? '\u2014'}</td>
                    <td>
                      <span className={`badge ${s.profit > 0 ? 'badge-mint' : s.profit < 0 ? 'badge-crimson' : 'badge-grey'}`}>
                        {s.profit > 0 ? 'WIN' : s.profit < 0 ? 'LOSS' : 'DRAW'}
                      </span>
                    </td>
                    <td className="text-numeric" style={{ fontWeight: 700, color: s.profit >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                      {s.profit >= 0 ? '+' : ''}{s.profit}
                    </td>
                    <td className="text-numeric" style={{ color: (s.elo_change ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                      {(s.elo_change ?? 0) >= 0 ? '+' : ''}{s.elo_change ?? 0}
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{s.hands_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
