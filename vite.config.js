import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: 'Producción Iturrospe',
        short_name: 'Iturrospe',
        description:
          'Trazabilidad del proceso productivo metalúrgico mediante códigos QR por plano.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: '#FFC107',
        lang: 'es-AR',
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // Permitir que los deep links /plano/{token} sean manejados por la SPA
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Cache de assets de Supabase storage (no crítico)
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
