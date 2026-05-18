require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initDB }   = require('./config/db');

const app    = express();
const PORT   = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — whitelist via env, fallback localhost per dev
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin non consentita dal CORS'));
  },
  credentials: true,
}));

// Rate limiting globale — /api/auth ha il proprio limiter più restrittivo
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/auth'),
});
app.use('/api', apiLimiter);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/utenze',       require('./routes/utenze'));
app.use('/api/zone',         require('./routes/zone'));
app.use('/api/valori',       require('./routes/valori'));
app.use('/api/valutazioni',  require('./routes/valutazioni'));
app.use('/api/portafoglio',  require('./routes/portafoglio'));
app.use('/api/import',       require('./routes/import'));
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

// Error handler — maschera dettagli in produzione
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  const msg = isProd ? 'Errore interno del server' : (err.message || 'Errore interno del server');
  res.status(err.status || 500).json({ error: msg });
});

async function start() {
  try {
    await initDB();
    const server = app.listen(PORT, () => {
      console.log(`[SERVER] Backend avviato su http://localhost:${PORT}`);
    });
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
