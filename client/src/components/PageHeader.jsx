import './PageHeader.css';

export function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
