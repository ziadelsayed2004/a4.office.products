import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/feedback/ErrorBoundary.jsx';
import './styles/index.css';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';
document.body.dir = 'rtl';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
