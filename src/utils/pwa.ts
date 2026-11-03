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
  windowControlsOverlayMediaMatches?: boolean;
  minimalUiMediaMatches?: boolean;
  navigatorStandalone?: boolean;
  referrer?: string;
}

export const UNAVAILABLE_INSTALL_MESSAGE =
  'Neste momento, a instalação não está disponível neste dispositivo.';

export const IOS_UNAVAILABLE_INSTALL_MESSAGE =
  'A instalação direta não está disponível neste dispositivo.';

export function isPWADebugQueryEnabled(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    const normalized = search.startsWith('?') ? search : `?${search}`;
    return new URLSearchParams(normalized).get('debug') === 'pwa';
  } catch {
    return false;
  }
}

export function isStandaloneDisplayMode(input: StandaloneDetectionInput): boolean {
  if (input.standaloneMediaMatches) return true;
  if (input.fullscreenMediaMatches) return true;
  if (input.windowControlsOverlayMediaMatches) return true;
  if (input.navigatorStandalone === true) return true;
  if (typeof input.referrer === 'string' && input.referrer.startsWith('android-app://')) {
    return true;
  }
  return false;
}

export function detectInstallEnvironment(input: InstallEnvironmentInput): InstallEnvironmentInfo {
  const ua = (input.userAgent || '').trim();
  const uaLower = ua.toLowerCase();
  const platform = (input.platform || '').toLowerCase();
  const touchPoints = input.maxTouchPoints ?? 0;

  // Deteta iPhone, iPod, iPad clássico e iPadOS em modo desktop (MacIntel com ecrã tátil)
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

export function getUnavailableInstallMessage(
  env: Pick<InstallEnvironmentInfo, 'isIOS'>
): string {
  if (env.isIOS) {
    return IOS_UNAVAILABLE_INSTALL_MESSAGE;
  }
  return UNAVAILABLE_INSTALL_MESSAGE;
}

export function formatInstallOutcomeFeedback(
  outcome: InstallPromptOutcome,
  env: Pick<InstallEnvironmentInfo, 'isIOS'> = { isIOS: false }
): { tone: 'success' | 'neutral'; message: string } | null {
  switch (outcome) {
    case 'accepted':
      return {
        tone: 'success',
        message: 'Aplicação instalada neste dispositivo.',
      };
    case 'dismissed':
      return null;
    case 'failed':
    case 'unavailable':
      return {
        tone: 'neutral',
        message: getUnavailableInstallMessage(env),
      };
    default:
      return null;
  }
}
