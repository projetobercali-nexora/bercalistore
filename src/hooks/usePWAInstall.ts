import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  detectInstallEnvironment,
  isPWAInviteDismissed,
  isStandaloneDisplayMode,
  serializePWADismissTimestamp,
  type BeforeInstallPromptEvent,
  type InstallEnvironmentInfo,
  type InstallPromptOutcome,
} from '../utils/pwa';

export interface BercaliEarlyPWAWindowState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptReceived: boolean;
  promptReceivedAt: number | null;
  appInstalled: boolean;
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
  isDismissed: boolean;
  wasPreviouslyInstalled: boolean;
  lastOutcome: InstallPromptOutcome | null;
  serviceWorkerReady: boolean;
  updateAvailable: boolean;
  environment: InstallEnvironmentInfo;
}

const DISMISS_STORAGE_KEY = 'bercali_pwa_install_dismissed_at_v2';
const EVER_INSTALLED_STORAGE_KEY = 'bercali_pwa_ever_installed';
const INSTALL_PROMPT_DELAY_MS = 4_000;
const NATIVE_PROMPT_OPEN_TIMEOUT_MS = 5_000;

function readDismissedFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return isPWAInviteDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY));
  } catch {
    return false;
  }
}

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
    // Ignora restrições de armazenamento
  }
}

function readEarlyGlobalPrompt(): {
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptReceived: boolean;
  promptReceivedAt: number | null;
  appInstalled: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      deferredPrompt: null,
      promptReceived: false,
      promptReceivedAt: null,
      appInstalled: false,
    };
  }
  const early = window.__bercaliPwa;
  const deferredPrompt =
    early?.deferredPrompt ?? window.__bercaliDeferredInstallPrompt ?? null;
  const promptReceived = Boolean(early?.promptReceived || deferredPrompt);
  const promptReceivedAt = early?.promptReceivedAt ?? (deferredPrompt ? Date.now() : null);
  const appInstalled = Boolean(early?.appInstalled || window.__bercaliAppInstalled);
  return {
    deferredPrompt,
    promptReceived,
    promptReceivedAt,
    appInstalled,
  };
}

function syncWindowGlobalPrompt(deferredPrompt: BeforeInstallPromptEvent | null, appInstalled?: boolean) {
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
  isDismissed: readDismissedFlag(),
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

  // Sincronizar eventos capturados precocemente em index.html antes de o React montar
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
    isDismissed: readDismissedFlag(),
    wasPreviouslyInstalled: standaloneNow || readPreviouslyInstalledFlag(),
    environment: computeEnvironment(),
  };

  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    const promptEvent = event as BeforeInstallPromptEvent;
    const now = Date.now();
    syncWindowGlobalPrompt(promptEvent);
    updateSharedState({
      deferredPrompt: promptEvent,
      promptEverReceived: true,
      promptReceivedAt: sharedState.promptReceivedAt ?? now,
      isInstalled: computeCurrentStandalone() ? true : sharedState.isInstalled,
    });
  };

  const handleEarlyPromptCaptured = () => {
    const captured = readEarlyGlobalPrompt();
    if (captured.deferredPrompt && captured.deferredPrompt !== sharedState.deferredPrompt) {
      updateSharedState({
        deferredPrompt: captured.deferredPrompt,
        promptEverReceived: true,
        promptReceivedAt: captured.promptReceivedAt ?? Date.now(),
      });
    }
  };

  const handleInstalled = () => {
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

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('bercali:pwa-prompt-captured', handleEarlyPromptCaptured);
  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('bercali:pwa-installed', handleInstalled);

  if (typeof window.matchMedia === 'function') {
    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        persistPreviouslyInstalledFlag();
        updateSharedState({
          isInstalled: true,
          wasPreviouslyInstalled: true,
          deferredPrompt: null,
        });
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

  // Verificar se já existe aplicação relacionada instalada sem ocultar o botão quando fora de standalone
  const nav = window.navigator as NavigatorWithInstalledApps;
  if (!sharedState.environment.isInIframe && typeof nav.getInstalledRelatedApps === 'function') {
    nav
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) {
          persistPreviouslyInstalledFlag();
          updateSharedState({ wasPreviouslyInstalled: true });
        }
      })
      .catch(() => {
        // Alguns navegadores bloqueiam esta consulta; ignorar sem erro
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

export function dismissPWAInvite() {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, serializePWADismissTimestamp());
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
  ensurePWAStoreInitialized();

  if (sharedState.isPrompting) {
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
    const outcome = choiceResult?.outcome === 'accepted' ? 'accepted' : 'dismissed';

    // O evento beforeinstallprompt só pode ser utilizado uma única vez por instância
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

    dismissPWAInvite();
    updateSharedState({
      deferredPrompt: null,
      isPrompting: false,
      isDismissed: true,
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
  const applyUpdate = useCallback(() => applyServiceWorkerUpdate(), []);

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
    promptEverReceived: snapshot.promptEverReceived,
    promptReceivedAt: snapshot.promptReceivedAt,
    wasRecentlyDismissed: snapshot.isDismissed,
    wasPreviouslyInstalled: snapshot.wasPreviouslyInstalled,
    isPrompting: snapshot.isPrompting,
    isIOS: snapshot.environment.isIOS,
    isAndroid: snapshot.environment.isAndroid,
    environment: snapshot.environment,
    serviceWorkerReady: snapshot.serviceWorkerReady,
    updateAvailable: snapshot.updateAvailable,
    isCheckoutRoute,
    lastOutcome: snapshot.lastOutcome,
    shouldShowTimedInvite,
    triggerNativeInstall,
    dismissPrompt,
    clearOutcome,
    applyUpdate,
  };
}
