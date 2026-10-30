import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function stripQuotes(value: string): string {
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

function cleanEnvValue(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = stripQuotes(raw.replace(/[\u200B-\u200D\uFEFF]/g, ''));
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;
  return cleaned;
}

function normalizeBuildSupabaseUrl(rawUrl: string | undefined): string | undefined {
  const initial = cleanEnvValue(rawUrl);
  if (!initial) return undefined;

  let cleaned = stripQuotes(
    initial.replace(/^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)?SUPABASE_URL\s*=\s*/i, '')
  ).replace(/\s+/g, '');

  if (!cleaned) return undefined;

  if (/^[a-z0-9]{20}$/.test(cleaned)) {
    cleaned = `https://${cleaned}.supabase.co`;
  } else if (
    !/^https?:\/\//i.test(cleaned) &&
    /^[a-z0-9-]+\.supabase\.(co|in)(\/.*)?$/i.test(cleaned)
  ) {
    cleaned = `https://${cleaned}`;
  }

  cleaned = cleaned
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage)\/v1$/i, '')
    .replace(/\/+$/, '');

  return cleaned || undefined;
}

function cleanBuildSupabaseKey(rawKey: string | undefined): string | undefined {
  const initial = cleanEnvValue(rawKey);
  if (!initial) return undefined;

  const afterKeyEq = stripQuotes(
    initial.replace(
      /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)?SUPABASE_(?:ANON|PUBLISHABLE(?:_DEFAULT)?|PUBLIC)?_?KEY\s*=\s*/i,
      ''
    )
  );
  const withoutPrefix = stripQuotes(afterKeyEq.replace(/^Bearer\s+/i, '')).replace(/\s+/g, '');

  if (!withoutPrefix) return undefined;
  const lower = withoutPrefix.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;
  return withoutPrefix;
}

function isSafePublicSupabaseKey(rawKey: string | undefined): boolean {
  const key = cleanBuildSupabaseKey(rawKey);
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return key.length > 20;

  const parts = key.split('.');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return payload.role !== 'service_role' && payload.role !== 'supabase_admin';
    } catch {
      return false;
    }
  }
  return false;
}

function resolveBuildTimePublicSupabaseEnv(allEnv: Record<string, string | undefined>) {
  const urlCandidates = [
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_URL',
    'REACT_APP_SUPABASE_URL',
    'SUPABASE_URL',
  ];
  const keyCandidates = [
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
  ];

  let url = '';
  for (const name of urlCandidates) {
    const val = normalizeBuildSupabaseUrl(allEnv[name]);
    if (val && /^https:\/\/|^http:\/\/localhost\b/i.test(val)) {
      url = val;
      break;
    }
  }

  let publicKey = '';
  for (const name of keyCandidates) {
    const val = cleanBuildSupabaseKey(allEnv[name]);
    if (val && isSafePublicSupabaseKey(val)) {
      publicKey = val;
      break;
    }
  }

  return {url, publicKey};
}

export default defineConfig(({mode}) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const mergedEnv: Record<string, string | undefined> = {...fileEnv, ...process.env};
  const resolvedSupabase = resolveBuildTimePublicSupabaseEnv(mergedEnv);

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'PUBLIC_'],
    define: {
      __BERCALI_SUPABASE_URL__: JSON.stringify(resolvedSupabase.url),
      __BERCALI_SUPABASE_PUBLIC_KEY__: JSON.stringify(resolvedSupabase.publicKey),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifest: false,
        workbox: {
          cleanupOutdatedCaches: true,
          importScripts: ['/sw-custom.js'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          // Faz precache apenas à estrutura estática da app (JS, CSS, ícones, fontes e offline.html).
          // Nunca faz cache a pedidos Supabase para garantir produtos, preços, stock e definições em tempo real.
          globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}', 'offline.html'],
          globIgnores: [
            '**/Manual_de_Marca_*',
            '**/Paste_*',
            'demo-media/**',
            'sw-custom.js',
            'manifest.webmanifest',
          ],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'bercali-google-fonts-stylesheets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bercali-google-fonts-webfonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
