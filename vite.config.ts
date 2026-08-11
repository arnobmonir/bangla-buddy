import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { banglaTtsApiPlugin } from './plugins/banglaTtsApi.ts'
import { translateApiPlugin } from './plugins/translateApi.ts'

export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_* to the client. Load all env so the /api/tts
  // and /api/translate middleware can read GEMINI_API_KEY from .env.local.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }

  return {
  plugins: [
    react(),
    banglaTtsApiPlugin(),
    translateApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'og.jpg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Bangla Buddy',
        short_name: 'Bangla Buddy',
        description:
          'Teach Bangla from English with auto speech, one word at a time.',
        theme_color: '#e8f4fc',
        background_color: '#e8f4fc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['education', 'kids'],
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
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + hashed assets + word JSON chunks
        globPatterns: ['**/*.{js,css,html,ico,svg,png,webp,woff2,json,webmanifest}'],
        globIgnores: ['**/icon-1024.png', '**/og.jpg'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/tts'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'bangla-tts-network',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/translate'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'translate-network',
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
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
  }
})
