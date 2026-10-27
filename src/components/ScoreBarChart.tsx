import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { ClassScore } from '../api'

/** Horizontal class-score bars (Recharts) with the predicted class highlighted. */
export function ScoreBarChart({ scores, predicted }: { scores: ClassScore[]; predicted: string }) {
  const data = scores.map((s) => ({ ...s, pct: s.score * 100 }))
  return (
    <div className="h-32 w-full" role="img" aria-label={`Class score bar chart; predicted class ${predicted}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ right: 40 }} barCategoryGap={6}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={78}
            tick={{ fontSize: 12, fill: '#334155' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="pct" radius={[6, 6, 6, 6]} barSize={26} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.label === predicted ? '#0f766e' : '#94a3b8'} />
            ))}
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
              style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
