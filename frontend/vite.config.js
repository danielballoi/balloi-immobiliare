import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Proxy: le chiamate /api vengono girate al backend Express su porta 5000.
  // In questo modo il frontend non ha mai "http://localhost:5000" scritto
  // in giro: basta "/api/..." e Vite pensa al resto in sviluppo.
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
