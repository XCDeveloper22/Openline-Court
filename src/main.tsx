import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Always keep production traffic on the primary canonical domain www.openlinecourt.online
if (typeof window !== 'undefined') {
  const host = window.location.hostname.toLowerCase();
  const hasAuthCallback =
    window.location.search.includes('code=') ||
    window.location.hash.includes('access_token=') ||
    window.location.hash.includes('refresh_token=');

  if (
    (host === 'openlinecourt.wasmer.app' || host === 'openlinecourt.online') &&
    !hasAuthCallback
  ) {
    const canonicalUrl = `https://www.openlinecourt.online${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(canonicalUrl);
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
