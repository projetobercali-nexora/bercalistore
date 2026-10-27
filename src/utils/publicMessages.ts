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

export type CatalogDiagnosticCategory =
  | 'CONFIGURATION'
  | 'AUTH_INVALID_KEY'
  | 'RLS_PERMISSION'
  | 'SQL_QUERY_SCHEMA'
  | 'NETWORK_OR_CORS'
  | 'DATA_STRUCTURE';

export interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

export interface ClassifyCatalogErrorInput {
  configured: boolean;
  isOffline?: boolean;
  postgrestError?: PostgrestLikeError | null;
  thrownError?: unknown;
  dataStructureIssue?: string;
}

export interface CatalogTechnicalDiagnosticInput extends ClassifyCatalogErrorInput {
  table?: string;
  supabaseHost?: string | null;
  urlSource?: string | null;
  keySource?: string | null;
  keyKind?: string;
  keyLength?: number;
}

export interface CatalogTechnicalDiagnostic {
  category: CatalogDiagnosticCategory;
  table: string;
  supabaseHost: string | null;
  code: string | null;
  summary: string;
  rawErrorMessage: string | null;
  actionHint: string;
}

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
  'cors',
  'aborterror',
  'timed out',
  'timeout',
];

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

export function isMissingColumnOrSchemaCacheError(error?: PostgrestLikeError | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').trim().toUpperCase();
  if (code === '42703' || code === 'PGRST204') {
    return true;
  }
  const msg = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    (msg.includes('column') && msg.includes('does not exist')) ||
    (msg.includes('could not find the') && msg.includes('column'))
  );
}

/**
 * Classifica tecnicamente qualquer falha do Supabase para o console do programador
 * sem nunca incluir valores de chaves ou credenciais.
 */
export function buildCatalogTechnicalDiagnostic(
  input: CatalogTechnicalDiagnosticInput
): CatalogTechnicalDiagnostic {
  const table = input.table ?? 'public.products';
  const host = input.supabaseHost ?? null;

  if (!input.configured) {
    return {
      category: 'CONFIGURATION',
      table,
      supabaseHost: host,
      code: input.keyKind === 'forbidden_secret_key' ? 'FORBIDDEN_SECRET_KEY' : 'ENV_NOT_CONFIGURED',
      summary:
        input.keyKind === 'forbidden_secret_key'
          ? `Chave secreta bloqueada em ${input.keySource ?? 'VITE_SUPABASE_ANON_KEY'} (nunca uses service_role ou sb_secret_ no frontend).`
          : `Variáveis públicas do Supabase ausentes ou inválidas no build atual (urlSource=${input.urlSource ?? 'ausente'}, keySource=${input.keySource ?? 'ausente'}, keyKind=${input.keyKind ?? 'missing'}, keyLength=${input.keyLength ?? 0}).`,
      rawErrorMessage: null,
      actionHint:
        'Confirma VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em Vercel -> Settings -> Environment Variables (ambientes Production e Preview marcados) e executa Redeploy sem "Use existing Build Cache".',
    };
  }

  if (input.dataStructureIssue) {
    return {
      category: 'DATA_STRUCTURE',
      table,
      supabaseHost: host,
      code: 'INVALID_DATA_SHAPE',
      summary: `Estrutura de dados inesperada ao processar ${table}: ${input.dataStructureIssue}`,
      rawErrorMessage: input.dataStructureIssue,
      actionHint:
        'Verifica os tipos de dados devolvidos pela tabela (ex.: id, name, price, status) no Table Editor do Supabase.',
    };
  }

  const pgErr = input.postgrestError;
  const code = pgErr?.code ? String(pgErr.code).trim() : null;
  const status = typeof pgErr?.status === 'number' ? pgErr.status : null;
  const rawErrorMessage =
    [
      pgErr?.message ?? '',
      pgErr?.details ?? '',
      pgErr?.hint ?? '',
      input.thrownError instanceof Error
        ? input.thrownError.message
        : typeof input.thrownError === 'string'
        ? input.thrownError
        : '',
    ]
      .filter(Boolean)
      .join(' | ') || null;

  const lowerMsg = (rawErrorMessage ?? '').toLowerCase();
  const upperCode = (code ?? '').toUpperCase();

  if (input.isOffline || (input.thrownError && !pgErr) || isLikelyNetworkFailure(lowerMsg)) {
    return {
      category: 'NETWORK_OR_CORS',
      table,
      supabaseHost: host,
      code: code ?? 'NETWORK_FETCH_FAILED',
      summary: `Falha de rede ou bloqueio CORS ao contactar ${host ?? 'o servidor Supabase'} para consultar ${table}.`,
      rawErrorMessage,
      actionHint:
        'Verifica a ligação à internet, confirma que o URL em VITE_SUPABASE_URL corresponde a um projeto Supabase ativo (não pausado) e sem bloqueio de rede/extensões.',
    };
  }

  if (
    status === 401 ||
    upperCode === 'PGRST301' ||
    upperCode === 'PGRST302' ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('jwt expired') ||
    lowerMsg.includes('invalid jwt') ||
    lowerMsg.includes('no api key found') ||
    lowerMsg.includes('apikey')
  ) {
    return {
      category: 'AUTH_INVALID_KEY',
      table,
      supabaseHost: host,
      code: code ?? 'HTTP_401',
      summary: `Autenticação recusada pelo Supabase (${host ?? 'host desconhecido'}): a chave pública VITE_SUPABASE_ANON_KEY é inválida, expirou ou pertence a outro projeto.`,
      rawErrorMessage,
      actionHint:
        'Copia novamente a chave pública "anon public" (ou Publishable key) em Supabase -> Project Settings -> API do mesmo projeto de VITE_SUPABASE_URL, atualiza na Vercel e faz Redeploy.',
    };
  }

  if (
    status === 403 ||
    upperCode === '42501' ||
    lowerMsg.includes('permission denied') ||
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('violates row-level security')
  ) {
    return {
      category: 'RLS_PERMISSION',
      table,
      supabaseHost: host,
      code: code ?? '42501',
      summary: `Permissão recusada por RLS ou privilégios PostgreSQL ao ler ${table} com o papel público anon.`,
      rawErrorMessage,
      actionHint: `No Supabase -> Authentication -> Policies, confirma que ${table} tem política SELECT para o papel anon (ex.: status = 'active') e GRANT SELECT ON ${table} TO anon.`,
    };
  }

  if (
    upperCode === '42P01' ||
    upperCode === '42703' ||
    upperCode === 'PGRST200' ||
    upperCode === 'PGRST204' ||
    upperCode === 'PGRST205' ||
    lowerMsg.includes('does not exist') ||
    lowerMsg.includes('schema cache') ||
    lowerMsg.includes('relationship')
  ) {
    return {
      category: 'SQL_QUERY_SCHEMA',
      table,
      supabaseHost: host,
      code: code ?? 'SCHEMA_MISMATCH',
      summary: `Incompatibilidade de tabela ou coluna na consulta a ${table} no projeto ${host ?? 'atual'}.`,
      rawErrorMessage,
      actionHint:
        'Confirma que VITE_SUPABASE_URL aponta exatamente para o mesmo projeto Supabase do Painel Administrativo e que a tabela/colunas existem no esquema public.',
    };
  }

  if (upperCode === '22P02' || lowerMsg.includes('invalid input syntax') || lowerMsg.includes('json')) {
    return {
      category: 'DATA_STRUCTURE',
      table,
      supabaseHost: host,
      code: code ?? 'DATA_PARSE_ERROR',
      summary: `Erro de formato ou conversão de dados ao consultar ${table}.`,
      rawErrorMessage,
      actionHint:
        'Verifica se os campos numéricos, booleanos ou JSON da tabela têm valores válidos no Supabase.',
    };
  }

  return {
    category: 'SQL_QUERY_SCHEMA',
    table,
    supabaseHost: host,
    code,
    summary: `Erro devolvido pelo Supabase ao consultar ${table} em ${host ?? 'host desconhecido'}.`,
    rawErrorMessage,
    actionHint:
      'Consulta code e rawErrorMessage acima para confirmar variáveis na Vercel, estado do projeto Supabase e políticas RLS.',
  };
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
