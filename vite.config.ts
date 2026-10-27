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
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.webmanifest',
        manifest: {
          id: '/',
          name: 'Bercali Store',
          short_name: 'Bercali',
          description: 'O futuro das compras começa aqui. Loja virtual da Bercali Store em Angola.',
          lang: 'pt',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0A0A0A',
          theme_color: '#0A0A0A',
          orientation: 'portrait-primary',
          categories: ['shopping', 'lifestyle'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          // Evita precache estático de index.html para impedir que um Service Worker antigo na Vercel
          // continue a servir um bundle anterior à configuração das variáveis de ambiente.
          globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/Manual_de_Marca_*', '**/Paste_*', 'demo-media/**'],
          navigateFallback: null,
          runtimeCaching: [
            {
              // Navegação HTML usa sempre NetworkFirst para carregar de imediato cada novo deploy na Vercel,
              // mantendo fallback offline para a PWA instalada quando não houver internet.
              urlPattern: ({request}) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'bercali-html-navigation',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Imagens públicas de produtos no Supabase Storage: prioriza sempre a rede para refletir
              // alterações imediatas do Painel Administrativo, com fallback em caso de falha momentânea.
              urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/storage\/v1\/object\/public\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'bercali-supabase-product-images',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
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
          enabled: true,
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
