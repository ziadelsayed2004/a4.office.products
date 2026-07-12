import './MetricCard.css';

export function MetricCard({ icon, label, value, hint }) {
  return (
    <article className="metric-card">
      <div className="metric-card__icon" aria-hidden="true">{icon}</div>
      <div className="metric-card__copy">
        <span className="metric-card__label">{label}</span>
        <strong className="metric-card__value a4-number">{value}</strong>
        {hint && <span className="metric-card__hint">{hint}</span>}
      </div>
    </article>
  );
}

export default MetricCard;
