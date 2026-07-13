import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material/styles';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './styles/index.css';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';
document.body.dir = 'rtl';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StyledEngineProvider injectFirst>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StyledEngineProvider>
  </StrictMode>
);
