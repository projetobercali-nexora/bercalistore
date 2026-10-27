import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  detectInstallEnvironment,
  isStandaloneDisplayMode,
  type BeforeInstallPromptEvent,
  type InstallEnvironmentInfo,
  type InstallPromptOutcome,
} from '../utils/pwa';

declare global {
  interface Window {
    __bercaliDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
    __bercaliAppInstalled?: boolean;
  }
}

interface RelatedApplication {
  platform?: string;
  url?: string;
  id?: string;
}

interface NavigatorWithInstalledApps extends Navigator {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
}

interface PWASharedState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isPrompting: boolean;
  isDismissed: boolean;
  lastOutcome: InstallPromptOutcome | null;
  serviceWorkerReady: boolean;
  environment: InstallEnvironmentInfo;
}

const DISMISS_STORAGE_KEY = 'bercali_pwa_install_dismissed_v1';
const INSTALL_PROMPT_DELAY_MS = 90_000;

function readDismissedFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function computeEnvironment(): InstallEnvironmentInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'other',
      browser: 'other',
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isInAppBrowser: false,
      inAppName: null,
      isSecureContext: true,
      isInIframe: false,
    };
  }

  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  return detectInstallEnvironment({
    userAgent: window.navigator.userAgent ?? '',
    platform: window.navigator.platform ?? '',
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    isSecureContext: Boolean(window.isSecureContext),
    isInIframe: inIframe,
  });
}

function computeCurrentStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__bercaliAppInstalled === true) return true;

  const nav = window.navigator as NavigatorWithInstalledApps;
  const match = (q: string) =>
    typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false;

  return isStandaloneDisplayMode({
    standaloneMediaMatches: match('(display-mode: standalone)'),
    fullscreenMediaMatches: match('(display-mode: fullscreen)'),
    minimalUiMediaMatches: match('(display-mode: minimal-ui)'),
    navigatorStandalone: nav.standalone === true,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
}

const subscribers = new Set<() => void>();
let initialized = false;

let sharedState: PWASharedState = {
  deferredPrompt:
    typeof window !== 'undefined' ? (window.__bercaliDeferredInstallPrompt ?? null) : null,
  isInstalled: computeCurrentStandalone(),
  isPrompting: false,
  isDismissed: readDismissedFlag(),
  lastOutcome: null,
  serviceWorkerReady: false,
  environment: computeEnvironment(),
};

function emitChange() {
  for (const listener of subscribers) {
    listener();
  }
}

function updateSharedState(patch: Partial<PWASharedState>) {
  sharedState = { ...sharedState, ...patch };
  emitChange();
}

function ensureStoreInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Sincronizar eventos capturados precocemente em index.html antes de o React montar
  const earlyPrompt = window.__bercaliDeferredInstallPrompt ?? null;
  const standaloneNow = computeCurrentStandalone();
  sharedState = {
    ...sharedState,
    deferredPrompt: standaloneNow ? null : earlyPrompt,
    isInstalled: standaloneNow,
    environment: computeEnvironment(),
  };

  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    const promptEvent = event as BeforeInstallPromptEvent;
    window.__bercaliDeferredInstallPrompt = promptEvent;
    updateSharedState({
      deferredPrompt: promptEvent,
      isInstalled: computeCurrentStandalone() ? true : sharedState.isInstalled,
    });
  };

  const handleEarlyPromptCaptured = () => {
    const captured = window.__bercaliDeferredInstallPrompt ?? null;
    if (captured && captured !== sharedState.deferredPrompt) {
      updateSharedState({ deferredPrompt: captured });
    }
  };

  const handleInstalled = () => {
    window.__bercaliAppInstalled = true;
    window.__bercaliDeferredInstallPrompt = null;
    updateSharedState({
      isInstalled: true,
      deferredPrompt: null,
      isPrompting: false,
      lastOutcome: 'accepted',
    });
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('bercali:pwa-prompt-captured', handleEarlyPromptCaptured);
  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('bercali:pwa-installed', handleInstalled);

  if (typeof window.matchMedia === 'function') {
    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        updateSharedState({ isInstalled: true, deferredPrompt: null });
      } else {
        updateSharedState({ isInstalled: computeCurrentStandalone() });
      }
    };
    if (typeof standaloneMql.addEventListener === 'function') {
      standaloneMql.addEventListener('change', handleDisplayModeChange);
    }
  }

  // Verificar registo ativo do Service Worker se já existir
  if ('serviceWorker' in window.navigator) {
    window.navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg) {
          updateSharedState({ serviceWorkerReady: true });
        }
      })
      .catch(() => {
        // Ignora silenciosamente
      });
  }

  // Em contextos de topo (fora de iframe), verificar aplicações relacionadas instaladas quando suportado
  const nav = window.navigator as NavigatorWithInstalledApps;
  if (!sharedState.environment.isInIframe && typeof nav.getInstalledRelatedApps === 'function') {
    nav
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) {
          updateSharedState({ isInstalled: true, deferredPrompt: null });
        }
      })
      .catch(() => {
        // Alguns navegadores bloqueiam esta consulta; ignorar sem erro
      });
  }
}

export function notifyServiceWorkerStatus(ready: boolean) {
  ensureStoreInitialized();
  if (sharedState.serviceWorkerReady !== ready) {
    updateSharedState({ serviceWorkerReady: ready });
  }
}

function subscribe(listener: () => void) {
  ensureStoreInitialized();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function getSnapshot(): PWASharedState {
  ensureStoreInitialized();
  return sharedState;
}

export function dismissPWAInvite() {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // Mantém em memória na sessão atual
  }
  updateSharedState({ isDismissed: true });
}

export function clearPWAInstallOutcome() {
  if (sharedState.lastOutcome !== null) {
    updateSharedState({ lastOutcome: null });
  }
}

export async function triggerNativePWAInstall(): Promise<InstallPromptOutcome> {
  ensureStoreInitialized();

  if (sharedState.isPrompting) {
    return 'unavailable';
  }

  const promptEvent =
    sharedState.deferredPrompt ??
    (typeof window !== 'undefined' ? (window.__bercaliDeferredInstallPrompt ?? null) : null);

  if (!promptEvent || typeof promptEvent.prompt !== 'function') {
    return 'unavailable';
  }

  updateSharedState({ isPrompting: true, lastOutcome: null });

  try {
    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    const outcome = choiceResult?.outcome === 'accepted' ? 'accepted' : 'dismissed';

    // O evento beforeinstallprompt só pode ser utilizado uma única vez por instância
    if (typeof window !== 'undefined') {
      window.__bercaliDeferredInstallPrompt = null;
    }

    if (outcome === 'accepted') {
      if (typeof window !== 'undefined') {
        window.__bercaliAppInstalled = true;
      }
      updateSharedState({
        deferredPrompt: null,
        isPrompting: false,
        isInstalled: true,
        lastOutcome: 'accepted',
      });
      return 'accepted';
    }

    dismissPWAInvite();
    updateSharedState({
      deferredPrompt: null,
      isPrompting: false,
      lastOutcome: 'dismissed',
    });
    return 'dismissed';
  } catch {
    if (typeof window !== 'undefined') {
      window.__bercaliDeferredInstallPrompt = null;
    }
    updateSharedState({
      deferredPrompt: null,
      isPrompting: false,
      lastOutcome: 'failed',
    });
    return 'failed';
  }
}

export function usePWAInstall(currentPathname: string) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [delayElapsed, setDelayElapsed] = useState<boolean>(false);
  const [isTypingInForm, setIsTypingInForm] = useState<boolean>(false);

  useEffect(() => {
    const handleFocusChange = () => {
      const active = document.activeElement;
      if (!active) {
        setIsTypingInForm(false);
        return;
      }
      const tag = active.tagName.toLowerCase();
      setIsTypingInForm(tag === 'input' || tag === 'textarea' || tag === 'select');
    };

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    const timer = window.setTimeout(() => {
      setDelayElapsed(true);
    }, INSTALL_PROMPT_DELAY_MS);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      window.clearTimeout(timer);
    };
  }, []);

  const triggerNativeInstall = useCallback(() => triggerNativePWAInstall(), []);
  const dismissPrompt = useCallback(() => dismissPWAInvite(), []);
  const clearOutcome = useCallback(() => clearPWAInstallOutcome(), []);

  const isCheckoutRoute = currentPathname.startsWith('/finalizar');
  const isInstallableNatively = Boolean(snapshot.deferredPrompt);
  const canOfferInvite = isInstallableNatively || snapshot.environment.isIOS;

  const shouldShowTimedInvite =
    delayElapsed &&
    canOfferInvite &&
    !snapshot.isInstalled &&
    !snapshot.isDismissed &&
    !isCheckoutRoute &&
    !isTypingInForm;

  return {
    isInstalled: snapshot.isInstalled,
    isInstallableNatively,
    isPrompting: snapshot.isPrompting,
    isIOS: snapshot.environment.isIOS,
    isAndroid: snapshot.environment.isAndroid,
    environment: snapshot.environment,
    serviceWorkerReady: snapshot.serviceWorkerReady,
    lastOutcome: snapshot.lastOutcome,
    shouldShowTimedInvite,
    triggerNativeInstall,
    dismissPrompt,
    clearOutcome,
  };
}
