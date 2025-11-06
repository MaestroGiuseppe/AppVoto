import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Configurazione del plugin PWA
    VitePWA({
      registerType: 'autoUpdate',
      // Questo inietta il link al manifest in index.html
      injectRegister: 'auto',
      
      // Opzioni del Web App Manifest
      manifest: {
        name: 'App Votazioni Scolastiche',
        short_name: 'Votazioni',
        description: 'Applicazione per la gestione delle votazioni scolastiche.',
        // Colore del tema per la barra dell'app
        theme_color: '#007aff',
        background_color: '#f2f2f7',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        
        // Icone (che dovrai creare)
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // Icona "mascherabile" (per Android)
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})