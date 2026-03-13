function AlertBanner({ alert }) {
  if (!alert) {
    return null
  }

  const severityClass = alert.severity ? `severity-${alert.severity}` : ''

  return (
    <section className={`card alert-banner ${severityClass}`} aria-live="polite">
      <p className="alert-kicker">Sun Safety Alert</p>
      <p className="alert-title">{alert.title}</p>
      <p className="alert-body">{alert.message}</p>
    </section>
  )
}

export default AlertBanner
