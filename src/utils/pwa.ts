export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPromptOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'failed';

export type DetectedOS = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'other';

export type DetectedBrowser =
  | 'safari'
  | 'chrome'
  | 'edge'
  | 'samsung'
  | 'firefox'
  | 'opera'
  | 'in-app'
  | 'other';

export interface InstallEnvironmentInput {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  isSecureContext?: boolean;
  isInIframe?: boolean;
}

export interface InstallEnvironmentInfo {
  os: DetectedOS;
  browser: DetectedBrowser;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isInAppBrowser: boolean;
  inAppName: string | null;
  isSecureContext: boolean;
  isInIframe: boolean;
}

export interface StandaloneDetectionInput {
  standaloneMediaMatches: boolean;
  fullscreenMediaMatches?: boolean;
  minimalUiMediaMatches?: boolean;
  navigatorStandalone?: boolean;
  referrer?: string;
}

export interface ManualInstallGuide {
  id: 'auto' | 'android' | 'ios';
  deviceLabel: string;
  title: string;
  description: string;
  steps: string[];
  secondaryTip?: string;
  contextNotice?: string;
}

export type InstallFallbackCaseId =
  | 'in-app'
  | 'ios-safari'
  | 'ios-other'
  | 'samsung'
  | 'firefox-android'
  | 'chromium-no-event'
  | 'desktop-chromium'
  | 'macos-safari'
  | 'desktop-other';

export interface InstallFallbackOptions {
  brandName?: string;
  currentUrl?: string;
  wasRecentlyDismissed?: boolean;
  wasPreviouslyInstalled?: boolean;
}

export interface InstallFallbackInstruction {
  caseId: InstallFallbackCaseId;
  deviceLabel: string;
  title: string;
  primaryInstruction: string;
  steps: string[];
  statusNote?: string;
  secondaryHelper?: string;
  contextNotice?: string;
  showCopyLinkButton: boolean;
  showOpenInChromeButton: boolean;
  copyUrl: string;
  openInChromeUrl: string;
}

export const PWA_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const IN_APP_INSTALL_INSTRUCTION = 'Para instalar, abre a loja no Chrome';

export const IOS_SAFARI_INSTALL_INSTRUCTION =
  'Toca em Partilhar e depois em Adicionar ao ecrã principal';

export const IOS_OTHER_BROWSER_INSTALL_INSTRUCTION = 'Abre esta página no Safari';

export const SAMSUNG_INTERNET_INSTALL_INSTRUCTION =
  'Menu (≡) > Adicionar página a > Ecrã inicial';

export const FIREFOX_ANDROID_INSTALL_INSTRUCTION = 'Menu (⋮) > Instalar';

export const CHROME_EDGE_NO_EVENT_INSTALL_INSTRUCTION =
  'Menu (⋮) > Instalar app ou Adicionar ao ecrã inicial';

export const DESKTOP_CHROMIUM_INSTALL_INSTRUCTION =
  'Clica no ícone de instalação na barra de endereços ou abre o menu (⋮) > Instalar aplicação';

export const MACOS_SAFARI_INSTALL_INSTRUCTION =
  'Na barra do Safari, abre Ficheiro > Adicionar à Dock';

export const DESKTOP_OTHER_BROWSER_INSTALL_INSTRUCTION =
  'Para instalar no computador, abre esta loja no Google Chrome ou Microsoft Edge';

export function isPWADebugQueryEnabled(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    const normalized = search.startsWith('?') ? search : `?${search}`;
    return new URLSearchParams(normalized).get('debug') === 'pwa';
  } catch {
    return false;
  }
}

export function isPWAInviteDismissed(
  rawValue: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!rawValue) return false;
  const trimmed = rawValue.trim();
  if (!trimmed) return false;
  const dismissedAt = Number(trimmed);
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) {
    return false;
  }
  const elapsed = Math.max(0, nowMs - dismissedAt);
  return elapsed < PWA_DISMISS_DURATION_MS;
}

export function serializePWADismissTimestamp(nowMs = Date.now()): string {
  return String(Math.floor(nowMs));
}

export function isStandaloneDisplayMode(input: StandaloneDetectionInput): boolean {
  if (input.standaloneMediaMatches) return true;
  if (input.fullscreenMediaMatches) return true;
  if (input.navigatorStandalone === true) return true;
  if (typeof input.referrer === 'string' && input.referrer.startsWith('android-app://')) {
    return true;
  }
  return false;
}

export function buildCleanShareableStoreUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '/';
  try {
    const parsed = new URL(trimmed);
    if (parsed.searchParams.get('debug') === 'pwa') {
      parsed.searchParams.delete('debug');
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function buildAndroidChromeIntentUrl(rawUrl: string): string {
  const cleanUrl = buildCleanShareableStoreUrl(rawUrl);
  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.host;
    const path = `${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
    return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
  } catch {
    const withoutScheme = cleanUrl.replace(/^https?:\/\//i, '');
    const normalized = withoutScheme.includes('/') ? withoutScheme : `${withoutScheme}/`;
    return `intent://${normalized}#Intent;scheme=https;package=com.android.chrome;end`;
  }
}

export function buildOpenInChromeUrl(rawUrl: string, env: InstallEnvironmentInfo): string {
  const cleanUrl = buildCleanShareableStoreUrl(rawUrl);
  if (env.isAndroid || !env.isIOS) {
    return buildAndroidChromeIntentUrl(cleanUrl);
  }
  try {
    const parsed = new URL(cleanUrl);
    const scheme = parsed.protocol === 'http:' ? 'googlechrome' : 'googlechromes';
    const path = `${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
    return `${scheme}://${parsed.host}${path}`;
  } catch {
    return cleanUrl;
  }
}

export function detectInstallEnvironment(input: InstallEnvironmentInput): InstallEnvironmentInfo {
  const ua = (input.userAgent || '').trim();
  const uaLower = ua.toLowerCase();
  const platform = (input.platform || '').toLowerCase();
  const touchPoints = input.maxTouchPoints ?? 0;

  const isIPadOSDesktopUA = platform === 'macintel' && touchPoints > 1;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || isIPadOSDesktopUA;
  const isAndroid = !isIOS && /android/i.test(ua);

  let os: DetectedOS = 'other';
  if (isIOS) {
    os = 'ios';
  } else if (isAndroid) {
    os = 'android';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macos';
  } else if (/windows/i.test(ua)) {
    os = 'windows';
  } else if (/linux/i.test(ua)) {
    os = 'linux';
  }

  let inAppName: string | null = null;
  if (/whatsapp|waios/i.test(ua)) {
    inAppName = 'WhatsApp';
  } else if (/\bmessenger\b|fban\/messenger|fb_iab\/messenger|orca-android/i.test(ua)) {
    inAppName = 'Messenger';
  } else if (/instagram/i.test(ua)) {
    inAppName = 'Instagram';
  } else if (/fban|fbav|fb_iab|fb4a|fbsv/i.test(ua)) {
    inAppName = 'Facebook';
  } else if (/bytedancewebview|musical_ly|tiktok|trill/i.test(ua)) {
    inAppName = 'TikTok';
  } else if (/telegram/i.test(ua)) {
    inAppName = 'Telegram';
  } else if (/linkedinapp/i.test(ua)) {
    inAppName = 'LinkedIn';
  }

  const isInAppBrowser = inAppName !== null;

  let browser: DetectedBrowser = 'other';
  if (isInAppBrowser) {
    browser = 'in-app';
  } else if (/samsungbrowser/i.test(uaLower)) {
    browser = 'samsung';
  } else if (/edg\/|edga\/|edgios\//i.test(uaLower) || /\bedg\b/i.test(uaLower)) {
    browser = 'edge';
  } else if (/opr\/|opera|opios/i.test(uaLower)) {
    browser = 'opera';
  } else if (/firefox|fxios/i.test(uaLower)) {
    browser = 'firefox';
  } else if (/crios|chrome|chromium/i.test(uaLower)) {
    browser = 'chrome';
  } else if (
    isIOS &&
    /gsa\/|duckduckgo|yabrowser|alohabrowser|brave|focus/i.test(uaLower)
  ) {
    browser = 'other';
  } else if (/safari/i.test(uaLower)) {
    browser = 'safari';
  }

  return {
    os,
    browser,
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid,
    isInAppBrowser,
    inAppName,
    isSecureContext: input.isSecureContext ?? true,
    isInIframe: input.isInIframe ?? false,
  };
}

function buildContextNotice(env: InstallEnvironmentInfo): string | undefined {
  if (!env.isSecureContext) {
    return 'A instalação da app exige ligação segura HTTPS.';
  }
  if (env.isInIframe) {
    return 'Estás numa janela incorporada (pré-visualização). Abre o endereço HTTPS da loja num separador normal para instalar.';
  }
  return undefined;
}

export function resolveInstallFallbackInstruction(
  env: InstallEnvironmentInfo,
  options: InstallFallbackOptions = {}
): InstallFallbackInstruction {
  const cleanBrand = (options.brandName || 'Bercali Store').trim() || 'Bercali Store';
  const rawUrl = options.currentUrl || 'https://bercalistore.ao/';
  const copyUrl = buildCleanShareableStoreUrl(rawUrl);
  const openInChromeUrl = buildOpenInChromeUrl(rawUrl, env);
  const contextNotice = buildContextNotice(env);

  // a) Navegador interno (WhatsApp, Facebook, Instagram, TikTok, Messenger, etc.)
  if (env.isInAppBrowser) {
    const appLabel = env.inAppName || 'aplicação atual';
    return {
      caseId: 'in-app',
      deviceLabel: `Navegador interno · ${appLabel}`,
      title: `Instalar ${cleanBrand}`,
      primaryInstruction: IN_APP_INSTALL_INSTRUCTION,
      steps: env.isIOS
        ? [
            'Toca em «Copiar link» abaixo.',
            'Abre o Safari no teu iPhone ou iPad e cola o endereço.',
            'Toca em Partilhar e escolhe «Adicionar ao ecrã principal».',
          ]
        : [
            'Toca em «Abrir no Chrome» abaixo (ou copia o link).',
            'No Google Chrome, toca em «Instalar» ou abre o menu (⋮) > Instalar aplicação.',
          ],
      secondaryHelper: env.isIOS
        ? 'No iPhone/iPad, a instalação no ecrã principal é feita manualmente através do Safari.'
        : undefined,
      contextNotice,
      showCopyLinkButton: true,
      showOpenInChromeButton: true,
      copyUrl,
      openInChromeUrl,
    };
  }

  // b) iPhone / iPad (nunca prometer instalação automática no iOS)
  if (env.isIOS) {
    if (env.browser === 'safari') {
      return {
        caseId: 'ios-safari',
        deviceLabel: 'iPhone / iPad · Safari',
        title: `Instalar ${cleanBrand}`,
        primaryInstruction: IOS_SAFARI_INSTALL_INSTRUCTION,
        steps: [
          'Toca no botão Partilhar (quadrado com seta para cima) na barra do Safari.',
          'Desliza as opções e seleciona «Adicionar ao ecrã principal».',
          'Confirma em «Adicionar» no canto superior direito.',
        ],
        contextNotice,
        showCopyLinkButton: false,
        showOpenInChromeButton: false,
        copyUrl,
        openInChromeUrl,
      };
    }

    return {
      caseId: 'ios-other',
      deviceLabel: 'iPhone / iPad',
      title: `Instalar ${cleanBrand}`,
      primaryInstruction: IOS_OTHER_BROWSER_INSTALL_INSTRUCTION,
      steps: [
        'Toca em «Copiar link» abaixo.',
        'Abre a aplicação Safari no teu iPhone ou iPad e cola o endereço.',
        'No Safari, toca em Partilhar e depois em «Adicionar ao ecrã principal».',
      ],
      secondaryHelper:
        'No iPhone e iPad, adiciona a loja ao ecrã principal através do Safari.',
      contextNotice,
      showCopyLinkButton: true,
      showOpenInChromeButton: false,
      copyUrl,
      openInChromeUrl,
    };
  }

  // c) Samsung Internet
  if (env.browser === 'samsung') {
    return {
      caseId: 'samsung',
      deviceLabel: 'Samsung Internet',
      title: `Instalar ${cleanBrand}`,
      primaryInstruction: SAMSUNG_INTERNET_INSTALL_INSTRUCTION,
      steps: [
        'Toca no menu (≡) no canto inferior direito do Samsung Internet.',
        'Seleciona «Adicionar página a» e toca em «Ecrã inicial».',
      ],
      contextNotice,
      showCopyLinkButton: false,
      showOpenInChromeButton: false,
      copyUrl,
      openInChromeUrl,
    };
  }

  // d) Firefox Android
  if (env.isAndroid && env.browser === 'firefox') {
    return {
      caseId: 'firefox-android',
      deviceLabel: 'Firefox Android',
      title: `Instalar ${cleanBrand}`,
      primaryInstruction: FIREFOX_ANDROID_INSTALL_INSTRUCTION,
      steps: [
        'Toca no menu (⋮) do Firefox.',
        'Escolhe «Instalar» ou «Adicionar ao ecrã inicial» e confirma.',
      ],
      contextNotice,
      showCopyLinkButton: false,
      showOpenInChromeButton: false,
      copyUrl,
      openInChromeUrl,
    };
  }

  // e) Computador (Windows, macOS, Linux) — instruções específicas de desktop
  if (!env.isMobile) {
    if (env.os === 'macos' && env.browser === 'safari') {
      return {
        caseId: 'macos-safari',
        deviceLabel: 'Mac · Safari',
        title: `Instalar ${cleanBrand}`,
        primaryInstruction: MACOS_SAFARI_INSTALL_INSTRUCTION,
        steps: [
          'Na barra superior do Safari, abre o menu «Ficheiro».',
          'Clica em «Adicionar à Dock…» e confirma em «Adicionar».',
        ],
        contextNotice,
        showCopyLinkButton: false,
        showOpenInChromeButton: false,
        copyUrl,
        openInChromeUrl,
      };
    }

    if (env.browser === 'chrome' || env.browser === 'edge' || env.browser === 'opera') {
      const browserLabel =
        env.browser === 'edge'
          ? 'Computador · Microsoft Edge'
          : env.browser === 'opera'
          ? 'Computador · Opera'
          : 'Computador · Google Chrome';

      let desktopStatusNote: string | undefined;
      if (options.wasPreviouslyInstalled) {
        desktopStatusNote = `A ${cleanBrand} já parece estar instalada neste navegador. Podes abri-la a partir das tuas aplicações ou pelo ícone na barra de endereços.`;
      } else if (options.wasRecentlyDismissed) {
        desktopStatusNote =
          'O pedido automático foi dispensado recentemente. Usa o ícone na barra de endereços ou o menu do navegador para instalar.';
      }

      return {
        caseId: 'desktop-chromium',
        deviceLabel: browserLabel,
        title: `Instalar ${cleanBrand}`,
        primaryInstruction: DESKTOP_CHROMIUM_INSTALL_INSTRUCTION,
        steps: [
          'Clica no ícone de instalação no lado direito da barra de endereços.',
          `Em alternativa, abre o menu do navegador (⋮ ou ⋯) e escolhe «Instalar ${cleanBrand}».`,
        ],
        statusNote: desktopStatusNote,
        contextNotice,
        showCopyLinkButton: false,
        showOpenInChromeButton: false,
        copyUrl,
        openInChromeUrl,
      };
    }

    return {
      caseId: 'desktop-other',
      deviceLabel:
        env.browser === 'firefox' ? 'Computador · Mozilla Firefox' : 'Computador · Navegador',
      title: `Instalar ${cleanBrand}`,
      primaryInstruction: DESKTOP_OTHER_BROWSER_INSTALL_INSTRUCTION,
      steps: [
        'Copia o link da loja no botão abaixo.',
        'Abre o endereço no Google Chrome ou Microsoft Edge e clica no ícone de instalação na barra de endereços.',
      ],
      contextNotice,
      showCopyLinkButton: true,
      showOpenInChromeButton: false,
      copyUrl,
      openInChromeUrl,
    };
  }

  // f) Android (Chrome / Edge / outro navegador) sem evento beforeinstallprompt
  let statusNote: string;
  if (options.wasPreviouslyInstalled && options.wasRecentlyDismissed) {
    statusNote =
      'Esta app já foi instalada anteriormente ou dispensada recentemente neste navegador. Verifica o ecrã inicial ou instala pelo menu (⋮).';
  } else if (options.wasPreviouslyInstalled) {
    statusNote =
      'Esta app já parece estar instalada neste dispositivo. Procura «Bercali» no ecrã inicial ou usa o menu (⋮) para abrir.';
  } else if (options.wasRecentlyDismissed) {
    statusNote =
      'O pedido de instalação foi dispensado recentemente, por isso a janela automática não apareceu agora. Podes instalar pelo menu (⋮).';
  } else {
    statusNote =
      'Se a app já estiver instalada no telemóvel ou tiver sido dispensada recentemente, o aviso automático não aparece — verifica o ecrã inicial ou usa o menu (⋮).';
  }

  const deviceLabel =
    env.browser === 'edge'
      ? 'Android · Microsoft Edge'
      : env.browser === 'chrome'
      ? 'Android · Google Chrome'
      : 'Android · Navegador';

  return {
    caseId: 'chromium-no-event',
    deviceLabel,
    title: `Instalar ${cleanBrand}`,
    primaryInstruction: CHROME_EDGE_NO_EVENT_INSTALL_INSTRUCTION,
    steps: [
      'Toca no menu (⋮) no canto superior direito do navegador.',
      'Seleciona «Instalar aplicação» ou «Adicionar ao ecrã inicial» e confirma.',
    ],
    statusNote,
    contextNotice,
    showCopyLinkButton: false,
    showOpenInChromeButton: false,
    copyUrl,
    openInChromeUrl,
  };
}

export function getAndroidInstallGuide(
  brandName = 'Bercali Store',
  env?: InstallEnvironmentInfo
): ManualInstallGuide {
  const effectiveEnv: InstallEnvironmentInfo = env ?? {
    os: 'android',
    browser: 'chrome',
    isIOS: false,
    isAndroid: true,
    isMobile: true,
    isInAppBrowser: false,
    inAppName: null,
    isSecureContext: true,
    isInIframe: false,
  };
  const resolved = resolveInstallFallbackInstruction(effectiveEnv, { brandName });
  return {
    id: 'android',
    deviceLabel: resolved.deviceLabel,
    title: `${resolved.title} no Android`,
    description: resolved.primaryInstruction,
    steps: resolved.steps,
    secondaryTip: resolved.statusNote,
    contextNotice: resolved.contextNotice,
  };
}

export function getIOSInstallGuide(
  brandName = 'Bercali Store',
  env?: InstallEnvironmentInfo
): ManualInstallGuide {
  const effectiveEnv: InstallEnvironmentInfo = env ?? {
    os: 'ios',
    browser: 'safari',
    isIOS: true,
    isAndroid: false,
    isMobile: true,
    isInAppBrowser: false,
    inAppName: null,
    isSecureContext: true,
    isInIframe: false,
  };
  const resolved = resolveInstallFallbackInstruction(effectiveEnv, { brandName });
  return {
    id: 'ios',
    deviceLabel: resolved.deviceLabel,
    title: `${resolved.title} no iPhone / iPad`,
    description: resolved.primaryInstruction,
    steps: resolved.steps,
    secondaryTip: resolved.secondaryHelper,
    contextNotice: resolved.contextNotice,
  };
}

export function getManualInstallGuide(
  env: InstallEnvironmentInfo,
  brandName = 'Bercali Store'
): ManualInstallGuide {
  const resolved = resolveInstallFallbackInstruction(env, { brandName });
  return {
    id: env.isIOS && !env.isInAppBrowser ? 'ios' : env.isAndroid && !env.isInAppBrowser ? 'android' : 'auto',
    deviceLabel: resolved.deviceLabel,
    title: resolved.title,
    description: resolved.primaryInstruction,
    steps: resolved.steps,
    secondaryTip: resolved.statusNote ?? resolved.secondaryHelper,
    contextNotice: resolved.contextNotice,
  };
}

export function formatInstallOutcomeFeedback(
  outcome: InstallPromptOutcome,
  brandName = 'Bercali Store'
): { tone: 'success' | 'neutral' | 'warning'; message: string } | null {
  const cleanBrand = brandName.trim() || 'Bercali Store';

  switch (outcome) {
    case 'accepted':
      return {
        tone: 'success',
        message: `Instalação aceite! A ${cleanBrand} foi adicionada ao teu dispositivo.`,
      };
    case 'dismissed':
      return {
        tone: 'neutral',
        message:
          'Pedido de instalação cancelado. Podes instalar mais tarde pelo botão ou pelo menu do navegador.',
      };
    case 'failed':
      return {
        tone: 'warning',
        message:
          'O navegador não concluiu o pedido automático. Segue as instruções manuais para o teu dispositivo.',
      };
    case 'unavailable':
    default:
      return null;
  }
}
