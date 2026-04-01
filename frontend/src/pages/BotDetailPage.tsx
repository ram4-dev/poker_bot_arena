import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Edit, Swords, ChevronLeft } from 'lucide-react'
import AppShell from '../components/AppShell'
import EfficiencyRadar from '../components/EfficiencyRadar'
import { botsApi, type Bot, type BotVersion } from '../api/bots'
import { sessionsApi, type SessionSummary } from '../api/sessions'

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [bot, setBot] = useState<Bot | null>(null)
  const [versions, setVersions] = useState<BotVersion[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    if (!id) return
    botsApi.get(id).then(r => setBot(r.data)).catch(() => {})
    botsApi.getVersions(id).then(r => setVersions(r.data)).catch(() => {})
    sessionsApi.list(0, 50).then(r => setSessions(r.data.items)).catch(() => {})
  }, [id])

  const completedSessions = sessions.filter(s => s.status === 'completed')
  const streak = completedSessions.slice(-10)
  const profitData = completedSessions.slice(-20).map((s, i) => ({ i: i + 1, profit: s.profit ?? 0 }))
  const latestVersion = versions[versions.length - 1]

  const kpis = [
    { label: 'Win Rate',  value: `${bot?.winrate ?? 0}%`,               good: (bot?.winrate ?? 0) >= 50, numeric: true },
    { label: 'ELO',       value: bot?.elo ?? 1000,                       good: (bot?.elo ?? 0) >= 1000,   numeric: true },
    { label: 'Sessions',  value: bot?.total_sessions ?? 0,               good: null,                      numeric: true },
    { label: 'W / L',     value: `${bot?.wins ?? 0} / ${bot?.losses ?? 0}`, good: null,                  numeric: false },
  ]

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>

        {/* Back nav + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link to="/bots" className="btn-ghost" style={{ padding: 8 }}><ChevronLeft size={16} /></Link>
          <div style={{ flex: 1 }}>
            {bot ? (
              <>
                <div className="label" style={{ marginBottom: 6 }}>Bot Detail</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  {bot.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                  <span className={`badge ${
                    bot.status === 'playing' ? 'badge-indigo status-in-battle' :
                    bot.status === 'queued'  ? 'badge-indigo' : 'badge-grey status-idle'
                  }`}>
                    {bot.status === 'playing' ? 'In Battle' : bot.status === 'queued' ? 'In Queue' : 'Idle'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    ELO {bot.elo}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--on-surface-variant)' }}>Loading...</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/bots/${id}/edit`} className="btn-secondary" style={{ fontSize: 13 }}>
              <Edit size={13} /> Edit Bot
            </Link>
            <Link to="/battle" className="btn-primary" style={{ fontSize: 13 }}>
              <Swords size={13} /> Deploy
            </Link>
          </div>
        </div>

        {bot && (
          <>
            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--outline)', marginBottom: 16 }}>
              {kpis.map(({ label, value, good, numeric }) => (
                <div key={label} style={{ background: 'var(--surface-container)', padding: '18px 16px', textAlign: 'center' }}>
                  <div className="label" style={{ marginBottom: 8 }}>{label}</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: numeric ? 20 : 16,
                    color: good === null ? 'var(--on-surface)' : good ? 'var(--secondary)' : 'var(--tertiary)',
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak + Profit curve */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
              <div className="card">
                <div className="label" style={{ marginBottom: 14 }}>Last 10 Sessions</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const s = streak[i]
                    const bg = !s ? 'var(--surface-highest)' :
                      (s.profit ?? 0) > 0 ? 'var(--secondary)' :
                      (s.profit ?? 0) < 0 ? 'rgba(255,107,107,0.5)' : 'var(--outline)'
                    return (
                      <div key={i} style={{
                        flex: 1, height: 28, borderRadius: 2,
                        background: bg,
                        boxShadow: !s ? 'none' : (s.profit ?? 0) > 0 ? '0 0 6px rgba(63,255,160,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }} title={s?.arena_name ?? 'empty'} />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--secondary)' }}>
                    {streak.filter(s => (s.profit ?? 0) > 0).length}W
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--tertiary)' }}>
                    {streak.filter(s => (s.profit ?? 0) < 0).length}L
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="label" style={{ marginBottom: 12 }}>Profit Curve</div>
                {profitData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={profitData}>
                      <Line type="monotone" dataKey="profit" stroke="var(--primary-container)" strokeWidth={2} dot={false} />
                      <XAxis dataKey="i" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface-high)', border: '1px solid var(--outline)', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                        formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}`, 'Profit']}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                      Play more sessions to see profit curve
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Radar + Match log */}
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, marginBottom: 16 }}>
              {latestVersion && (
                <div className="card">
                  <div className="label" style={{ marginBottom: 12 }}>Tactical Profile</div>
                  <EfficiencyRadar config={latestVersion.config_json} />
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                      v{latestVersion.version_number}
                      {latestVersion.preset_origin && ` · ${latestVersion.preset_origin}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="label" style={{ marginBottom: 16 }}>Match Log</div>
                {completedSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      No completed sessions yet
                    </p>
                  </div>
                ) : (
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
                      {completedSessions.slice(0, 8).map(s => (
                        <tr key={s.id}>
                          <td style={{ color: 'var(--on-surface-2)' }}>{s.arena_name ?? '—'}</td>
                          <td>
                            <span className={`badge ${(s.profit ?? 0) > 0 ? 'badge-mint' : 'badge-crimson'}`}>
                              {(s.profit ?? 0) > 0 ? 'WIN' : 'LOSS'}
                            </span>
                          </td>
                          <td className="text-numeric" style={{ fontWeight: 700, color: (s.profit ?? 0) >= 0 ? 'var(--secondary)' : 'var(--tertiary)' }}>
                            {s.profit !== null ? `${s.profit >= 0 ? '+' : ''}${s.profit}` : '—'}
                          </td>
                          <td style={{ color: 'var(--on-surface-variant)' }}>{s.hands_played}</td>
                          <td>
                            <Link to={`/history/${s.id}`} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Version history */}
            {versions.length > 0 && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div className="label">Iteration Logs</div>
                  <Link to={`/bots/${id}/edit`} className="btn-ghost" style={{ fontSize: 11 }}>+ New Version</Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {versions.slice().reverse().map(v => (
                    <div key={v.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 3, background: 'var(--surface-container)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge badge-indigo">v{v.version_number}</span>
                        {v.preset_origin && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                            from preset: {v.preset_origin}
                          </span>
                        )}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface-variant)' }}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
