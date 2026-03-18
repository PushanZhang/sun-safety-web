import { useEffect, useMemo, useState } from 'react'
import { fetchCancerStats, fetchUVMonthly } from '../services/api'
import { getUVLevelInfo } from '../utils/uv'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* ------------------------------------------------------------------ */
/*  Shared SVG bar chart                                               */
/* ------------------------------------------------------------------ */
function BarChart({ data, xKey, yKey, peakKey, colorFn, gradientId, baseColor, yTickFormat, showValueLabels }) {
  if (!data || data.length === 0) return <p className="muted chart-placeholder">No data available.</p>

  const vals = data.map((d) => parseFloat(d[yKey]))
  const peakVals = peakKey ? data.map((d) => parseFloat(d[peakKey])) : []
  const allVals = [...vals, ...peakVals].filter((v) => !isNaN(v))
  const max = Math.max(...allVals) * 1.1

  const H = 148
  const BAR_W = 28
  const GAP = 7
  const ML = 52
  const MT = 22
  const MB = 30
  const totalW = ML + data.length * (BAR_W + GAP) + 16

  const numTicks = 4
  const yTicks = Array.from({ length: numTicks }, (_, i) =>
    Math.round((max / (numTicks - 1)) * i),
  )

  return (
    <div className="chart-scroll">
      <svg
        viewBox={`0 0 ${totalW} ${H + MT + MB}`}
        style={{ width: '100%', minWidth: `${totalW}px`, height: 'auto', display: 'block' }}
        aria-label="bar chart"
      >
        <defs>
          {gradientId && baseColor && (
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={baseColor} stopOpacity="0.95" />
              <stop offset="100%" stopColor={baseColor} stopOpacity="0.38" />
            </linearGradient>
          )}
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, ti) => {
          const y = H + MT - (v / max) * H
          return (
            <g key={v}>
              <line
                x1={ML}
                y1={y}
                x2={totalW - 8}
                y2={y}
                stroke={ti === 0 ? '#c4d4e8' : '#e4edf7'}
                strokeWidth={ti === 0 ? 1.2 : 0.8}
                strokeDasharray={ti === 0 ? undefined : '4,3'}
              />
              <text
                x={ML - 7}
                y={y + 3.5}
                textAnchor="end"
                fontSize={8}
                fill="#8a9db8"
                fontFamily="system-ui,sans-serif"
              >
                {yTickFormat ? yTickFormat(v) : v}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const val = parseFloat(d[yKey])
          const barH = max > 0 ? Math.max((val / max) * H, 1) : 0
          const x = ML + i * (BAR_W + GAP)
          const y = H + MT - barH
          const fill = colorFn ? colorFn(val) : gradientId ? `url(#${gradientId})` : (baseColor || '#4a7fbd')

          return (
            <g key={d[xKey]}>
              <rect x={x} y={y} width={BAR_W} height={barH} fill={fill} rx={4} />
              {showValueLabels && barH > 14 && (
                <text
                  x={x + BAR_W / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#2d4a70"
                  fontWeight="700"
                  fontFamily="system-ui,sans-serif"
                >
                  {yTickFormat ? yTickFormat(val) : val}
                </text>
              )}
              <text
                x={x + BAR_W / 2}
                y={H + MT + 18}
                textAnchor="middle"
                fontSize={8.5}
                fill="#7a90aa"
                fontFamily="system-ui,sans-serif"
              >
                {d[xKey]}
              </text>
            </g>
          )
        })}

        {/* Peak trend line */}
        {peakKey && peakVals.length === data.length && (
          <polyline
            points={data
              .map((d, i) => {
                const val = parseFloat(d[peakKey])
                const x = ML + i * (BAR_W + GAP) + BAR_W / 2
                const y = H + MT - (val / max) * H
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="#ff9b2f"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray="5,3"
            opacity={0.9}
          />
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Static content                                                     */
/* ------------------------------------------------------------------ */
const myths = [
  {
    myth: 'I only need sun protection in summer.',
    fact: 'UV can still be high outside summer. Check the daily UV level, not just temperature.',
  },
  {
    myth: 'Cloudy weather means low UV risk.',
    fact: 'Cloud cover can reduce visible sunlight, but UV rays still pass through and reach your skin.',
  },
  {
    myth: 'Only fair skin is at risk.',
    fact: 'All skin tones can be damaged by UV over time and benefit from consistent protection.',
  },
]

const UV_LEVELS = [
  { label: 'Low', range: '0–2', color: '#2e7d32', bg: '#f0faf1', tip: 'Basic protection on bright days.' },
  { label: 'Moderate', range: '3–5', color: '#f9a825', bg: '#fffcf0', tip: 'SPF30+, hat outdoors.' },
  { label: 'High', range: '6–7', color: '#ef6c00', bg: '#fff8f2', tip: 'SPF50+, seek shade 10am–3pm.' },
  { label: 'Very High', range: '8–10', color: '#c62828', bg: '#fff5f5', tip: 'Minimise outdoor time. Full cover.' },
  { label: 'Extreme', range: '11+', color: '#6a1b9a', bg: '#fdf5ff', tip: 'Stay indoors during peak hours.' },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
function AwarenessPage() {
  const [uvMonthly, setUVMonthly] = useState([])
  const [uvMonthlyLoading, setUvMonthlyLoading] = useState(true)
  const [uvMonthlyError, setUvMonthlyError] = useState('')

  const [melanoma, setMelanoma] = useState([])
  const [melanomaLoading, setMelanomaLoading] = useState(true)
  const [melanomaError, setMelanomaError] = useState('')

  useEffect(() => {
    Promise.allSettled([fetchUVMonthly(), fetchCancerStats()]).then(([uvResult, cancerResult]) => {
      if (uvResult.status === 'fulfilled') {
        setUVMonthly(
          uvResult.value.map((r) => ({
            month: MONTH_LABELS[parseInt(r.month) - 1],
            avg_uv: parseFloat(r.avg_uv),
            peak_uv: r.peak_uv ? parseFloat(r.peak_uv) : null,
          })),
        )
      } else {
        setUvMonthlyError('Monthly UV data is temporarily unavailable.')
      }

      if (cancerResult.status === 'fulfilled') {
        setMelanoma(
          cancerResult.value.map((r) => ({
            year: String(r.year),
            total_cases: parseInt(r.total_cases),
            rate_per_100k: r.rate_per_100k ? parseFloat(r.rate_per_100k) : null,
          })),
        )
      } else {
        setMelanomaError('Melanoma data is temporarily unavailable.')
      }

      setUvMonthlyLoading(false)
      setMelanomaLoading(false)
    })
  }, [])

  const melanomaPctChange = useMemo(() => {
    const first = melanoma[0]?.total_cases
    const last = melanoma.at(-1)?.total_cases
    return first && last ? Math.round(((last - first) / first) * 100) : null
  }, [melanoma])

  const peakUVMonth = useMemo(
    () =>
      uvMonthly.length > 0
        ? uvMonthly.reduce((best, m) => (m.avg_uv > best.avg_uv ? m : best), uvMonthly[0])
        : null,
    [uvMonthly],
  )

  const hasPeakUV = useMemo(() => uvMonthly.some((m) => m.peak_uv), [uvMonthly])

  return (
    <main className="page awareness-page">
      <header className="page-header">
        <div>
          <h2>UV Awareness Guide</h2>
          <p className="muted">Data-driven sun safety insights for Australia. Source: AIHW &amp; open-meteo.</p>
        </div>
      </header>

      <section className="page-hero page-hero-awareness">
        <img src="/images/awareness-hero.svg" alt="Awareness charts visual" loading="lazy" />
      </section>

      {/* ── Key stat callouts ── */}
      <div className="awareness-stat-row">
        <div className="awareness-stat-tile">
          <p className="awareness-stat-value">~2 in 3</p>
          <p className="awareness-stat-label">Australians will be diagnosed with skin cancer by age 70</p>
        </div>
        <div className="awareness-stat-tile">
          <p className="awareness-stat-value" style={{ color: '#c62828' }}>
            {melanomaPctChange !== null ? `+${melanomaPctChange}%` : '—'}
          </p>
          <p className="awareness-stat-label">
            Rise in melanoma diagnoses from {melanoma[0]?.year ?? '—'} to {melanoma.at(-1)?.year ?? '—'}
          </p>
        </div>
        <div className="awareness-stat-tile">
          <p className="awareness-stat-value" style={{ color: '#ef6c00' }}>
            {peakUVMonth ? peakUVMonth.month : '—'}
          </p>
          <p className="awareness-stat-label">Peak UV month in Melbourne (avg {peakUVMonth ? peakUVMonth.avg_uv.toFixed(1) : '—'})</p>
        </div>
      </div>

      {/* ── Two charts ── */}
      <section className="awareness-columns">

        {/* Chart 1 — Melanoma cases from DB */}
        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">AIHW Database</p>
            <h3>Melanoma Diagnoses in Australia</h3>
          </div>
          <p className="chart-caption">
            Annual new cases — all ages, both sexes (ICD-10: C43)
          </p>

          {melanomaLoading && <p className="muted chart-placeholder">Loading data...</p>}
          {melanomaError && <p className="error">{melanomaError}</p>}
          {!melanomaLoading && !melanomaError && melanoma.length > 0 && (
            <div className="chart-area">
              <BarChart
                data={melanoma}
                xKey="year"
                yKey="total_cases"
                gradientId="melanoma-grad"
                baseColor="#c62828"
                showValueLabels={melanoma.length <= 12}
                yTickFormat={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
            </div>
          )}

          <div className="chart-legend-row">
            <span className="chart-legend-dot" style={{ background: '#c62828' }} />
            <span className="chart-legend-label">Annual new cases</span>
          </div>
          <p className="chart-note muted">
            New melanoma diagnoses have risen significantly — making it one of Australia&apos;s
            most common cancers. Early detection is key to survival.
          </p>
        </section>

        {/* Chart 2 — Monthly UV from DB */}
        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">Live Database</p>
            <h3>Monthly UV Trend — Melbourne</h3>
          </div>
          <p className="chart-caption">Average &amp; peak daytime UV index by month (historical records)</p>

          {uvMonthlyLoading && <p className="muted chart-placeholder">Loading data...</p>}
          {uvMonthlyError && <p className="error">{uvMonthlyError}</p>}
          {!uvMonthlyLoading && uvMonthly.length > 0 && (
            <div className="chart-area">
              <BarChart
                data={uvMonthly}
                xKey="month"
                yKey="avg_uv"
                peakKey={hasPeakUV ? 'peak_uv' : undefined}
                colorFn={(v) => getUVLevelInfo(v).color}
                showValueLabels
                yTickFormat={(v) => String(v)}
              />
            </div>
          )}
          {!uvMonthlyLoading && uvMonthly.length === 0 && !uvMonthlyError && (
            <p className="muted chart-placeholder">No monthly UV data available yet.</p>
          )}

          <div className="chart-legend-row">
            <span className="chart-legend-dot" style={{ background: '#607089' }} />
            <span className="chart-legend-label">Avg UV (colour = risk level)</span>
            <span className="chart-legend-dash" />
            <span className="chart-legend-label" style={{ color: '#ff9b2f' }}>Peak UV</span>
          </div>
          <p className="chart-note muted">
            UV peaks in summer (Jan–Feb) and drops sharply in winter. Protection is needed
            year-round — even June can reach Moderate UV levels.
          </p>
        </section>

      </section>

      {/* ── UV Level Guide ── */}
      <section className="card">
        <div className="section-head">
          <p className="section-kicker">Reference</p>
          <h3>UV Level Guide — What each level means</h3>
        </div>
        <div className="uv-level-guide">
          {UV_LEVELS.map((lvl) => (
            <div key={lvl.label} className="uv-level-row" style={{ borderLeftColor: lvl.color, background: lvl.bg }}>
              <span className="uv-level-badge" style={{ background: lvl.color }}>{lvl.label}</span>
              <span className="uv-level-range" style={{ color: lvl.color }}>{lvl.range}</span>
              <span className="uv-level-tip">{lvl.tip}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Myths ── */}
      <section className="card">
        <div className="section-head">
          <p className="section-kicker">Common misconceptions</p>
          <h3>Myths vs. Facts</h3>
        </div>
        <div className="myth-grid">
          {myths.map((item) => (
            <article key={item.myth} className="myth-item">
              <div className="myth-block">
                <p className="myth-label">Myth</p>
                <p className="myth-text">{item.myth}</p>
              </div>
              <div className="fact-block">
                <p className="fact-label">Fact</p>
                <p className="fact-text">{item.fact}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Impacts + Checklist ── */}
      <section className="awareness-columns">
        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">Did you know</p>
            <h3>Australian UV Facts</h3>
          </div>
          <ul className="awareness-fact-list">
            <li>UV can be strong in Australia even on cool or cloudy days.</li>
            <li>Frequent overexposure increases long-term skin and eye damage risk.</li>
            <li>Peak UV periods are usually around late morning to mid-afternoon.</li>
            <li>Australia has one of the highest rates of skin cancer in the world.</li>
          </ul>
        </section>

        <section className="card awareness-subsection">
          <div className="section-head">
            <p className="section-kicker">Daily habit</p>
            <h3>Protection Checklist</h3>
          </div>
          <ul className="awareness-checklist">
            <li>Apply SPF30+ or higher before going out.</li>
            <li>Reapply sunscreen every 2 hours when outdoors.</li>
            <li>Wear a hat, sunglasses, and cover-up clothing.</li>
            <li>Seek shade during peak UV times (10am–3pm).</li>
          </ul>
        </section>
      </section>

    </main>
  )
}

export default AwarenessPage
