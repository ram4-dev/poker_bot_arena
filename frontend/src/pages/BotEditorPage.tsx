import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Save, RotateCcw, ChevronLeft, CheckCircle } from 'lucide-react'
import AppShell from '../components/AppShell'
import TacticalSlider from '../components/TacticalSlider'
import EfficiencyRadar from '../components/EfficiencyRadar'
import { botsApi, type Bot, type BotConfig } from '../api/bots'

const SLIDER_CONFIG = [
  {
    section: 'Pre-Flop Tactics',
    params: [
      { key: 'hand_threshold',      label: 'Hand Threshold',    desc: 'Min hand strength to play (0=loose, 1=tight)' },
      { key: 'raise_tendency',      label: 'Raise Tendency',    desc: 'Frequency of pre-flop raises' },
      { key: 'three_bet_frequency', label: '3-Bet Frequency',   desc: 'Frequency of re-raising pre-flop' },
    ]
  },
  {
    section: 'Post-Flop Tactics',
    params: [
      { key: 'aggression',        label: 'Aggression',         desc: 'Overall post-flop betting pressure' },
      { key: 'bluff_frequency',   label: 'Bluff Frequency',    desc: 'How often to bluff with weak hands' },
      { key: 'fold_to_pressure',  label: 'Fold to Pressure',   desc: 'Tendency to fold against heavy aggression' },
      { key: 'continuation_bet',  label: 'Continuation Bet',   desc: 'Frequency of c-betting after pre-flop raise' },
    ]
  },
  {
    section: 'Bet Sizing',
    params: [
      { key: 'bet_size_tendency',    label: 'Bet Size',            desc: 'Default bet size relative to pot (0=small, 1=large)' },
      { key: 'overbet_willingness',  label: 'Overbet Willingness', desc: 'Willingness to bet more than pot size' },
    ]
  },
  {
    section: 'Meta Strategy',
    params: [
      { key: 'risk_tolerance',    label: 'Risk Tolerance',    desc: 'Willingness to call/raise with drawing hands' },
      { key: 'survival_priority', label: 'Survival Priority', desc: 'Tightens play when short-stacked' },
      { key: 'adaptation_speed',  label: 'Adaptation Speed',  desc: 'How fast to adjust based on opponent tendencies' },
    ]
  },
  {
    section: 'Table Management',
    params: [
      { key: 'leave_threshold_up',    label: 'Leave Threshold (Up)',   desc: 'Leave if stack exceeds X × buy-in' },
      { key: 'leave_threshold_down',  label: 'Leave Threshold (Down)', desc: 'Leave if stack drops below X × buy-in' },
      { key: 'min_hands_before_leave',label: 'Min Hands',              desc: 'Minimum hands before considering leaving', min: 5, max: 100 },
      { key: 'rebuy_willingness',     label: 'Rebuy Willingness',      desc: 'Tendency to rebuy after busting' },
      { key: 'session_max_hands',     label: 'Session Max Hands',      desc: 'Max hands per session', min: 20, max: 200 },
    ]
  },
]

const DEFAULT_CONFIG: BotConfig = {
  hand_threshold: 0.3, raise_tendency: 0.5, three_bet_frequency: 0.2,
  aggression: 0.5, bluff_frequency: 0.3, fold_to_pressure: 0.4, continuation_bet: 0.6,
  bet_size_tendency: 0.5, overbet_willingness: 0.2,
  risk_tolerance: 0.5, survival_priority: 0.5, adaptation_speed: 0.5,
  leave_threshold_up: 2.0, leave_threshold_down: 0.3, min_hands_before_leave: 20,
  rebuy_willingness: 0.5, session_max_hands: 100,
}

const SUMMARY_PARAMS = [
  { label: 'Aggression', key: 'aggression' },
  { label: 'Bluff',      key: 'bluff_frequency' },
  { label: 'Risk',       key: 'risk_tolerance' },
  { label: 'Survival',   key: 'survival_priority' },
]

export default function BotEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bot, setBot] = useState<Bot | null>(null)
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    botsApi.get(id).then(r => setBot(r.data))
    botsApi.getVersions(id).then(r => {
      const versions = r.data
      if (versions.length > 0) setConfig(versions[versions.length - 1].config_json)
    }).catch(() => {})
  }, [id])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      await botsApi.createVersion(id, config)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to save version')
    } finally {
      setSaving(false)
    }
  }

  const setParam = (key: string, val: number) => setConfig(c => ({ ...c, [key]: val }))

  return (
    <AppShell>
      <div style={{ maxWidth: 900 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Link to={`/bots/${id}`} className="btn-ghost" style={{ padding: 8 }}>
            <ChevronLeft size={16} />
          </Link>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: 6 }}>Tactical Editor</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              {bot?.name ?? 'Loading...'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => navigate(`/bots/${id}`)}>
              <RotateCcw size={14} /> Discard
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Version'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 3,
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
            fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--tertiary)',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SLIDER_CONFIG.map(section => (
              <div key={section.section} className="card">
                <div className="label" style={{ marginBottom: 20 }}>{section.section}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {section.params.map(p => (
                    <TacticalSlider
                      key={p.key}
                      label={p.label}
                      value={(config as unknown as Record<string, number>)[p.key] ?? 0}
                      onChange={v => setParam(p.key, v)}
                      min={p.min ?? 0}
                      max={p.max ?? 1}
                      step={p.max && p.max > 1 ? 1 : 0.05}
                      description={p.desc}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ position: 'sticky', top: 72 }}>
              <div className="label" style={{ marginBottom: 14 }}>Efficiency Radar</div>
              <EfficiencyRadar config={config} />

              <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: 16, marginTop: 16 }}>
                <div className="label" style={{ marginBottom: 14 }}>Profile Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {SUMMARY_PARAMS.map(({ label, key }) => {
                    const value = (config as unknown as Record<string, number>)[key] ?? 0
                    return (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--surface-highest)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${value * 100}%`,
                              background: value > 0.7 ? 'var(--primary-container)' : 'var(--secondary)',
                              boxShadow: value > 0.7 ? '0 0 6px var(--primary-container)' : '0 0 6px var(--secondary-glow)',
                              transition: 'width 0.2s',
                            }} />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--on-surface)', width: 28, textAlign: 'right' }}>
                            {Math.round(value * 100)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
