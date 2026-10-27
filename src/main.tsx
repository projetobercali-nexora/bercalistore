import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {notifyServiceWorkerStatus} from './hooks/usePWAInstall';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
  const reloadGuardKey = 'bercali_sw_updated_reload_once';

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtBoot) return;
    if (window.location.pathname.startsWith('/finalizar')) return;
    try {
      if (window.sessionStorage.getItem(reloadGuardKey) === '1') return;
      window.sessionStorage.setItem(reloadGuardKey, '1');
    } catch {
      return;
    }
    window.location.reload();
  });

  registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, registration) {
      notifyServiceWorkerStatus(Boolean(registration));
      if (registration) {
        void registration.update().catch(() => {
          // Ignora falhas de rede ao verificar atualização do Service Worker
        });
      }
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
