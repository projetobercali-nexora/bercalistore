import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
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
