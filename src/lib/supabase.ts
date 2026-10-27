import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabasePublicKeyKind =
  | 'jwt_anon'
  | 'jwt_public'
  | 'sb_publishable'
  | 'missing'
  | 'forbidden_secret_key'
  | 'invalid';

export type SupabaseKeyValidationResult =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'forbidden_secret_key' | 'invalid_format' };

function stripWrappingQuotes(value: string): string {
  let current = value.trim();
  while (
    current.length >= 2 &&
    ((current.startsWith('"') && current.endsWith('"')) ||
      (current.startsWith("'") && current.endsWith("'")) ||
      (current.startsWith('`') && current.endsWith('`')))
  ) {
    current = current.slice(1, -1).trim();
  }
  return current;
}

export function sanitizeEnvValue(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const withoutZeroWidth = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const cleaned = stripWrappingQuotes(withoutZeroWidth);
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;
  return cleaned;
}

export function normalizeSupabaseUrl(rawUrl: string | undefined): string | undefined {
  const initial = sanitizeEnvValue(rawUrl);
  if (!initial) return undefined;

  // Remove prefixo acidental KEY=VALUE caso tenha sido colado no campo Value da Vercel
  let cleaned = stripWrappingQuotes(
    initial.replace(/^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)?SUPABASE_URL\s*=\s*/i, '')
  ).replace(/\s+/g, '');

  if (!cleaned) return undefined;

  // Suporta ID de projeto isolado (ex.: "dyhwbzyiuzrdmiogzwdg") ou domínio sem protocolo
  if (/^[a-z0-9]{20}$/.test(cleaned)) {
    cleaned = `https://${cleaned}.supabase.co`;
  } else if (!/^https?:\/\//i.test(cleaned) && /^[a-z0-9-]+\.supabase\.(co|in)(\/.*)?$/i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  cleaned = cleaned
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage)\/v1$/i, '')
    .replace(/\/+$/, '');

  return cleaned || undefined;
}

export function sanitizeSupabaseKey(rawKey: string | undefined): string | undefined {
  const initial = sanitizeEnvValue(rawKey);
  if (!initial) return undefined;

  // Remove prefixos acidentais KEY=VALUE, aspas internas, "Bearer " e quebras de linha ao colar JWT longo na Vercel
  const afterKeyEq = stripWrappingQuotes(
    initial.replace(
      /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)?SUPABASE_(?:ANON|PUBLISHABLE(?:_DEFAULT)?|PUBLIC)?_?KEY\s*=\s*/i,
      ''
    )
  );
  const withoutBearer = stripWrappingQuotes(afterKeyEq.replace(/^Bearer\s+/i, ''));

  const compact = withoutBearer.replace(/\s+/g, '');
  if (!compact) return undefined;
  const lower = compact.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;
  return compact;
}

export function extractSupabaseHost(rawUrl: string | undefined): string | null {
  const normalized = normalizeSupabaseUrl(rawUrl);
  if (!normalized) return null;
  try {
    return new URL(normalized).host || null;
  } catch {
    return null;
  }
}

export function isValidSupabaseUrl(rawUrl: string | undefined): boolean {
  const normalized = normalizeSupabaseUrl(rawUrl);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return (
      Boolean(parsed.hostname) &&
      (parsed.protocol === 'https:' ||
        (parsed.protocol === 'http:' && parsed.hostname === 'localhost'))
    );
  } catch {
    return false;
  }
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonStr =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(jsonStr);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function classifyPublicSupabaseKeyKind(
  rawKey: string | undefined
): SupabasePublicKeyKind {
  const key = sanitizeSupabaseKey(rawKey);
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'forbidden_secret_key';
  if (key.startsWith('sb_publishable_')) {
    return key.length > 20 ? 'sb_publishable' : 'invalid';
  }
  const parts = key.split('.');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const payload = decodeBase64UrlJson(parts[1]);
    if (!payload) return 'invalid';
    if (payload.role === 'service_role' || payload.role === 'supabase_admin') {
      return 'forbidden_secret_key';
    }
    return payload.role === 'anon' ? 'jwt_anon' : 'jwt_public';
  }
  return 'invalid';
}

/**
 * Garante que apenas chaves públicas (anon JWT ou sb_publishable_*) são aceites no frontend,
 * bloqueando explicitamente chaves secretas (service_role ou sb_secret_*).
 */
export function validatePublicSupabaseKey(rawKey: string | undefined): SupabaseKeyValidationResult {
  const kind = classifyPublicSupabaseKeyKind(rawKey);
  if (kind === 'missing') {
    return { valid: false, reason: 'missing' };
  }
  if (kind === 'forbidden_secret_key') {
    return { valid: false, reason: 'forbidden_secret_key' };
  }
  if (kind === 'invalid') {
    return { valid: false, reason: 'invalid_format' };
  }
  return { valid: true };
}

export interface ResolvedSupabasePublicEnv {
  url: string | undefined;
  anonKey: string | undefined;
  urlHost: string | null;
  urlSource: string | null;
  keySource: string | null;
  urlValid: boolean;
  keyKind: SupabasePublicKeyKind;
  keyLength: number;
  keyValidation: SupabaseKeyValidationResult;
  configured: boolean;
}

declare const __BERCALI_SUPABASE_URL__: string | undefined;
declare const __BERCALI_SUPABASE_PUBLIC_KEY__: string | undefined;

const URL_ENV_CANDIDATES = [
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_URL',
  'REACT_APP_SUPABASE_URL',
  'SUPABASE_URL',
] as const;

const KEY_ENV_CANDIDATES = [
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'VITE_SUPABASE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'PUBLIC_SUPABASE_ANON_KEY',
  'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'REACT_APP_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
] as const;

export function resolveSupabasePublicEnv(
  envRecord: Record<string, string | undefined>
): ResolvedSupabasePublicEnv {
  let resolvedUrl: string | undefined;
  let urlSource: string | null = null;

  for (const name of URL_ENV_CANDIDATES) {
    const candidate = normalizeSupabaseUrl(envRecord[name]);
    if (candidate) {
      resolvedUrl = candidate;
      urlSource = name;
      break;
    }
  }

  let resolvedKey: string | undefined;
  let keySource: string | null = null;

  for (const name of KEY_ENV_CANDIDATES) {
    const candidate = sanitizeSupabaseKey(envRecord[name]);
    if (candidate) {
      resolvedKey = candidate;
      keySource = name;
      break;
    }
  }

  const urlOk = isValidSupabaseUrl(resolvedUrl);
  const keyCheck = validatePublicSupabaseKey(resolvedKey);
  const keyKind = classifyPublicSupabaseKeyKind(resolvedKey);

  return {
    url: urlOk && resolvedUrl ? resolvedUrl : undefined,
    anonKey: keyCheck.valid && resolvedKey ? resolvedKey : undefined,
    urlHost: urlOk ? extractSupabaseHost(resolvedUrl) : null,
    urlSource,
    keySource,
    urlValid: urlOk,
    keyKind,
    keyLength: resolvedKey ? resolvedKey.length : 0,
    keyValidation: keyCheck,
    configured: Boolean(urlOk && keyCheck.valid && resolvedUrl && resolvedKey),
  };
}

const rawMetaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

// Referências estáticas diretas (sem optional chaining em import.meta.env) garantem substituição literal pelo Vite/Rollup no build da Vercel
const directViteSupabaseUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL
    : undefined;
const directViteSupabaseAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : undefined;
const directVitePublishableKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    : undefined;
const directVitePublishableDefaultKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    : undefined;
const directNextPublicUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
    : undefined;
const directNextPublicAnonKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : undefined;
const directNextPublicPublishableKey =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    : undefined;

const buildTimeUrlFallback =
  typeof __BERCALI_SUPABASE_URL__ !== 'undefined' ? __BERCALI_SUPABASE_URL__ : undefined;
const buildTimeKeyFallback =
  typeof __BERCALI_SUPABASE_PUBLIC_KEY__ !== 'undefined'
    ? __BERCALI_SUPABASE_PUBLIC_KEY__
    : undefined;

const mergedClientEnv: Record<string, string | undefined> = {
  ...rawMetaEnv,
  VITE_SUPABASE_URL: directViteSupabaseUrl ?? rawMetaEnv.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: directViteSupabaseAnonKey ?? rawMetaEnv.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    directVitePublishableKey ?? rawMetaEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
    directVitePublishableDefaultKey ?? rawMetaEnv.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_URL: directNextPublicUrl ?? rawMetaEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    directNextPublicAnonKey ?? rawMetaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    directNextPublicPublishableKey ?? rawMetaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL: rawMetaEnv.SUPABASE_URL ?? buildTimeUrlFallback,
  SUPABASE_ANON_KEY: rawMetaEnv.SUPABASE_ANON_KEY ?? buildTimeKeyFallback,
};

const resolvedEnv = resolveSupabasePublicEnv(mergedClientEnv);
const runtimeMode =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE
    ? import.meta.env.MODE
    : 'production';

if (!resolvedEnv.configured && typeof console !== 'undefined') {
  const issues: string[] = [];
  if (!resolvedEnv.urlValid) {
    issues.push(
      resolvedEnv.urlSource
        ? `Variável ${resolvedEnv.urlSource} tem formato de URL inválido (esperado https://<projeto>.supabase.co).`
        : 'Variável VITE_SUPABASE_URL ausente no build atual.'
    );
  }
  if (!resolvedEnv.keyValidation.valid) {
    if (resolvedEnv.keyValidation.reason === 'missing') {
      issues.push('Variável VITE_SUPABASE_ANON_KEY ausente no build atual.');
    } else if (resolvedEnv.keyValidation.reason === 'forbidden_secret_key') {
      issues.push(
        `Chave em ${resolvedEnv.keySource ?? 'VITE_SUPABASE_ANON_KEY'} bloqueada por segurança: nunca uses service_role ou sb_secret_ no frontend.`
      );
    } else {
      issues.push(
        `Variável ${resolvedEnv.keySource ?? 'VITE_SUPABASE_ANON_KEY'} tem formato inválido (comprimento lido: ${resolvedEnv.keyLength}).`
      );
    }
  }
  console.error('[Bercali Store · Diagnóstico Supabase]', {
    category: 'CONFIGURATION',
    mode: runtimeMode,
    configured: false,
    urlSource: resolvedEnv.urlSource,
    urlValid: resolvedEnv.urlValid,
    keySource: resolvedEnv.keySource,
    keyKind: resolvedEnv.keyKind,
    keyLength: resolvedEnv.keyLength,
    summary: issues.join(' '),
    action:
      'Na Vercel -> Settings -> Environment Variables, confirma VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY marcados para Production e Preview, e faz Redeploy desmarcando "Use existing Build Cache".',
  });
}

export const SUPABASE_PUBLIC_URL: string | undefined = resolvedEnv.url;

export const SUPABASE_CONFIG_STATUS = {
  configured: resolvedEnv.configured,
  mode: runtimeMode,
  urlHost: resolvedEnv.urlHost,
  urlValid: resolvedEnv.urlValid,
  keyKind: resolvedEnv.keyKind,
  keyLength: resolvedEnv.keyLength,
  keyValidation: resolvedEnv.keyValidation,
  urlSource: resolvedEnv.urlSource,
  keySource: resolvedEnv.keySource,
} as const;

/**
 * Cliente público do Supabase partilhado com o projeto da base de dados do Painel Administrativo.
 * Mantém persistSession: false na loja pública para não criar sessões desnecessárias para visitantes.
 */
export const supabase: SupabaseClient | null =
  resolvedEnv.configured && resolvedEnv.url && resolvedEnv.anonKey
    ? createClient(resolvedEnv.url, resolvedEnv.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
