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

export function isStandaloneDisplayMode(input: StandaloneDetectionInput): boolean {
  if (input.standaloneMediaMatches) return true;
  if (input.fullscreenMediaMatches) return true;
  if (input.minimalUiMediaMatches) return true;
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
  if (/whatsapp/i.test(ua)) {
    inAppName = 'WhatsApp';
  } else if (/instagram/i.test(ua)) {
    inAppName = 'Instagram';
  } else if (/fban|fbav|fb_iab/i.test(ua)) {
    inAppName = 'Facebook';
  } else if (/bytedancewebview|musical_ly|tiktok/i.test(ua)) {
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
  } else if (/edg|edga|edgios/i.test(uaLower)) {
    browser = 'edge';
  } else if (/opr\/|opera/i.test(uaLower)) {
    browser = 'opera';
  } else if (/firefox|fxios/i.test(uaLower)) {
    browser = 'firefox';
  } else if (/crios|chrome|chromium/i.test(uaLower)) {
    browser = 'chrome';
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
    return 'A instalação direta da aplicação exige que a loja seja acedida através de uma ligação segura HTTPS.';
  }
  if (env.isInIframe) {
    return 'Estás a visualizar a loja numa janela incorporada (pré-visualização). Para que o navegador permita a instalação direta, abre o endereço público HTTPS da loja numa aba autónoma.';
  }
  return undefined;
}

export function getAndroidInstallGuide(
  brandName = 'Bercali Store',
  env?: InstallEnvironmentInfo
): ManualInstallGuide {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const contextNotice = env ? buildContextNotice(env) : undefined;

  if (env?.browser === 'samsung') {
    return {
      id: 'android',
      deviceLabel: 'Android · Samsung Internet',
      title: `Instalar ${cleanBrand} no Android`,
      description:
        'O teu navegador permite adicionar a loja ao ecrã principal como uma aplicação:',
      steps: [
        'Toca no ícone de transferência na barra de endereço ou abre o menu inferior no canto direito.',
        'Seleciona «Adicionar página a» e escolhe «Ecrã principal» (ou «Instalar aplicação»).',
        'Confirma em «Adicionar» para criar o ícone oficial da Bercali no teu telemóvel.',
      ],
      contextNotice,
    };
  }

  if (env?.browser === 'firefox') {
    return {
      id: 'android',
      deviceLabel: 'Android · Firefox',
      title: `Instalar ${cleanBrand} no Android`,
      description: 'Segue estes passos no Firefox para Android:',
      steps: [
        'Toca no botão de menu (três pontos) junto à barra de endereço.',
        'Seleciona «Instalar» (ou «Adicionar ao ecrã inicial»).',
        'Confirma para abrir a Bercali diretamente a partir do teu ecrã principal.',
      ],
      contextNotice,
    };
  }

  return {
    id: 'android',
    deviceLabel: 'Android · Chrome / Edge',
    title: `Instalar ${cleanBrand} no Android`,
    description:
      'Quando o pedido automático não aparece de imediato, podes instalar pelo menu do navegador:',
    steps: [
      'Toca no menu do navegador (três pontos no canto superior direito do Chrome ou Edge).',
      'Escolhe «Instalar aplicação» (ou «Adicionar ao ecrã principal»).',
      'Toca em «Instalar» para confirmar. O ícone da Bercali aparecerá junto às tuas aplicações.',
    ],
    secondaryTip:
      'Se abriste o link dentro do WhatsApp ou Instagram, escolhe primeiro «Abrir no Chrome» no menu superior.',
    contextNotice,
  };
}

export function getIOSInstallGuide(
  brandName = 'Bercali Store',
  env?: InstallEnvironmentInfo
): ManualInstallGuide {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const contextNotice = env ? buildContextNotice(env) : undefined;

  if (env?.isIOS && env.browser !== 'safari' && !env.isInAppBrowser) {
    return {
      id: 'ios',
      deviceLabel: 'iPhone / iPad',
      title: `Instalar ${cleanBrand} no iPhone ou iPad`,
      description:
        'Nos dispositivos Apple, a instalação é feita através do menu Partilhar do navegador (recomendado usar o Safari):',
      steps: [
        'Toca no ícone «Partilhar» (quadrado com seta para cima) na barra de endereço ou abre este link no Safari.',
        'Desliza a lista de opções para baixo e toca em «Adicionar ao ecrã principal».',
        'Toca em «Adicionar» no canto superior direito para criar o ícone da Bercali.',
      ],
      contextNotice,
    };
  }

  return {
    id: 'ios',
    deviceLabel: 'iPhone / iPad · Safari',
    title: `Instalar ${cleanBrand} no iPhone / Safari`,
    description:
      'O Safari no iPhone e iPad não mostra janela automática de instalação, mas permite instalar em 3 toques:',
    steps: [
      'Toca no botão «Partilhar» (ícone quadrado com seta para cima) na barra inferior ou superior do Safari.',
      'Desliza as opções para cima e seleciona «Adicionar ao ecrã principal».',
      'Confirma em «Adicionar» no canto superior direito. A Bercali abrirá como aplicação autónoma.',
    ],
    secondaryTip:
      'Certifica-te de que estás no Safari (e não dentro da janela interna do WhatsApp ou Instagram).',
    contextNotice,
  };
}

export function getManualInstallGuide(
  env: InstallEnvironmentInfo,
  brandName = 'Bercali Store'
): ManualInstallGuide {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const contextNotice = buildContextNotice(env);

  if (env.isInAppBrowser) {
    const appLabel = env.inAppName ?? 'aplicação atual';
    const targetBrowser = env.isIOS ? 'Safari' : 'Google Chrome';
    return {
      id: 'auto',
      deviceLabel: `Navegador interno (${appLabel})`,
      title: `Abrir no ${targetBrowser} para instalar`,
      description: `Estás a ver a loja dentro do navegador interno do ${appLabel}, que bloqueia a instalação direta de aplicações.`,
      steps: [
        `Toca no menu no canto superior (${env.isIOS ? 'três pontos ou ícone do Safari' : 'três pontos'}).`,
        `Seleciona «Abrir no ${targetBrowser}» ou «Abrir no navegador externo».`,
        env.isIOS
          ? 'No Safari, toca em «Partilhar» e depois em «Adicionar ao ecrã principal».'
          : 'No Chrome, toca novamente em «INSTALAR APP» no rodapé da loja.',
      ],
      contextNotice,
    };
  }

  if (env.isIOS) {
    return getIOSInstallGuide(cleanBrand, env);
  }

  if (env.isAndroid) {
    return getAndroidInstallGuide(cleanBrand, env);
  }

  if (env.os === 'macos' && env.browser === 'safari') {
    return {
      id: 'auto',
      deviceLabel: 'Mac · Safari',
      title: `Instalar ${cleanBrand} no Mac`,
      description: 'No Safari para macOS podes adicionar a loja diretamente à Dock:',
      steps: [
        'Na barra de menus superior do Mac, clica em «Ficheiro» (ou no botão Partilhar do Safari).',
        'Seleciona «Adicionar à Dock...».',
        'Confirma em «Adicionar» para abrir a loja como aplicação dedicada.',
      ],
      contextNotice,
    };
  }

  if (env.browser === 'firefox') {
    return {
      id: 'auto',
      deviceLabel: 'Computador · Firefox',
      title: `Como instalar a ${cleanBrand}`,
      description:
        'O Firefox para computador não suporta atualmente a instalação direta de lojas PWA como janela autónoma.',
      steps: [
        'No telemóvel Android (Chrome, Edge, Samsung Internet ou Firefox) ou no iPhone (Safari), abre o endereço da loja para instalares o ícone no ecrã principal.',
        'Em computador, podes utilizar o Google Chrome ou Microsoft Edge para instalar a aplicação no sistema.',
      ],
      contextNotice,
    };
  }

  return {
    id: 'auto',
    deviceLabel: 'Computador · Chrome / Edge',
    title: `Instalar ${cleanBrand} no computador ou telemóvel`,
    description:
      'O pedido automático do navegador não está ativo neste momento. Podes instalar manualmente:',
    steps: [
      'Em Chrome ou Edge no computador, clica no ícone de instalação no lado direito da barra de endereço (ou abre o menu de três pontos, «Guardar e partilhar / Aplicações» e «Instalar Bercali Store»).',
      'Se preferires instalar no telemóvel, abre o site no Chrome (Android) ou Safari (iPhone) e consulta abaixo os passos para cada sistema.',
    ],
    contextNotice,
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
