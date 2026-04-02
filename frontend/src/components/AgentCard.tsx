import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import type { Agent } from '../api/agents'

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  idle:      { cls: 'badge-mint',    label: 'IDLE' },
  playing:   { cls: 'badge-indigo',  label: 'PLAYING' },
  queued:    { cls: 'badge-indigo',  label: 'QUEUED' },
  suspended: { cls: 'badge-crimson', label: 'SUSPENDED' },
}

interface Props {
  agent: Agent
}

export default function AgentCard({ agent }: Props) {
  const navigate = useNavigate()
  const status = STATUS_STYLE[agent.status] ?? STATUS_STYLE.idle

  return (
    <button
      onClick={() => navigate(`/agents/${agent.id}/history`)}
      style={{
        background: 'var(--surface-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 4, padding: 20,
        textAlign: 'left', cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        width: '100%',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(124,127,255,0.3)'
        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(124,127,255,0.1), var(--glow-card)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--outline-variant)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 4,
          background: 'var(--gradient-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: agent.status === 'playing' ? 'var(--glow-primary)' : 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: '#fff' }}>
            {agent.name[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
        <span className={`badge ${status.cls} ${agent.status === 'playing' ? 'status-in-battle' : agent.status === 'idle' ? 'status-idle' : ''}`}>
          {status.label}
        </span>
      </div>

      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--on-surface)', marginBottom: 12 }}>
        {agent.name}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--outline)' }}>
        <div style={{ background: 'var(--surface-container)', padding: '10px 12px', textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 4 }}>ELO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>
            {agent.elo}
          </div>
        </div>
        <div style={{ background: 'var(--surface-container)', padding: '10px 12px', textAlign: 'center' }}>
          <div className="label" style={{ marginBottom: 4 }}>Win Rate</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: agent.winrate >= 0.5 ? 'var(--secondary)' : 'var(--tertiary)' }}>
            {(agent.winrate * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, paddingTop: 10,
        borderTop: '1px solid var(--outline-variant)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>
          W / L
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
          <span style={{ color: 'var(--secondary)' }}>{agent.total_wins}</span>
          <span style={{ color: 'var(--outline)', margin: '0 3px' }}>/</span>
          <span style={{ color: 'var(--tertiary)' }}>{agent.total_losses}</span>
        </div>
      </div>

      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--primary-container)', opacity: 0.7,
      }}>
        <Activity size={10} /> VIEW HISTORY
      </div>
    </button>
  )
}
