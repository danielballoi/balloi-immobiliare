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
        // Gestisce silenziosamente ECONNREFUSED: il backend potrebbe non essere ancora avviato
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (err.code === 'ECONNREFUSED') {
              console.log('[PROXY] Backend non raggiungibile su porta 5000 — avvia il server con: npm start');
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend non disponibile. Avvia il server backend.' }));
              }
            }
          });
        },
      },
    },
  },
})
