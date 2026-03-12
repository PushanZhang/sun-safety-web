function WeatherCard({ weather, loading }) {
  return (
    <section className="card weather-card" aria-live="polite">
      <div className="card-head">
        <h3>Weather Summary</h3>
        <p className="muted">Current conditions</p>
      </div>
      {loading ? (
        <p className="placeholder">Loading weather data...</p>
      ) : (
        <div className="weather-grid">
          <div className="stat-tile">
            <p className="tile-label">Temperature</p>
            <p className="tile-value">{weather.temperatureC} C</p>
          </div>
          <div className="stat-tile">
            <p className="tile-label">Condition</p>
            <p className="tile-value">{weather.condition}</p>
          </div>
          <div className="stat-tile">
            <p className="tile-label">Humidity</p>
            <p className="tile-value">{weather.humidityPct}%</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default WeatherCard
