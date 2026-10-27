import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function cleanEnvValue(raw: string | undefined): string | undefined {
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

function isSafePublicSupabaseKey(rawKey: string | undefined): boolean {
  const key = cleanEnvValue(rawKey);
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return key.length > 20;

  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadJson) as Record<string, unknown>;
      return payload.role !== 'service_role';
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
    const val = cleanEnvValue(allEnv[name])?.replace(/\/+$/, '');
    if (val && /^https:\/\/|^http:\/\/localhost\b/i.test(val)) {
      url = val;
      break;
    }
  }

  let publicKey = '';
  for (const name of keyCandidates) {
    const val = cleanEnvValue(allEnv[name]);
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/Manual_de_Marca_*', '**/Paste_*', 'demo-media/**'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/rest\//,
            /^\/auth\//,
            /manifest\.webmanifest$/,
            /sw\.js$/,
            /dev-sw\.js$/,
            /workbox-.*\.js$/,
            /\.mp4$/,
            /\.webm$/,
            /\.pdf$/,
          ],
          runtimeCaching: [
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
