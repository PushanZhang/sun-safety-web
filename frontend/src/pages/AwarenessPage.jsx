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
  return (
    <main className="page awareness-page">
      <header className="page-header">
        <h2>UV Awareness Guide</h2>
        <p className="muted">Practical information for everyday sun safety in Australia.</p>
      </header>

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
