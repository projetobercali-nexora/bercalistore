import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseKeyValidationResult =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'forbidden_secret_key' | 'invalid_format' };

export function sanitizeEnvValue(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let cleaned = raw.trim();
  if (!cleaned) return undefined;

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned || undefined;
}

export function normalizeSupabaseUrl(rawUrl: string | undefined): string | undefined {
  const cleaned = sanitizeEnvValue(rawUrl);
  if (!cleaned) return undefined;
  return cleaned.replace(/\/+$/, '');
}

export function isValidSupabaseUrl(rawUrl: string | undefined): boolean {
  const normalized = normalizeSupabaseUrl(rawUrl);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && parsed.hostname === 'localhost')
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

/**
 * Garante que apenas chaves públicas (anon JWT ou sb_publishable_*) são aceites no frontend,
 * bloqueando explicitamente chaves secretas (service_role ou sb_secret_*).
 */
export function validatePublicSupabaseKey(rawKey: string | undefined): SupabaseKeyValidationResult {
  const key = sanitizeEnvValue(rawKey);
  if (!key) {
    return { valid: false, reason: 'missing' };
  }

  // Bloqueio explícito das novas chaves secretas do Supabase
  if (key.startsWith('sb_secret_')) {
    return { valid: false, reason: 'forbidden_secret_key' };
  }

  // Suporte às novas chaves públicas publishable do Supabase
  if (key.startsWith('sb_publishable_')) {
    return key.length > 20 ? { valid: true } : { valid: false, reason: 'invalid_format' };
  }

  // Validação de JWT clássico do Supabase (deve ter role !== 'service_role')
  const parts = key.split('.');
  if (parts.length === 3) {
    const payload = decodeBase64UrlJson(parts[1]);
    if (!payload) {
      return { valid: false, reason: 'invalid_format' };
    }
    if (payload.role === 'service_role') {
      return { valid: false, reason: 'forbidden_secret_key' };
    }
    return { valid: true };
  }

  return { valid: false, reason: 'invalid_format' };
}

export interface ResolvedSupabasePublicEnv {
  url: string | undefined;
  anonKey: string | undefined;
  urlSource: string | null;
  keySource: string | null;
  urlValid: boolean;
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
    const candidate = sanitizeEnvValue(envRecord[name]);
    if (candidate) {
      resolvedKey = candidate;
      keySource = name;
      break;
    }
  }

  const urlOk = isValidSupabaseUrl(resolvedUrl);
  const keyCheck = validatePublicSupabaseKey(resolvedKey);

  return {
    url: urlOk && resolvedUrl ? resolvedUrl : undefined,
    anonKey: keyCheck.valid && resolvedKey ? resolvedKey : undefined,
    urlSource,
    keySource,
    urlValid: urlOk,
    keyValidation: keyCheck,
    configured: Boolean(urlOk && keyCheck.valid && resolvedUrl && resolvedKey),
  };
}

const rawMetaEnv =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

// Referências estáticas explícitas garantem substituição direta pelo bundler Vite em produção (Vercel)
const buildTimeUrlFallback =
  typeof __BERCALI_SUPABASE_URL__ !== 'undefined' ? __BERCALI_SUPABASE_URL__ : undefined;
const buildTimeKeyFallback =
  typeof __BERCALI_SUPABASE_PUBLIC_KEY__ !== 'undefined'
    ? __BERCALI_SUPABASE_PUBLIC_KEY__
    : undefined;

const mergedClientEnv: Record<string, string | undefined> = {
  ...rawMetaEnv,
  VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL ?? rawMetaEnv.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY:
    import.meta.env?.VITE_SUPABASE_ANON_KEY ?? rawMetaEnv.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? rawMetaEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    rawMetaEnv.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_URL:
    import.meta.env?.NEXT_PUBLIC_SUPABASE_URL ?? rawMetaEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? rawMetaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    rawMetaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL: rawMetaEnv.SUPABASE_URL ?? buildTimeUrlFallback,
  SUPABASE_ANON_KEY: rawMetaEnv.SUPABASE_ANON_KEY ?? buildTimeKeyFallback,
};

const resolvedEnv = resolveSupabasePublicEnv(mergedClientEnv);

if (!resolvedEnv.configured && typeof console !== 'undefined') {
  const diagnostics: string[] = [];
  if (!resolvedEnv.urlValid) {
    diagnostics.push(
      resolvedEnv.urlSource
        ? `Variável ${resolvedEnv.urlSource} tem formato de URL inválido (esperado https://<projeto>.supabase.co).`
        : 'Variável VITE_SUPABASE_URL não encontrada no ambiente de compilação (ex.: Vercel -> Settings -> Environment Variables + Redeploy).'
    );
  }
  if (!resolvedEnv.keyValidation.valid) {
    if (resolvedEnv.keyValidation.reason === 'missing') {
      diagnostics.push(
        'Variável VITE_SUPABASE_ANON_KEY não encontrada no ambiente de compilação (ex.: Vercel -> Settings -> Environment Variables + Redeploy).'
      );
    } else if (resolvedEnv.keyValidation.reason === 'forbidden_secret_key') {
      diagnostics.push(
        `Chave em ${resolvedEnv.keySource ?? 'VITE_SUPABASE_ANON_KEY'} rejeitada por segurança: nunca uses service_role ou sb_secret_ no frontend.`
      );
    } else {
      diagnostics.push(
        `Variável ${resolvedEnv.keySource ?? 'VITE_SUPABASE_ANON_KEY'} tem formato inválido.`
      );
    }
  }
  console.error('[Bercali Store · Diagnóstico Privado]', diagnostics.join(' '));
}

export const SUPABASE_PUBLIC_URL: string | undefined = resolvedEnv.url;

export const SUPABASE_CONFIG_STATUS = {
  configured: resolvedEnv.configured,
  urlValid: resolvedEnv.urlValid,
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
