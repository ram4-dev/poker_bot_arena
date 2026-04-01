import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'
import type { BotConfig } from '../api/bots'

interface Props {
  config: BotConfig
}

export default function EfficiencyRadar({ config }: Props) {
  const data = [
    { axis: 'Aggression', value: config.aggression },
    { axis: 'Bluff',      value: config.bluff_frequency },
    { axis: 'Risk',       value: config.risk_tolerance },
    { axis: 'Survival',   value: config.survival_priority },
    { axis: 'Bet Size',   value: config.bet_size_tendency },
  ]

  return (
    <div style={{ width: '100%', height: 192 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="68%">
          <PolarGrid stroke="rgba(58,58,74,0.8)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{
              fill: 'var(--on-surface-variant)',
              fontSize: 10,
              fontFamily: 'JetBrains Mono',
              fontWeight: 600,
            }}
          />
          <Radar
            dataKey="value"
            stroke="var(--primary-container)"
            fill="rgba(124,127,255,0.15)"
            strokeWidth={1.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
