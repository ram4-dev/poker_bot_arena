import { useEffect, useState } from 'react'
import { Copy, Check, BookOpen, ExternalLink } from 'lucide-react'
import { getPokerSkill } from '../api/game'

export default function DocsPage() {
  const [content, setContent] = useState<string>('')
  const [skillUrl, setSkillUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  useEffect(() => {
    getPokerSkill()
      .then(r => {
        setContent(r.data.content ?? '')
        setSkillUrl(r.data.url ?? '')
      })
      .catch(() => setError('Failed to load documentation.'))
      .finally(() => setLoading(false))
  }, [])

  const handleCopyUrl = async () => {
    if (!skillUrl) return
    try {
      await navigator.clipboard.writeText(skillUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch { /* fallback */ }
  }

  const handleCopyPrompt = async () => {
    if (!skillUrl) return
    const prompt = `Read the poker skill documentation at ${skillUrl} and follow the instructions to register an account, create an agent, join a Bronze arena, and play poker autonomously via the REST API.`
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2500)
    } catch { /* fallback */ }
  }

  return (
    <div style={{
      minHeight: '100svh',
      background: 'var(--surface-base)',
      backgroundImage: 'var(--grid-pattern)',
      backgroundSize: 'var(--grid-size)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '60px',
        borderBottom: '1px solid var(--outline)',
        backdropFilter: 'blur(8px)',
        background: 'rgba(13,13,15,0.8)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '4px',
            background: 'var(--gradient-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={14} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--on-surface)' }}>
            Bot Arena Docs
          </span>
        </a>

        {skillUrl && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCopyPrompt} className="btn-primary" style={{ fontSize: '12px' }}>
              {copiedPrompt ? <Check size={13} /> : <Copy size={13} />}
              {copiedPrompt ? 'Copied!' : 'Copy prompt for agent'}
            </button>
            <button onClick={handleCopyUrl} className="btn-secondary" style={{ fontSize: '12px' }}>
              {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
              {copiedUrl ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '48px 40px 100px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-container)', animation: 'glowPulse 1.5s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--on-surface-variant)' }}>LOADING DOCUMENTATION...</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px 20px', borderRadius: 4,
            background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)',
            fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--tertiary)',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && content && (
          <>
            {/* Skill URL banner */}
            {skillUrl && (
              <div style={{
                marginBottom: 32, padding: '14px 20px',
                background: 'rgba(124,127,255,0.06)',
                border: '1px solid rgba(124,127,255,0.15)',
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <div>
                  <div className="label" style={{ marginBottom: 4 }}>Poker Skill URL</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--primary)', wordBreak: 'break-all' }}>
                    {skillUrl}
                  </div>
                </div>
                <a href={skillUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, color: 'var(--primary-container)' }}>
                  <ExternalLink size={16} />
                </a>
              </div>
            )}

            {/* Markdown content rendered as pre-formatted text */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--outline)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--on-surface-variant)',
              }}>
                Poker Skill Documentation
              </div>
              <pre style={{
                padding: '24px',
                fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.8,
                color: 'var(--on-surface-2)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflow: 'auto',
                margin: 0,
              }}>
                {content}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
