import './FieldGrid.css';

export function FieldGrid({ columns = 2, children, className = '' }) {
  const gridClass = columns === 1
    ? 'form-grid--one'
    : columns === 3
      ? 'form-grid--three'
      : 'form-grid';

  return <div className={`${gridClass} ${className}`.trim()}>{children}</div>;
}

export default FieldGrid;
