import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {notifyServiceWorkerStatus} from './hooks/usePWAInstall';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, registration) {
      notifyServiceWorkerStatus(Boolean(registration));
    },
    onRegisterError() {
      notifyServiceWorkerStatus(false);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
