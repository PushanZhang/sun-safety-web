import { getBurnTimeMinutes, getUVLevelInfo, getUVMessage } from '../utils/uv'

function getRiskIndex(uv) {
  if (uv <= 2) return 0
  if (uv <= 5) return 1
  if (uv <= 7) return 2
  if (uv <= 10) return 3
  return 4
}

const RISK_SEGMENTS = [
  { label: 'Low', color: '#2e7d32' },
  { label: 'Moderate', color: '#f9a825' },
  { label: 'High', color: '#ef6c00' },
  { label: 'Very High', color: '#c62828' },
  { label: 'Extreme', color: '#6a1b9a' },
]

function UVCard({ locationName, uvIndex, loading, source, observedAt, onNavigate }) {
  const safeUV = Number.isFinite(uvIndex) ? uvIndex : 0
  const { level, color } = getUVLevelInfo(safeUV)
  const activeRiskIndex = getRiskIndex(safeUV)
  const observedLabel = observedAt ? new Date(observedAt).toLocaleString() : null

  return (
    <section className="card uv-card" aria-live="polite">
      <div className="card-head">
        <h3>Current UV Index</h3>
        <p className="muted">{locationName}</p>
      </div>

      {loading ? (
        <p className="placeholder">Loading UV details...</p>
      ) : (
        <>
          <div className="uv-row">
            <span className="uv-value">{safeUV.toFixed(1)}</span>
            <span className="uv-level" style={{ backgroundColor: color }}>
              {level}
            </span>
          </div>

          <div className="risk-rail" aria-label="UV risk scale">
            {RISK_SEGMENTS.map((segment, index) => (
              <span
                key={segment.label}
                className={`risk-segment ${index <= activeRiskIndex ? 'active' : ''}`}
                style={{ '--risk-color': segment.color }}
                title={segment.label}
              />
            ))}
          </div>

          <div className="risk-scale" aria-label="UV risk labels">
            {RISK_SEGMENTS.map((segment, index) => (
              <span key={segment.label} className={index === activeRiskIndex ? 'active' : ''}>
                {segment.label}
              </span>
            ))}
          </div>

          <p className="alert-text">{getUVMessage(safeUV)}</p>
          <p className="muted">
            Source: {source || 'unknown'}
            {observedLabel ? ` | Observed: ${observedLabel}` : ''}
          </p>

          {onNavigate && (
            <div className="uv-nav-links">
              <button
                className="uv-nav-btn"
                onClick={() => onNavigate('awareness')}
                type="button"
              >
                <div className="uv-nav-content">
                  <p className="uv-nav-title">Understand the Risk</p>
                  <p className="uv-nav-sub">UV trends, melanoma data &amp; busted myths</p>
                </div>
                <span className="uv-nav-arrow">&#8594;</span>
              </button>
              <button
                className="uv-nav-btn"
                onClick={() => onNavigate('prevention')}
                type="button"
              >
                <div className="uv-nav-content">
                  <p className="uv-nav-title">Plan Your Protection</p>
                  <p className="uv-nav-sub">Outfit guide, SPF dosage &amp; reapplication timer</p>
                </div>
                <span className="uv-nav-arrow">&#8594;</span>
              </button>
            </div>
          )}

          {getBurnTimeMinutes(safeUV) !== null && (
            <p className="burn-alert" style={{ borderLeftColor: color }}>
              ⚠ Unprotected skin may begin to burn in ~{getBurnTimeMinutes(safeUV)} min — apply SPF50+ now
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default UVCard
