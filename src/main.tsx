import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {
  ensurePWAStoreInitialized,
  notifyServiceWorkerStatus,
  notifyServiceWorkerUpdateAvailable,
} from './hooks/usePWAInstall';
import './index.css';

ensurePWAStoreInitialized();

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (window.location.pathname.startsWith('/finalizar')) return;
    try {
      const reloadKey = 'bercali_chunk_reload_at';
      const lastReload = Number(window.sessionStorage.getItem(reloadKey) || '0');
      if (Date.now() - lastReload < 15_000) return;
      event.preventDefault();
      window.sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    } catch {
      // Ignora em modo restrito de sessionStorage
    }
  });
}

if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let userAcceptedUpdate = false;
  let lastUpdateCheckAt = 0;
  const SW_UPDATE_CHECK_THROTTLE_MS = 30_000;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userAcceptedUpdate) return;
    if (window.location.pathname.startsWith('/finalizar')) return;
    userAcceptedUpdate = false;
    window.location.reload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      notifyServiceWorkerUpdateAvailable(async () => {
        if (window.location.pathname.startsWith('/finalizar')) return;
        userAcceptedUpdate = true;
        await updateSW(true);
      });
    },
    onRegisteredSW(_swScriptUrl, registration) {
      notifyServiceWorkerStatus(Boolean(registration));
      if (!registration) return;

      const checkForUpdate = () => {
        const now = Date.now();
        if (now - lastUpdateCheckAt < SW_UPDATE_CHECK_THROTTLE_MS) return;
        lastUpdateCheckAt = now;
        void registration.update().catch(() => {
          // Ignora falhas de rede ao verificar atualização do Service Worker
        });
      };

      checkForUpdate();

      window.addEventListener('focus', checkForUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
    },
    onRegisterError() {
      notifyServiceWorkerStatus(false);
    },
  });
} else if (!import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // No ambiente de pré-visualização/desenvolvimento nunca mantém Service Worker ativo
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
    .catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
