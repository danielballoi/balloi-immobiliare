require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { initDB }   = require('./config/db');

const app    = express();
app.set('trust proxy', 1);
const PORT   = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Security headers (l'API restituisce solo JSON: la CSP per le pagine HTML va configurata in nginx)
app.use(helmet());

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

// Rate limiting globale: login e register hanno già authLimiter (routes/auth.js), qui li saltiamo.
// Nota: dentro app.use('/api') req.path è relativo (es. '/auth/login', non '/api/auth/login').
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ['/auth/login', '/auth/register'].includes(req.path),
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
  // Errori di upload di multer (es. file troppo grande): colpa della richiesta, non del server
  if (err.name === 'MulterError') {
    err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'File troppo grande (massimo 50 MB)';
  }
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[ERROR]', err);
  } else {
    console.warn(`[WARN] ${status} ${req.method} ${req.originalUrl}: ${err.message}`);
  }
  // 4xx: messaggio previsto da noi, sicuro da mostrare. 5xx: dettagli mascherati in produzione.
  const msg = status < 500
    ? err.message
    : (isProd ? 'Errore interno del server' : (err.message || 'Errore interno del server'));
  res.status(status).json({ error: msg });
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
