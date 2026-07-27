'use strict';
require('dotenv').config();

const express       = require('express');
const http          = require('http');
const { Server }    = require('socket.io');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');

const { sequelize } = require('./src/config/database');
const authRoutes    = require('./src/routes/auth');
const observRoutes  = require('./src/routes/observations');
const sessRoutes    = require('./src/routes/sessions');
const skyRoutes     = require('./src/routes/sky');
const deviceRoutes  = require('./src/routes/devices');
const setupSocket   = require('./src/socket');

// ─── App & HTTP server ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const allowedOriginsStr = process.env.ALLOWED_ORIGINS || 'http://localhost';
const allowedOrigins = allowedOriginsStr === '*' ? '*' : allowedOriginsStr.split(',').map(o => o.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: false // credentials true + origin * is not allowed

  },
  pingTimeout:  60000,
  pingInterval: 25000
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin:      allowedOrigins,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    time:    new Date().toISOString(),
    env:     process.env.NODE_ENV
  });
});

app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/observations', observRoutes);
app.use('/api/v1/sessions',     sessRoutes);
app.use('/api/v1/sky',          skyRoutes);
app.use('/api/v1/devices',      deviceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado', path: req.path });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error:   err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ─── Socket.io setup ──────────────────────────────────────────────────────────
setupSocket(io);

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Sincronizar base de datos (crea tablas si no existen)
    await sequelize.authenticate();
    console.log('[DB] Conexión a MySQL exitosa');
    await sequelize.sync({ alter: true }); // alter=true actualiza columnas existentes
    console.log('[DB] Tablas sincronizadas');

    server.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════╗');
      console.log('║        ASTROSYNC SERVER v1.0          ║');
      console.log('╠═══════════════════════════════════════╣');
      console.log(`║  API REST:   http://localhost:${PORT}    ║`);
      console.log(`║  WebSocket:  ws://localhost:${PORT}      ║`);
      console.log(`║  Entorno:    ${(process.env.NODE_ENV || 'development').padEnd(27)}║`);
      console.log('╚═══════════════════════════════════════╝');
      console.log('');
    });
  } catch (err) {
    console.error('[FATAL] No se pudo iniciar el servidor:', err.message);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
