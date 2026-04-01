import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Zap, TrendingUp, Shield, Activity, Bot } from 'lucide-react'
import AppShell from '../components/AppShell'
import { useAuth } from '../context/AuthContext'
import { sessionsApi, type SessionSummary } from '../api/sessions'
import { botsApi, type Bot as BotType } from '../api/bots'

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960 },
  hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  h1: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' },
  sub: { fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 24 },
  kpiCell: { background: 'var(--surface-container)', padding: '18px 16px' },
  kpiVal: { fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', marginTop: 6 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([])
  const [bots, setBots] = useState<BotType[]>([])

  useEffect(() => {
    sessionsApi.list(0, 10).then(r => setRecentSessions(r.data.items)).catch(() => {})
    botsApi.list().then(r => setBots(r.data)).catch(() => {})
  }, [])

  const totalWins   = recentSessions.filter(s => (s.profit ?? 0) > 0).length
  const totalLosses = recentSessions.filter(s => (s.profit ?? 0) < 0).length

  const dayMap: Record<string, { wins: number; losses: number }> = {}
  recentSessions.forEach(s => {
    if (!s.completed_at) return
    const d = new Date(s.completed_at).toLocaleDateString('en', { weekday: 'short' })
    if (!dayMap[d]) dayMap[d] = { wins: 0, losses: 0 }
    if ((s.profit ?? 0) > 0) dayMap[d].wins++
    if ((s.profit ?? 0) < 0) dayMap[d].losses++
  })
  const chartData = Object.entries(dayMap).slice(-7).map(([day, v]) => ({ day, ...v }))

  const activeBot = bots.find(b => b.status === 'playing') ?? bots[0]

  const kpis = [
    { label: 'Balance',      value: `♟ ${user?.balance?.toLocaleString() ?? 0}`, color: 'var(--secondary)',   icon: Shield },
    { label: 'ELO Rating',   value: user?.elo ?? 1000,                             color: 'var(--primary)',    icon: TrendingUp },
    { label: 'Sessions Won', value: totalWins,                                      color: 'var(--secondary)',  icon: Activity },
    { label: 'Sessions Lost',value: totalLosses,                                    color: 'var(--tertiary)',   icon: Activity },
  ]

  return (
    <AppShell>
      <div style={S.page}>
        {/* Header */}
        <div style={S.hdr}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Command Center</div>
            <h1 style={S.h1}>
              Welcome back, {user?.username ?? 'Architect'}
            </h1>
          </div>
          <Link to="/battle" className="btn-primary">
            <Zap size={14} /> Deploy Bot
          </Link>
        </div>

        {/* KPI strip */}
        <div style={S.kpiGrid}>
          {kpis.map(({ label, value, color, icon: Icon }) => (
            <div key={label} style={S.kpiCell}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label">{label}</span>
                <Icon size={13} style={{ color, opacity: 0.7 }} />
              </div>
              <div style={{ ...S.kpiVal, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Main 2-col */}
        <div style={S.twoCol}>
          {/* Performance chart */}
          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>Performance Trend</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={2}>
                  <XAxis dataKey="day" tick={{ fill: 'var(--on-surface-variant)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: 'var(--surface-high)', border: '1px solid var(--outline)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }} labelStyle={{ color: 'var(--on-surface)' }} />
                  <Bar dataKey="wins"   fill="var(--secondary)" radius={[2,2,0,0]} name="Wins" />
                  <Bar dataKey="losses" fill="rgba(255,107,107,0.4)" radius={[2,2,0,0]} name="Losses" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <Activity size={28} style={{ color: 'var(--outline)', margin: '0 auto 8px' }} />
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                    No battle data yet
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4, opacity: 0.6 }}>
                    DEPLOY A BOT TO START
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Active bot */}
          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>Active Unit</div>
            {activeBot ? (
              <div>
                <div style={{
                  width: 48, height: 48, borderRadius: 4, marginBottom: 12,
                  background: 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--glow-primary)',
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: '#fff' }}>
                    {activeBot.name[0]}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--on-surface)', marginBottom: 8 }}>
                  {activeBot.name}
                </div>
                <span className={`badge ${activeBot.status === 'playing' ? 'badge-indigo status-in-battle' : 'badge-grey status-idle'}`}>
                  {activeBot.status === 'playing' ? 'In Battle' : 'Idle'}
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--outline)', marginTop: 16 }}>
                  <div style={{ background: 'var(--surface-container)', padding: '10px 12px', textAlign: 'center' }}>
                    <div className="label" style={{ marginBottom: 4 }}>ELO</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
                      {activeBot.elo}
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface-container)', padding: '10px 12px', textAlign: 'center' }}>
                    <div className="label" style={{ marginBottom: 4 }}>W / L</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                      <span style={{ color: 'var(--secondary)' }}>{activeBot.wins}</span>
                      <span style={{ color: 'var(--outline)', margin: '0 3px' }}>/</span>
                      <span style={{ color: 'var(--tertiary)' }}>{activeBot.losses}</span>
                    </div>
                  </div>
                </div>

                <Link to={`/bots/${activeBot.id}`} className="btn-ghost" style={{ width: '100%', marginTop: 12, justifyContent: 'center', fontSize: 12 }}>
                  View Details
                </Link>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Bot size={28} style={{ color: 'var(--outline)', margin: '0 auto 10px' }} />
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                  No bots deployed.{' '}
                  <Link to="/bots" style={{ color: 'var(--primary)' }}>Create one</Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        {recentSessions.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="label" style={{ marginBottom: 16 }}>Recent Activity</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Arena</th>
                  <th>Result</th>
                  <th>Profit</th>
                  <th>Hands</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--on-surface-2)' }}>{s.arena_name ?? '—'}</td>
                    <td>
                      {s.status === 'completed' ? (
                        <span className={`badge ${(s.profit ?? 0) > 0 ? 'badge-mint' : 'badge-crimson'}`}>
                          {(s.profit ?? 0) > 0 ? 'WIN' : 'LOSS'}
                        </span>
                      ) : (
                        <span className="badge badge-grey">{s.status.toUpperCase()}</span>
                      )}
                    </td>
                    <td className="text-numeric" style={{ fontWeight: 700, color: (s.profit ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                      {s.profit !== null ? `${s.profit >= 0 ? '+' : ''}${s.profit}` : '—'}
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{s.hands_played}</td>
                    <td>
                      {s.status === 'completed' && (
                        <Link to={`/history/${s.id}`} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>View</Link>
                      )}
                    </td>
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
