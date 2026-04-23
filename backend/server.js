require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/utenze',  require('./routes/utenze'));
app.use('/api/zone',    require('./routes/zone'));
app.use('/api/valori', require('./routes/valori'));
app.use('/api/valutazioni', require('./routes/valutazioni'));
app.use('/api/portafoglio', require('./routes/portafoglio'));
app.use('/api/import', require('./routes/import'));
app.use('/api/ntn',          require('./routes/ntn'));
app.use('/api/strade',       require('./routes/strade'));
app.use('/api/censimenti',   require('./routes/censimenti'));
app.use('/api/locazioni',    require('./routes/locazioni'));
app.use('/api/segnalazioni', require('./routes/segnalazioni'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint non trovato: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message || 'Errore interno del server' });
});

// Avvio
async function start() {
  try {
    await initDB();
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] Backend avviato su http://localhost:${PORT}`);
    });
    // app.listen() non lancia eccezioni: gli errori arrivano via evento
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER] Porta ${PORT} già in uso. Chiudi il processo esistente e riprova.`);
      } else {
        console.error('[SERVER] Errore avvio server:', err.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[SERVER] Errore avvio:', err.message);
    process.exit(1);
  }
}

start();
