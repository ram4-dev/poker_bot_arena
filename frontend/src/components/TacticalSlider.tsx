interface Props {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  description?: string
}

export default function TacticalSlider({
  label, value, onChange, min = 0, max = 1, step = 0.05, description
}: Props) {
  const pct = Math.round(((value - min) / (max - min)) * 100)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>
          {label}
        </label>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          color: pct > 70 ? 'var(--primary-container)' : 'var(--secondary)',
          minWidth: 36, textAlign: 'right',
        }}>
          {pct}%
        </span>
      </div>

      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="tactical-slider"
        style={{
          background: `linear-gradient(to right, ${pct > 70 ? 'var(--primary-container)' : 'var(--secondary)'} 0%, ${pct > 70 ? 'var(--primary-container)' : 'var(--secondary)'} ${pct}%, var(--surface-highest) ${pct}%, var(--surface-highest) 100%)`
        }}
      />

      {description && (
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 5, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
    </div>
  )
}
