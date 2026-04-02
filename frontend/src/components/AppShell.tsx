import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Monitor, Swords, Trophy, Wallet, BookOpen,
  LogOut, ChevronRight, Activity,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',    key: 'dashboard' },
  { to: '/matches',     icon: Monitor,         label: 'Matches',      key: 'matches' },
  { to: '/arenas',      icon: Swords,          label: 'Arenas',       key: 'arenas' },
  { to: '/leaderboard', icon: Trophy,          label: 'Leaderboard',  key: 'lb' },
  { to: '/wallet',      icon: Wallet,          label: 'Wallet',       key: 'wallet' },
  { to: '/skill',       icon: BookOpen,        label: 'Docs',         key: 'docs' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--surface-base)' }}>

      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 40,
        background: 'var(--surface-low)',
        borderRight: '1px solid var(--outline)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'var(--grid-pattern)', backgroundSize: 'var(--grid-size)',
          opacity: 0.4,
        }} />

        {/* Logo */}
        <div style={{
          padding: '20px 20px 18px',
          borderBottom: '1px solid var(--outline)',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '4px',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--glow-primary)',
              flexShrink: 0,
            }}>
              <Activity size={14} color="#fff" />
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px',
              color: 'var(--on-surface)', letterSpacing: '-0.02em',
            }}>
              Bot Arena
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--primary-container)', opacity: 0.8,
            paddingLeft: '36px',
          }}>
            API Dashboard
          </div>
        </div>

        {/* Nav section label */}
        <div style={{
          padding: '16px 20px 8px',
          fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--on-surface-variant)',
          position: 'relative', zIndex: 1,
        }}>
          Navigation
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0 10px', position: 'relative', zIndex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', marginBottom: '2px',
              borderRadius: '3px', fontSize: '13px', fontWeight: 500,
              fontFamily: 'var(--font-display)',
              textDecoration: 'none', transition: 'all 0.12s',
              color: isActive ? 'var(--primary)' : 'var(--on-surface-2)',
              background: isActive ? 'rgba(124,127,255,0.08)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--primary-container)' : '2px solid transparent',
              boxShadow: isActive ? 'inset 0 0 16px rgba(124,127,255,0.05)' : 'none',
            })}>
              {({ isActive }) => (
                <>
                  <Icon size={15} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                  <span>{label}</span>
                  {isActive && (
                    <ChevronRight size={11} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User strip */}
        <div style={{
          margin: '10px', padding: '12px',
          background: 'var(--surface-container)',
          border: '1px solid var(--outline)',
          borderRadius: '4px',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '4px', flexShrink: 0,
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px',
              color: '#fff',
            }}>
              {user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px',
                color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.username ?? 'User'}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                color: 'var(--secondary)', marginTop: '1px',
              }}>
                {'\u2659'} {user?.balance?.toLocaleString() ?? 0}
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              title="Logout"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--on-surface-variant)', padding: '4px',
                borderRadius: '3px', display: 'flex', alignItems: 'center',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--on-surface-variant)')}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {/* Version tag */}
        <div style={{
          padding: '8px 20px 14px', textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '9px',
          color: 'var(--on-surface-variant)', opacity: 0.5,
          position: 'relative', zIndex: 1,
        }}>
          ARENA v3.0 — API Dashboard
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: '220px', display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

        {/* Top bar */}
        <header style={{
          height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(13,13,15,0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--outline)',
        }}>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Balance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>Balance</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--secondary)' }}>
                {'\u2659'} {user?.balance?.toLocaleString() ?? 0}
              </span>
            </div>

            <div style={{ width: '1px', height: '16px', background: 'var(--outline)' }} />

            {/* ELO */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--on-surface-variant)' }}>ELO</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                {user?.elo ?? 1000}
              </span>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: '24px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
