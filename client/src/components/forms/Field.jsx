import { FormLabel } from '@mui/material';

export function Field({ label, required, hint, error, children, className = '' }) {
  return <div className={`field ${className}`}>
    {label && <FormLabel className="field__label">{label}{required && <span className="field__required">*</span>}</FormLabel>}
    {children}
    {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
  </div>;
}
