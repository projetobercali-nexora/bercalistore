import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_MESSAGES,
  classifyCatalogError,
  containsTechnicalJargon,
  isLikelyNetworkFailure,
  resolveCatalogLoadStatus,
} from './publicMessages';
import {
  normalizeSupabaseUrl,
  resolveSupabasePublicEnv,
  sanitizeEnvValue,
} from '../lib/supabase';

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature_placeholder`;
}

test('all PUBLIC_MESSAGES are clean Angolan Portuguese without any technical jargon', () => {
  for (const [key, message] of Object.entries(PUBLIC_MESSAGES)) {
    assert.ok(message.length > 15, `Message ${key} should not be empty`);
    assert.equal(
      containsTechnicalJargon(message),
      false,
      `Message "${key}" leaked technical jargon: ${message}`
    );
  }
});

test('containsTechnicalJargon detects forbidden internal terms', () => {
  assert.equal(
    containsTechnicalJargon('A configuração de acesso público à base de dados da loja está incompleta.'),
    true
  );
  assert.equal(containsTechnicalJargon('Aviso de ligação: erro no Supabase'), true);
  assert.equal(containsTechnicalJargon('Política RLS bloqueou papel anon no SQL Editor'), true);
  assert.equal(containsTechnicalJargon('Configura VITE_SUPABASE_ANON_KEY'), true);
  assert.equal(containsTechnicalJargon('Verifica no Painel Administrativo'), true);
  assert.equal(
    containsTechnicalJargon(PUBLIC_MESSAGES.catalogNetworkError),
    false
  );
  assert.equal(
    containsTechnicalJargon(PUBLIC_MESSAGES.catalogTemporaryError),
    false
  );
});

test('classifyCatalogError and resolveCatalogLoadStatus clearly separate all 4 Passo 4 states without leaking details', () => {
  const unconfigured = classifyCatalogError({
    configured: false,
  });
  assert.equal(unconfigured.kind, 'unconfigured');
  assert.equal(unconfigured.userMessage, PUBLIC_MESSAGES.catalogTemporaryError);
  assert.equal(containsTechnicalJargon(unconfigured.userMessage), false);

  const rlsError = classifyCatalogError({
    configured: true,
    postgrestError: {
      code: '42501',
      message: 'permission denied for table products',
      details: 'RLS policy violation on public.products for role anon',
    },
  });
  assert.equal(rlsError.kind, 'unavailable');
  assert.equal(rlsError.userMessage, PUBLIC_MESSAGES.catalogTemporaryError);
  assert.equal(containsTechnicalJargon(rlsError.userMessage), false);

  const networkFetchError = classifyCatalogError({
    configured: true,
    thrownError: new TypeError('Failed to fetch'),
  });
  assert.equal(networkFetchError.kind, 'network');
  assert.equal(networkFetchError.userMessage, PUBLIC_MESSAGES.catalogNetworkError);

  const offlineError = classifyCatalogError({
    configured: true,
    isOffline: true,
  });
  assert.equal(offlineError.kind, 'network');
  assert.equal(offlineError.userMessage, PUBLIC_MESSAGES.catalogNetworkError);

  assert.equal(isLikelyNetworkFailure('TypeError: NetworkError when attempting to fetch resource.'), true);
  assert.equal(isLikelyNetworkFailure('permission denied for schema public'), false);

  // Passo 4: Distingue claramente consulta com produtos, consulta vazia, erro de ligação/permissões e falta de configuração
  assert.equal(
    resolveCatalogLoadStatus({ loading: true, errorKind: 'none', productCount: 0 }),
    'loading'
  );
  assert.equal(
    resolveCatalogLoadStatus({ loading: false, errorKind: 'none', productCount: 2 }),
    'loaded_with_products'
  );
  assert.equal(
    resolveCatalogLoadStatus({ loading: false, errorKind: 'none', productCount: 0 }),
    'loaded_empty'
  );
  assert.equal(
    resolveCatalogLoadStatus({ loading: false, errorKind: 'network', productCount: 0 }),
    'error_connection_or_permission'
  );
  assert.equal(
    resolveCatalogLoadStatus({ loading: false, errorKind: 'unavailable', productCount: 0 }),
    'error_connection_or_permission'
  );
  assert.equal(
    resolveCatalogLoadStatus({ loading: false, errorKind: 'unconfigured', productCount: 0 }),
    'error_unconfigured'
  );
});

test('sanitizeEnvValue and normalizeSupabaseUrl handle Vercel copy-paste quotes and trailing slashes', () => {
  assert.equal(
    sanitizeEnvValue('  "https://dyhwbzyiuzrdmiogzwdg.supabase.co"  '),
    'https://dyhwbzyiuzrdmiogzwdg.supabase.co'
  );
  assert.equal(
    sanitizeEnvValue(" 'sb_publishable_abcdefghijklmnopqrstuvwxyz' "),
    'sb_publishable_abcdefghijklmnopqrstuvwxyz'
  );
  assert.equal(sanitizeEnvValue('   '), undefined);
  assert.equal(
    normalizeSupabaseUrl('"https://dyhwbzyiuzrdmiogzwdg.supabase.co///"'),
    'https://dyhwbzyiuzrdmiogzwdg.supabase.co'
  );
});

test('resolveSupabasePublicEnv supports VITE_ primary vars, Vercel NEXT_PUBLIC_ fallbacks, and blocks secret keys', () => {
  const anonJwt = createFakeJwt({ role: 'anon', iss: 'supabase' });
  const serviceRoleJwt = createFakeJwt({ role: 'service_role', iss: 'supabase' });

  const standardVite = resolveSupabasePublicEnv({
    VITE_SUPABASE_URL: '"https://dyhwbzyiuzrdmiogzwdg.supabase.co/"',
    VITE_SUPABASE_ANON_KEY: `"${anonJwt}"`,
  });
  assert.equal(standardVite.configured, true);
  assert.equal(standardVite.url, 'https://dyhwbzyiuzrdmiogzwdg.supabase.co');
  assert.equal(standardVite.urlSource, 'VITE_SUPABASE_URL');
  assert.equal(standardVite.keySource, 'VITE_SUPABASE_ANON_KEY');

  const vercelIntegrationFallback = resolveSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://dyhwbzyiuzrdmiogzwdg.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1234567890abcdefghijklmnop',
  });
  assert.equal(vercelIntegrationFallback.configured, true);
  assert.equal(vercelIntegrationFallback.urlSource, 'NEXT_PUBLIC_SUPABASE_URL');
  assert.equal(vercelIntegrationFallback.keySource, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

  const unprefixedVercelFallback = resolveSupabasePublicEnv({
    SUPABASE_URL: 'https://dyhwbzyiuzrdmiogzwdg.supabase.co',
    SUPABASE_ANON_KEY: anonJwt,
  });
  assert.equal(unprefixedVercelFallback.configured, true);
  assert.equal(unprefixedVercelFallback.urlSource, 'SUPABASE_URL');
  assert.equal(unprefixedVercelFallback.keySource, 'SUPABASE_ANON_KEY');

  const forbiddenServiceRole = resolveSupabasePublicEnv({
    VITE_SUPABASE_URL: 'https://dyhwbzyiuzrdmiogzwdg.supabase.co',
    VITE_SUPABASE_ANON_KEY: serviceRoleJwt,
  });
  assert.equal(forbiddenServiceRole.configured, false);
  assert.equal(forbiddenServiceRole.anonKey, undefined);
  assert.deepEqual(forbiddenServiceRole.keyValidation, {
    valid: false,
    reason: 'forbidden_secret_key',
  });

  const forbiddenSecretKey = resolveSupabasePublicEnv({
    VITE_SUPABASE_URL: 'https://dyhwbzyiuzrdmiogzwdg.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'sb_secret_1234567890abcdefghijklmnop',
  });
  assert.equal(forbiddenSecretKey.configured, false);
  assert.equal(forbiddenSecretKey.anonKey, undefined);
});

test('public pages and components contain no exposed database configuration warnings', () => {
  const dirsToCheck = ['src/pages', 'src/components'];
  const forbiddenUiPhrases = [
    'A configuração de acesso público à base de dados',
    'Aviso de ligação:',
    'SQL Editor',
    'papel anon',
    'create_storefront_order',
    'VITE_SUPABASE_',
    'service_role',
  ];

  for (const relDir of dirsToCheck) {
    const absDir = path.resolve(process.cwd(), relDir);
    for (const entry of fs.readdirSync(absDir)) {
      if (!entry.endsWith('.tsx') && !entry.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.join(absDir, entry), 'utf-8');
      for (const phrase of forbiddenUiPhrases) {
        assert.equal(
          content.includes(phrase),
          false,
          `File ${relDir}/${entry} still contains forbidden technical UI phrase: "${phrase}"`
        );
      }
    }
  }
});
