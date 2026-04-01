import { Bot } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  title?: string
  description?: string
  cta?: { label: string; to: string }
  icon?: React.ReactNode
}

export default function EmptyState({
  title = 'The Hangar is Empty',
  description = 'No units deployed in this sector.',
  cta,
  icon,
}: Props) {
  return (
    <div className="animate-fade-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px',
    }}>
      {/* Icon container with HUD brackets */}
      <div style={{
        width: 64, height: 64, borderRadius: 4, marginBottom: 20,
        background: 'var(--surface-container)',
        border: '1px solid var(--outline)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, borderTop: '1px solid var(--primary-container)', borderLeft: '1px solid var(--primary-container)', borderRadius: '4px 0 0 0', opacity: 0.6 }} />
        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderBottom: '1px solid var(--primary-container)', borderRight: '1px solid var(--primary-container)', borderRadius: '0 0 4px 0', opacity: 0.3 }} />
        {icon ?? <Bot size={28} style={{ color: 'var(--on-surface-variant)' }} />}
      </div>

      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17,
        color: 'var(--on-surface)', marginBottom: 8, letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.6,
        color: 'var(--on-surface-variant)', textAlign: 'center', maxWidth: 280, marginBottom: 24,
      }}>
        {description}
      </p>
      {cta && (
        <Link to={cta.to} className="btn-primary">
          {cta.label}
        </Link>
      )}
    </div>
  )
}
