import './FormSection.css';

export function FormSection({ title, description, children, className = '' }) {
  return (
    <section className={`form-section ${className}`.trim()}>
      {(title || description) && (
        <header className="form-section__head">
          {title && <strong>{title}</strong>}
          {description && <span>{description}</span>}
        </header>
      )}
      <div className="form-section__body">{children}</div>
    </section>
  );
}

export default FormSection;
