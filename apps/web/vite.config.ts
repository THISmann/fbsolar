import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/fb-solar-logo.png', 'favicon.svg', 'icons.svg'],
      manifest: {
        name: 'FB Solar Power Ltd',
        short_name: 'FB Solar',
        description:
          'FB Solar Power Ltd — Solar is the Solution. Installations photovoltaïques résidentielles et professionnelles.',
        theme_color: '#0d120a',
        background_color: '#f7f5ef',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/brand/fb-solar-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/fb-solar-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + hashed assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Public catalog + media files (same-origin Traefik / reverse proxy)
            urlPattern: ({ request, url }) => {
              if (request.method !== 'GET') return false;
              const p = url.pathname;
              if (p.includes('/admin/') || p.includes('/social')) return false;
              return (
                p.startsWith('/api/catalog/pages') ||
                p.startsWith('/api/catalog/products') ||
                p.startsWith('/api/catalog/categories') ||
                p.startsWith('/api/media/file/')
              );
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'solar-api-public',
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cross-origin API base (e.g. VITE_API_BASE on another host/port)
            urlPattern: ({ request, url }) => {
              if (request.method !== 'GET') return false;
              const p = url.pathname;
              if (p.includes('/admin/') || p.includes('/social')) return false;
              return (
                p.includes('/api/catalog/pages') ||
                p.includes('/api/catalog/products') ||
                p.includes('/api/catalog/categories') ||
                p.includes('/api/media/file/')
              );
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'solar-api-public-xorigin',
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'solar-images',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
