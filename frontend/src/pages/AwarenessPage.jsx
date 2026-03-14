import { useEffect, useState } from 'react'
import { fetchUVMonthly } from '../services/api'

/* ------------------------------------------------------------------ */
/*  Static skin cancer data (Cancer Council Australia / AIHW)         */
/* ------------------------------------------------------------------ */
const MELANOMA_DATA = [
  { year: '2010', cases: 11405 },
  { year: '2012', cases: 12372 },
  { year: '2014', cases: 13349 },
  { year: '2016', cases: 14320 },
  { year: '2018', cases: 14987 },
  { year: '2020', cases: 15073 },
  { year: '2022', cases: 16878 },
]

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function uvBarColor(v) {
  if (v <= 2) return '#2e7d32'
  if (v <= 5) return '#f9a825'
  if (v <= 7) return '#ef6c00'
  if (v <= 10) return '#c62828'
  return '#6a1b9a'
}

function BarChart({ data, xKey, yKey, color, yTickFormat }) {
  if (!data || data.length === 0) return <p className="muted chart-placeholder">Loading data...</p>
  const max = Math.max(...data.map((d) => parseFloat(d[yKey])))
  const H = 130
  const BAR_W = 24
  const GAP = 6
  const ML = 42
  const MT = 10
  const MB = 26
  const totalW = ML + data.length * (BAR_W + GAP) + 10
  const yTicks = [0, Math.round(max * 0.5), Math.round(max)]

  return (
    <svg
      viewBox={`0 0 ${totalW} ${H + MT + MB}`}
      style={{ width: '100%' }}
      role="img"
      aria-label="bar chart"
    >
      <line x1={ML} y1={MT} x2={ML} y2={H + MT} stroke="#dde5f1" strokeWidth={1} />
      <line x1={ML} y1={H + MT} x2={totalW} y2={H + MT} stroke="#dde5f1" strokeWidth={1} />
      {yTicks.map((v) => {
        const y = H + MT - (v / max) * H
        const label = yTickFormat ? yTickFormat(v) : String(v)
        return (
          <g key={v}>
            <line x1={ML - 3} y1={y} x2={ML} y2={y} stroke="#dde5f1" strokeWidth={1} />
            <text x={ML - 5} y={y + 3} textAnchor="end" fontSize={8} fill="#607089">
              {label}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const val = parseFloat(d[yKey])
        const barH = (val / max) * H
        const x = ML + i * (BAR_W + GAP)
        const fill = typeof color === 'function' ? color(val) : color
        return (
          <g key={i}>
            <rect
              x={x}
              y={H + MT - barH}
              width={BAR_W}
              height={barH}
              fill={fill}
              rx={3}
              opacity={0.88}
            />
            <text
              x={x + BAR_W / 2}
              y={H + MT + 15}
              textAnchor="middle"
              fontSize={9}
              fill="#607089"
            >
              {d[xKey]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Static content                                                     */
/* ------------------------------------------------------------------ */
const impacts = [
  'UV can be strong in Australia even on cool or cloudy days.',
  'Frequent overexposure increases long-term skin and eye damage risk.',
  'Peak UV periods are usually around late morning to mid-afternoon.',
]

const myths = [
  {
    myth: 'I only need sun protection in summer.',
    fact: 'UV can still be high outside summer. Check the daily UV level, not just temperature.',
  },
  {
    myth: 'Cloudy weather means low UV risk.',
    fact: 'Cloud cover can reduce visible sunlight, but UV can still pass through.',
  },
  {
    myth: 'Only fair skin is at risk.',
    fact: 'All skin tones can be damaged by UV and benefit from protection.',
  },
]

const checklist = [
  'Apply SPF30+ or higher before going out.',
  'Reapply sunscreen every 2 hours when outdoors.',
  'Wear a hat, sunglasses, and cover-up clothing.',
  'Seek shade during peak UV times.',
]

function AwarenessPage() {
  const [uvMonthly, setUVMonthly] = useState([])

  useEffect(() => {
    fetchUVMonthly()
      .then((rows) => {
        const mapped = rows.map((r) => ({
          month: MONTH_LABELS[parseInt(r.month) - 1],
          avg_uv: parseFloat(r.avg_uv),
        }))
        setUVMonthly(mapped)
      })
      .catch(() => {})
  }, [])

  return (
    <main className="page awareness-page">
      <header className="page-header">
        <h2>UV Awareness Guide</h2>
        <p className="muted">Practical information for everyday sun safety in Australia.</p>
      </header>

      <section className="page-hero page-hero-awareness">
        <img src="/images/awareness-hero.svg" alt="Awareness charts visual" loading="lazy" />
      </section>

      {/* ── US2.1: Two data visualisations ── */}
      <section className="awareness-columns">
        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">Story 2.1 · Database</p>
            <h3>Melanoma in Australia</h3>
          </div>
          <p className="chart-caption">Annual new cases (Cancer Council Australia / AIHW)</p>
          <BarChart
            data={MELANOMA_DATA}
            xKey="year"
            yKey="cases"
            color="#c62828"
            yTickFormat={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <p className="chart-note muted">
            New melanoma diagnoses have risen by ~48% from 2010 to 2022, making it Australia&apos;s
            third most common cancer.
          </p>
        </section>

        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">Story 2.1 · Database (Live)</p>
            <h3>Monthly UV Trend — Melbourne</h3>
          </div>
          <p className="chart-caption">Average daytime UV index by month (historical records)</p>
          <BarChart
            data={uvMonthly}
            xKey="month"
            yKey="avg_uv"
            color={uvBarColor}
            yTickFormat={(v) => String(v)}
          />
          <p className="chart-note muted">
            UV peaks in summer (Jan–Feb) and drops sharply in winter. Protection is needed
            year-round during spring and summer months.
          </p>
        </section>
      </section>

      {/* ── Myths ── */}
      <section className="card awareness-highlight">
        <div className="section-head">
          <p className="section-kicker">Priority</p>
          <h3>Common myths and facts</h3>
        </div>
        <div className="myth-grid">
          {myths.map((item) => (
            <article key={item.myth} className="myth-item">
              <p className="myth-label">Myth</p>
              <p>{item.myth}</p>
              <p className="fact-label">Fact</p>
              <p>{item.fact}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Impacts + Checklist ── */}
      <section className="awareness-columns">
        <section className="card awareness-subsection">
          <div className="section-head">
            <h3>Australian UV impacts</h3>
          </div>
          <ul className="compact-list">
            {impacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="card awareness-subsection">
          <div className="section-head">
            <h3>Daily protection checklist</h3>
          </div>
          <ul className="compact-list">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </section>

      <section className="card awareness-note">
        <div className="section-head">
          <h3>When UV is high or above</h3>
        </div>
        <p className="muted">
          If UV is 6+, reduce direct sun time and use full protection. If UV reaches 8+, prioritize
          shade and avoid long exposure during peak hours.
        </p>
      </section>
    </main>
  )
}

export default AwarenessPage
