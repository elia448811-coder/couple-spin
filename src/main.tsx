import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBanner } from './components/UpdateBanner';
import { ToastProvider } from './contexts/ToastContext';
import './styles/site-gate.css';
import './styles/toast.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthGuard>
        <ToastProvider>
          <UpdateBanner />
          <App />
        </ToastProvider>
      </AuthGuard>
    </ErrorBoundary>
  </StrictMode>,
);
