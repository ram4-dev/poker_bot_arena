import { Link } from 'react-router-dom'
import { Bot, TrendingUp, TrendingDown } from 'lucide-react'
import type { Bot as BotType } from '../api/bots'

const STATUS = {
  idle:    { label: 'Idle',      dot: 'status-idle',       cls: 'badge-grey' },
  queued:  { label: 'In Queue',  dot: '',                   cls: 'badge-indigo' },
  playing: { label: 'In Battle', dot: 'status-in-battle',  cls: 'badge-indigo' },
  paused:  { label: 'Paused',    dot: 'status-paused',     cls: 'badge-crimson' },
}

export default function BotCard({ bot }: { bot: BotType }) {
  const status = STATUS[bot.status] ?? STATUS.idle
  const winrate = bot.total_sessions > 0 ? Math.round((bot.wins / bot.total_sessions) * 100) : 0
  const winrateGood = winrate >= 50

  return (
    <Link to={`/bots/${bot.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="animate-fade-in" style={{
        background: 'var(--surface-low)',
        border: '1px solid var(--outline)',
        borderRadius: '4px', padding: '20px',
        transition: 'all 0.18s',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(124,127,255,0.3)'
        el.style.boxShadow = '0 0 0 1px rgba(124,127,255,0.1), 0 4px 24px rgba(0,0,0,0.4)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--outline)'
        el.style.boxShadow = 'none'
        el.style.transform = 'none'
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: bot.status === 'playing'
            ? 'linear-gradient(90deg, transparent, var(--primary-container), transparent)'
            : 'transparent',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '4px',
            background: 'var(--surface-container)',
            border: '1px solid var(--outline)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <span className={`badge ${status.cls}`}>
            {status.dot && <span className={status.dot} />}
            {status.label}
          </span>
        </div>

        {/* Name */}
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px',
          color: 'var(--on-surface)', marginBottom: '14px',
        }}>
          {bot.name}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--outline)' }}>
          {[
            {
              label: 'Win Rate',
              value: `${winrate}%`,
              color: winrateGood ? 'var(--secondary)' : 'var(--tertiary)',
              icon: winrateGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />,
            },
            { label: 'ELO',      value: bot.elo.toString(),          color: 'var(--primary)', icon: null },
            { label: 'Sessions', value: bot.total_sessions.toString(), color: 'var(--on-surface)', icon: null },
          ].map(({ label, value, color, icon }) => (
            <div key={label} style={{
              background: 'var(--surface-container)', padding: '10px 8px', textAlign: 'center',
            }}>
              <div className="label" style={{ marginBottom: '4px' }}>{label}</div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color,
              }}>
                {icon}{value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
