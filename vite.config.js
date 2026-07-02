import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Si la API key no está configurada o tiene el valor por defecto, usamos el Mock
  const useMock = !env.VITE_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY === 'your_api_key'

  if (useMock) {
    console.info('\x1b[33m%s\x1b[0m', '⚠️ [Andi] No se detectó una API Key real de Firebase. Usando Mock local en localStorage.');
  }

  return {
    resolve: {
      alias: useMock ? {
        'firebase/app': path.resolve(__dirname, './src/firebaseMock.js'),
        'firebase/firestore': path.resolve(__dirname, './src/firebaseMock.js')
      } : {}
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'apple-touch-icon.png'
        ],
        manifest: {
          name: 'Andi — Gestión de Mesas',
          short_name: 'Andi',
          description: 'Sistema de reservas y gestión de mesas en tiempo real',
          lang: 'es-AR',
          theme_color: '#7a3a1e',
          background_color: '#f5efe6',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ]
  }
})