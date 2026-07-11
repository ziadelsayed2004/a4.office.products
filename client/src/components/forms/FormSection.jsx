export function FormSection({ title, description, children }) {
  return <section className="form-section">
    <header className="form-section__head"><strong>{title}</strong>{description && <span>{description}</span>}</header>
    <div className="form-section__body">{children}</div>
  </section>;
}
