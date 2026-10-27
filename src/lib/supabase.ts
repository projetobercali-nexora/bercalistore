import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseKeyValidationResult =
  | { valid: true }
  | { valid: false; reason: 'missing' | 'forbidden_secret_key' | 'invalid_format' };

export function isValidSupabaseUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
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
  if (!rawKey || !rawKey.trim()) {
    return { valid: false, reason: 'missing' };
  }

  const key = rawKey.trim();

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

const env =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

const urlOk = isValidSupabaseUrl(supabaseUrl);
const keyCheck = validatePublicSupabaseKey(supabaseAnonKey);

export const SUPABASE_PUBLIC_URL: string | undefined =
  urlOk && supabaseUrl ? supabaseUrl : undefined;

export const SUPABASE_CONFIG_STATUS = {
  configured: urlOk && keyCheck.valid,
  urlValid: urlOk,
  keyValidation: keyCheck,
} as const;

/**
 * Cliente público do Supabase partilhado com o projeto da base de dados do Painel Administrativo.
 * Mantém persistSession: false na loja pública para não criar sessões desnecessárias para visitantes.
 */
export const supabase: SupabaseClient | null =
  urlOk && keyCheck.valid && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
