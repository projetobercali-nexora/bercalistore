import { useCallback, useSyncExternalStore } from 'react';
import {
  detectInstallEnvironment,
  isStandaloneDisplayMode,
  type BeforeInstallPromptEvent,
  type InstallEnvironmentInfo,
  type InstallPromptOutcome,
} from '../utils/pwa';

export interface BercaliEarlyPWAWindowState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptReceived: boolean;
  promptReceivedAt: number | null;
  appInstalled: boolean;
  listenersAttached?: boolean;
}

declare global {
  interface Window {
    __bercaliPwa?: BercaliEarlyPWAWindowState;
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
  promptEverReceived: boolean;
  promptReceivedAt: number | null;
  isInstalled: boolean;
  isPrompting: boolean;
  wasPreviouslyInstalled: boolean;
  lastOutcome: InstallPromptOutcome | null;
  serviceWorkerReady: boolean;
  updateAvailable: boolean;
  environment: InstallEnvironmentInfo;
}

const EVER_INSTALLED_STORAGE_KEY = 'bercali_pwa_ever_installed';
const NATIVE_PROMPT_OPEN_TIMEOUT_MS = 8_000;

function readPreviouslyInstalledFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(EVER_INSTALLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistPreviouslyInstalledFlag() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EVER_INSTALLED_STORAGE_KEY, '1');
  } catch {
    // Ignora restrições de armazenamento privado
  }
}

function readEarlyGlobalPrompt(): {
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptReceived: boolean;
  promptReceivedAt: number | null;
  appInstalled: boolean;
  listenersAttached: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      deferredPrompt: null,
      promptReceived: false,
      promptReceivedAt: null,
      appInstalled: false,
      listenersAttached: false,
    };
  }
  const early = window.__bercaliPwa;
  const deferredPrompt =
    early?.deferredPrompt ?? window.__bercaliDeferredInstallPrompt ?? null;
  const promptReceived = Boolean(early?.promptReceived || deferredPrompt);
  const promptReceivedAt = early?.promptReceivedAt ?? (deferredPrompt ? Date.now() : null);
  const appInstalled = Boolean(early?.appInstalled || window.__bercaliAppInstalled);
  const listenersAttached = Boolean(early?.listenersAttached);
  return {
    deferredPrompt,
    promptReceived,
    promptReceivedAt,
    appInstalled,
    listenersAttached,
  };
}

function syncWindowGlobalPrompt(
  deferredPrompt: BeforeInstallPromptEvent | null,
  appInstalled?: boolean
) {
  if (typeof window === 'undefined') return;
  window.__bercaliDeferredInstallPrompt = deferredPrompt;
  if (typeof appInstalled === 'boolean') {
    window.__bercaliAppInstalled = appInstalled;
  }
  if (window.__bercaliPwa) {
    window.__bercaliPwa.deferredPrompt = deferredPrompt;
    if (deferredPrompt) {
      window.__bercaliPwa.promptReceived = true;
      if (!window.__bercaliPwa.promptReceivedAt) {
        window.__bercaliPwa.promptReceivedAt = Date.now();
      }
    }
    if (typeof appInstalled === 'boolean') {
      window.__bercaliPwa.appInstalled = appInstalled;
    }
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
  const early = readEarlyGlobalPrompt();
  if (early.appInstalled) return true;

  const nav = window.navigator as NavigatorWithInstalledApps;
  const match = (q: string) =>
    typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false;

  return isStandaloneDisplayMode({
    standaloneMediaMatches: match('(display-mode: standalone)'),
    fullscreenMediaMatches: match('(display-mode: fullscreen)'),
    windowControlsOverlayMediaMatches: match('(display-mode: window-controls-overlay)'),
    navigatorStandalone: nav.standalone === true,
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  });
}

const subscribers = new Set<() => void>();
let initialized = false;
let pendingUpdateHandler: (() => Promise<void> | void) | null = null;

const initialEarly = readEarlyGlobalPrompt();

let sharedState: PWASharedState = {
  deferredPrompt: initialEarly.deferredPrompt,
  promptEverReceived: initialEarly.promptReceived,
  promptReceivedAt: initialEarly.promptReceivedAt,
  isInstalled: computeCurrentStandalone(),
  isPrompting: false,
  wasPreviouslyInstalled: readPreviouslyInstalledFlag(),
  lastOutcome: null,
  serviceWorkerReady: false,
  updateAvailable: false,
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

export function ensurePWAStoreInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const early = readEarlyGlobalPrompt();
  const standaloneNow = computeCurrentStandalone();
  if (standaloneNow) {
    persistPreviouslyInstalledFlag();
  }

  sharedState = {
    ...sharedState,
    deferredPrompt: standaloneNow ? null : early.deferredPrompt,
    promptEverReceived: early.promptReceived,
    promptReceivedAt: early.promptReceivedAt,
    isInstalled: standaloneNow,
    wasPreviouslyInstalled: standaloneNow || readPreviouslyInstalledFlag(),
    environment: computeEnvironment(),
  };

  const applyCapturedPrompt = (promptEvent: BeforeInstallPromptEvent | null, receivedAt?: number | null) => {
    if (!promptEvent || promptEvent === sharedState.deferredPrompt) {
      return;
    }
    if (computeCurrentStandalone()) {
      return;
    }
    const now = receivedAt ?? Date.now();
    syncWindowGlobalPrompt(promptEvent);
    updateSharedState({
      deferredPrompt: promptEvent,
      promptEverReceived: true,
      promptReceivedAt: sharedState.promptReceivedAt ?? now,
      isInstalled: false,
      lastOutcome: null,
    });
  };

  const handleEarlyPromptCaptured = () => {
    const captured = readEarlyGlobalPrompt();
    applyCapturedPrompt(captured.deferredPrompt, captured.promptReceivedAt);
  };

  const handleBeforeInstallPromptFallback = (event: Event) => {
    event.preventDefault();
    applyCapturedPrompt(event as BeforeInstallPromptEvent, Date.now());
  };

  const handleInstalled = () => {
    if (sharedState.isInstalled && sharedState.deferredPrompt === null && sharedState.lastOutcome === 'accepted') {
      return;
    }
    syncWindowGlobalPrompt(null, true);
    persistPreviouslyInstalledFlag();
    updateSharedState({
      isInstalled: true,
      wasPreviouslyInstalled: true,
      deferredPrompt: null,
      isPrompting: false,
      lastOutcome: 'accepted',
    });
  };

  // Se index.html já registou os listeners nativos globais, escuta apenas os eventos internos
  // para impedir duplicação de listeners em beforeinstallprompt e appinstalled.
  if (early.listenersAttached) {
    window.addEventListener('bercali:pwa-prompt-captured', handleEarlyPromptCaptured);
    window.addEventListener('bercali:pwa-installed', handleInstalled);
  } else {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPromptFallback);
    window.addEventListener('appinstalled', handleInstalled);
  }

  if (typeof window.matchMedia === 'function') {
    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        persistPreviouslyInstalledFlag();
        syncWindowGlobalPrompt(null, true);
        updateSharedState({
          isInstalled: true,
          wasPreviouslyInstalled: true,
          deferredPrompt: null,
          isPrompting: false,
        });
      } else {
        updateSharedState({ isInstalled: computeCurrentStandalone() });
      }
    };
    if (typeof standaloneMql.addEventListener === 'function') {
      standaloneMql.addEventListener('change', handleDisplayModeChange);
    }
  }

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

  const nav = window.navigator as NavigatorWithInstalledApps;
  if (!sharedState.environment.isInIframe && typeof nav.getInstalledRelatedApps === 'function') {
    nav
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) {
          persistPreviouslyInstalledFlag();
          updateSharedState({
            wasPreviouslyInstalled: true,
            isInstalled: true,
            deferredPrompt: null,
          });
        }
      })
      .catch(() => {
        // Alguns navegadores restringem esta consulta; ignorar sem erro
      });
  }
}

export function notifyServiceWorkerStatus(ready: boolean) {
  ensurePWAStoreInitialized();
  if (sharedState.serviceWorkerReady !== ready) {
    updateSharedState({ serviceWorkerReady: ready });
  }
}

export function notifyServiceWorkerUpdateAvailable(applyFn: () => Promise<void> | void) {
  ensurePWAStoreInitialized();
  pendingUpdateHandler = applyFn;
  if (!sharedState.updateAvailable) {
    updateSharedState({ updateAvailable: true });
  }
}

export async function applyServiceWorkerUpdate(): Promise<void> {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/finalizar')) {
    return;
  }
  const handler = pendingUpdateHandler;
  pendingUpdateHandler = null;
  updateSharedState({ updateAvailable: false });
  if (handler) {
    await handler();
  }
}

function subscribe(listener: () => void) {
  ensurePWAStoreInitialized();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function getSnapshot(): PWASharedState {
  ensurePWAStoreInitialized();
  return sharedState;
}

export function clearPWAInstallOutcome() {
  if (sharedState.lastOutcome !== null) {
    updateSharedState({ lastOutcome: null });
  }
}

export async function triggerNativePWAInstall(): Promise<InstallPromptOutcome> {
  ensurePWAStoreInitialized();

  if (sharedState.isInstalled || sharedState.isPrompting) {
    return 'unavailable';
  }

  if (sharedState.environment.isIOS) {
    return 'unavailable';
  }

  const early = readEarlyGlobalPrompt();
  const promptEvent = sharedState.deferredPrompt ?? early.deferredPrompt;

  if (!promptEvent || typeof promptEvent.prompt !== 'function') {
    return 'unavailable';
  }

  updateSharedState({ isPrompting: true, lastOutcome: null });

  try {
    await Promise.race([
      promptEvent.prompt(),
      new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('prompt_open_timeout')),
          NATIVE_PROMPT_OPEN_TIMEOUT_MS
        );
      }),
    ]);

    const choiceResult = await promptEvent.userChoice;
    const outcome: InstallPromptOutcome =
      choiceResult?.outcome === 'accepted' ? 'accepted' : 'dismissed';

    // Limpa sempre a referência ao evento depois de utilizada (instância única)
    syncWindowGlobalPrompt(null, outcome === 'accepted' ? true : undefined);

    if (outcome === 'accepted') {
      persistPreviouslyInstalledFlag();
      updateSharedState({
        deferredPrompt: null,
        isPrompting: false,
        isInstalled: true,
        wasPreviouslyInstalled: true,
        lastOutcome: 'accepted',
      });
      return 'accepted';
    }

    updateSharedState({
      deferredPrompt: null,
      isPrompting: false,
      lastOutcome: 'dismissed',
    });
    return 'dismissed';
  } catch {
    syncWindowGlobalPrompt(null);
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

  const triggerNativeInstall = useCallback(() => triggerNativePWAInstall(), []);
  const clearOutcome = useCallback(() => clearPWAInstallOutcome(), []);
  const applyUpdate = useCallback(() => applyServiceWorkerUpdate(), []);

  const isCheckoutRoute = currentPathname.startsWith('/finalizar');
  const isInstallableNatively = Boolean(snapshot.deferredPrompt) && !snapshot.environment.isIOS && !snapshot.isInstalled;

  return {
    isInstalled: snapshot.isInstalled,
    isInstallableNatively,
    promptEverReceived: snapshot.promptEverReceived,
    promptReceivedAt: snapshot.promptReceivedAt,
    wasPreviouslyInstalled: snapshot.wasPreviouslyInstalled,
    isPrompting: snapshot.isPrompting,
    isIOS: snapshot.environment.isIOS,
    isAndroid: snapshot.environment.isAndroid,
    environment: snapshot.environment,
    serviceWorkerReady: snapshot.serviceWorkerReady,
    updateAvailable: snapshot.updateAvailable,
    isCheckoutRoute,
    lastOutcome: snapshot.lastOutcome,
    triggerNativeInstall,
    clearOutcome,
    applyUpdate,
  };
}
