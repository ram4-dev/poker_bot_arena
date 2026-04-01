import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import AppShell from '../components/AppShell'
import BotCard from '../components/BotCard'
import EmptyState from '../components/EmptyState'
import { botsApi, type Bot, type CreateBotPayload } from '../api/bots'

type Tab = 'all' | 'active' | 'idle'

const PRESETS = ['aggressive', 'conservative', 'balanced', 'bluffer', 'opportunist']

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPreset, setNewPreset] = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = () => botsApi.list().then(r => setBots(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const filtered = bots.filter(b => {
    if (tab === 'active') return b.status === 'playing' || b.status === 'queued'
    if (tab === 'idle')   return b.status === 'idle'
    return true
  })

  const count = (t: Tab) =>
    t === 'all' ? bots.length : bots.filter(b => t === 'active' ? (b.status === 'playing' || b.status === 'queued') : b.status === 'idle').length

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    setError('')
    try {
      const payload: CreateBotPayload = { name: newName.trim(), preset: newPreset }
      await botsApi.create(payload)
      setCreating(false)
      setNewName('')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to create bot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>My Fleet</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              Fleet Overview
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 6 }}>
              {bots.length} / 3 units deployed
            </p>
          </div>
          {bots.length < 3 && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Construct New Bot
            </button>
          )}
        </div>

        {/* Create modal */}
        {creating && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 400, margin: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--on-surface)' }}>
                  Construct New Bot
                </h2>
                <button className="btn-ghost" style={{ padding: 6 }} onClick={() => { setCreating(false); setError('') }}>
                  <X size={14} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>Unit Designation</div>
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  className="input-field" placeholder="Alpha Strike" autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div className="label" style={{ marginBottom: 8 }}>Initial Preset</div>
                <select value={newPreset} onChange={e => setNewPreset(e.target.value)} className="input-field">
                  {PRESETS.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div style={{
                  marginBottom: 16, padding: '8px 12px', borderRadius: 3,
                  background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                  fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--tertiary)',
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setCreating(false); setError('') }}>
                  Cancel
                </button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleCreate} disabled={loading}>
                  {loading ? 'Building...' : 'Deploy Unit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {(['all', 'active', 'idle'] as Tab[]).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span style={{
                marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 9,
                color: tab === t ? 'var(--primary-container)' : 'var(--on-surface-variant)',
                background: 'var(--surface-container)', padding: '1px 5px', borderRadius: 2,
              }}>
                {count(t)}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No Units Found"
            description={tab === 'all' ? 'Construct your first bot to start competing in the arenas.' : `No ${tab} bots found.`}
            cta={tab === 'all' && bots.length < 3 ? { label: 'Construct First Bot', to: '#' } : undefined}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {filtered.map(bot => <BotCard key={bot.id} bot={bot} />)}
          </div>
        )}
      </div>
    </AppShell>
  )
}
