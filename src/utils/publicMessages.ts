export type CatalogErrorKind = 'none' | 'network' | 'unavailable' | 'unconfigured';

export type CatalogLoadStatus =
  | 'loading'
  | 'loaded_with_products'
  | 'loaded_empty'
  | 'error_connection_or_permission'
  | 'error_unconfigured';

export function resolveCatalogLoadStatus(params: {
  loading: boolean;
  errorKind: CatalogErrorKind;
  productCount: number;
}): CatalogLoadStatus {
  if (params.loading) {
    return 'loading';
  }
  if (params.errorKind === 'unconfigured') {
    return 'error_unconfigured';
  }
  if (params.errorKind !== 'none') {
    return 'error_connection_or_permission';
  }
  return params.productCount > 0 ? 'loaded_with_products' : 'loaded_empty';
}

/**
 * Mensagens públicas da loja em português de Angola, claras e profissionais,
 * sem expor detalhes técnicos, nomes de variáveis, políticas RLS ou estrutura interna.
 */
export const PUBLIC_MESSAGES = {
  catalogTemporaryError:
    'Estamos com uma dificuldade temporária ao carregar os produtos. Por favor, tenta novamente dentro de alguns instantes.',
  catalogNetworkError:
    'Não foi possível carregar os produtos neste momento. Verifica a tua ligação à internet e tenta novamente.',
  emptyCategory:
    'De momento, não existem produtos disponíveis nesta categoria. Explora outras categorias ou volta mais tarde.',
  emptyCatalog:
    'De momento, não existem produtos disponíveis no catálogo. Volta mais tarde ou fala connosco pelo WhatsApp.',
  emptySearch:
    'Não encontrámos produtos para esta pesquisa. Tenta usar outras palavras ou limpa os filtros.',
  emptyPromotions:
    'De momento, não existem produtos em promoção. Explora o catálogo completo ou volta mais tarde.',
  emptyCategoriesList:
    'De momento, não existem categorias disponíveis para consulta. Volta mais tarde.',
  productNotFound:
    'O artigo que procuras não se encontra disponível de momento ou o endereço não está correto.',
  orderRegistrationTemporaryError:
    'Estamos com uma dificuldade temporária ao registar automaticamente o pedido. Podes concluir a tua encomenda diretamente pelo WhatsApp.',
  orderRegistrationNetworkError:
    'Não foi possível registar automaticamente a encomenda neste momento. Verifica a tua ligação à internet ou conclui o envio pelo WhatsApp.',
  whatsappUnavailableNotice:
    'O atendimento direto pelo WhatsApp está temporariamente indisponível neste momento. Podes copiar a mensagem do teu pedido abaixo ou tentar novamente mais tarde.',
} as const;

const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network request failed',
  'load failed',
  'net::err_',
  'err_internet_disconnected',
  'err_name_not_resolved',
  'err_connection',
  'aborterror',
  'timed out',
  'timeout',
];

export interface ClassifyCatalogErrorInput {
  configured: boolean;
  isOffline?: boolean;
  postgrestError?: { code?: string; message?: string; details?: string } | null;
  thrownError?: unknown;
}

export function isLikelyNetworkFailure(rawMessage: string, isOffline = false): boolean {
  if (isOffline) {
    return true;
  }
  const normalized = rawMessage.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return NETWORK_ERROR_PATTERNS.some((fragment) => normalized.includes(fragment));
}

export function classifyCatalogError(input: ClassifyCatalogErrorInput): {
  kind: Exclude<CatalogErrorKind, 'none'>;
  userMessage: string;
} {
  if (input.isOffline) {
    return {
      kind: 'network',
      userMessage: PUBLIC_MESSAGES.catalogNetworkError,
    };
  }

  if (!input.configured) {
    return {
      kind: 'unconfigured',
      userMessage: PUBLIC_MESSAGES.catalogTemporaryError,
    };
  }

  const combinedMessage = [
    input.postgrestError?.message ?? '',
    input.postgrestError?.details ?? '',
    input.thrownError instanceof Error
      ? input.thrownError.message
      : typeof input.thrownError === 'string'
      ? input.thrownError
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (input.thrownError && !input.postgrestError) {
    return {
      kind: 'network',
      userMessage: PUBLIC_MESSAGES.catalogNetworkError,
    };
  }

  if (isLikelyNetworkFailure(combinedMessage)) {
    return {
      kind: 'network',
      userMessage: PUBLIC_MESSAGES.catalogNetworkError,
    };
  }

  return {
    kind: 'unavailable',
    userMessage: PUBLIC_MESSAGES.catalogTemporaryError,
  };
}

const TECHNICAL_JARGON_PATTERNS: readonly RegExp[] = [
  /\bsupabase\b/i,
  /\bvite_[a-z0-9_]+/i,
  /\bnext_public_[a-z0-9_]+/i,
  /\bservice_role\b/i,
  /\bsb_secret_/i,
  /\bsb_publishable_/i,
  /\brls\b/i,
  /\bsql\b/i,
  /\bpostgrest\b/i,
  /\bpgrst\d*/i,
  /\bpapel\s+anon\b/i,
  /\bbase\s+de\s+dados\b/i,
  /\bpainel\s+administrativo\b/i,
  /\bfunç[aã]o\s+rpc\b/i,
  /\bcreate_storefront_order\b/i,
  /\bconfiguraç[aã]o\s+de\s+acesso\b/i,
  /\baviso\s+de\s+ligaç[aã]o\b/i,
];

export function containsTechnicalJargon(message: string): boolean {
  return TECHNICAL_JARGON_PATTERNS.some((regex) => regex.test(message));
}
