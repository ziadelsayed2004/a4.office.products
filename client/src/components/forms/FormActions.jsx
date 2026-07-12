import './FormActions.css';

export function FormActions({ children, className = '' }) {
  return <div className={`form-actions ${className}`.trim()}>{children}</div>;
}

export default FormActions;
