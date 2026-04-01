import { Link } from 'react-router-dom'
import { Zap, Bot, BarChart2, Shield, ChevronRight, Activity, ArrowRight } from 'lucide-react'

const STAT_ITEMS = [
  { value: '4', label: 'Arenas', sub: 'Low → High Stakes' },
  { value: '5', label: 'Presets', sub: 'Strategy archetypes' },
  { value: '17', label: 'Params', sub: 'Per bot config' },
]

const FEATURES = [
  { icon: Bot,       step: '01', title: 'Engineer',  desc: 'Configure 17 tactical parameters across pre-flop, post-flop, sizing, and meta-strategy layers.' },
  { icon: Zap,       step: '02', title: 'Deploy',    desc: 'Enter ELO-matched arenas with fictional stakes. Your bots compete autonomously — no manual play.' },
  { icon: BarChart2, step: '03', title: 'Analyze',   desc: 'Deep session insights: profit curves, hand replays, pattern detection, and strategic vulnerability reports.' },
  { icon: Shield,    step: '04', title: 'Iterate',   desc: 'Version-controlled bot evolution. Compare any two versions side-by-side. Climb the leaderboard.' },
]

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-base)', backgroundImage: 'var(--grid-pattern)', backgroundSize: 'var(--grid-size)' }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '60px',
        borderBottom: '1px solid var(--outline)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(13,13,15,0.8)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '4px',
            background: 'var(--gradient-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(124,127,255,0.4)',
          }}>
            <Activity size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
            CyberStrat
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/login" className="btn-ghost" style={{ fontSize: '13px' }}>Sign In</Link>
          <Link to="/login?signup=1" className="btn-primary" style={{ fontSize: '13px' }}>
            Get Started <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '96px 40px 80px', textAlign: 'center', position: 'relative' }}>
        {/* Glow orb behind hero */}
        <div style={{
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(124,127,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '4px 12px', marginBottom: '32px',
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--primary-container)',
          background: 'rgba(124,127,255,0.08)',
          border: '1px solid rgba(124,127,255,0.2)',
          borderRadius: '2px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary-container)', boxShadow: '0 0 6px var(--primary-container)', display: 'inline-block' }} />
          Competitive Bot Engineering Platform
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 'clamp(44px, 7vw, 80px)', lineHeight: 1.0,
          letterSpacing: '-0.04em', color: 'var(--on-surface)',
          marginBottom: '24px',
        }}>
          Build.{' '}
          <span style={{ color: 'var(--primary-container)', textShadow: '0 0 40px rgba(124,127,255,0.4)' }}>Battle.</span>
          <br />
          <span style={{
            background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Dominate.
          </span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '16px', lineHeight: 1.6,
          color: 'var(--on-surface-2)', maxWidth: '520px', margin: '0 auto 40px',
        }}>
          Engineer configurable poker bots, deploy them in ELO-matched arenas, and iterate your strategy based on real combat data.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '72px' }}>
          <Link to="/login?signup=1" className="btn-primary" style={{ padding: '11px 28px', fontSize: '14px' }}>
            <Zap size={14} /> Initialize Command
          </Link>
          <Link to="/leaderboard" className="btn-secondary" style={{ padding: '11px 28px', fontSize: '14px' }}>
            View Rankings
          </Link>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', maxWidth: '480px', margin: '0 auto', background: 'var(--outline)' }}>
          {STAT_ITEMS.map(({ value, label, sub }) => (
            <div key={label} style={{ background: 'var(--surface-low)', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '28px', color: 'var(--primary)', letterSpacing: '-0.02em' }}>{value}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: 'var(--on-surface)', marginTop: '4px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--on-surface-variant)', marginTop: '3px', letterSpacing: '0.04em' }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 40px 80px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--outline)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>
            The Tactical Loop
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--outline)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--outline)' }}>
          {FEATURES.map(({ icon: Icon, step, title, desc }) => (
            <div key={step} style={{
              background: 'var(--surface-low)',
              padding: '28px 22px',
              position: 'relative',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--surface-container)')}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--surface-low)')}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
                color: 'var(--primary-container)', letterSpacing: '0.1em',
                marginBottom: '16px',
              }}>
                {step}
              </div>
              <div style={{
                width: '36px', height: '36px', marginBottom: '16px',
                background: 'rgba(124,127,255,0.08)',
                border: '1px solid rgba(124,127,255,0.15)',
                borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={17} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: 'var(--on-surface)', marginBottom: '10px' }}>
                {title}
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', lineHeight: 1.55, color: 'var(--on-surface-2)' }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 40px 100px' }}>
        <div style={{
          background: 'var(--surface-low)',
          border: '1px solid var(--outline)',
          borderRadius: '4px', padding: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '32px', flexWrap: 'wrap',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--primary-container), transparent)',
          }} />
          <div>
            <div className="label" style={{ marginBottom: '12px' }}>Ready to deploy?</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Start with 5,000 chips.
            </h2>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--on-surface-2)' }}>
              No credit card. No install. Build your first bot in under 2 minutes.
            </p>
          </div>
          <Link to="/login?signup=1" className="btn-primary" style={{ padding: '13px 32px', fontSize: '14px', flexShrink: 0 }}>
            Initialize Uplink <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--outline)', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)', letterSpacing: '0.06em' }}>
          CYBERSTAT · BOT ARENA MVP
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--on-surface-variant)' }}>
          v0.1.0
        </span>
      </footer>
    </div>
  )
}
