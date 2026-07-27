'use strict';
const jwt = require('jsonwebtoken');

module.exports = function setupSocket(io) {
  
  // Middleware para Socket.io - valida JWT si está presente,
  // pero permite conexiones anónimas usando un código de sesión (sync_code).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = payload.userId;
      } catch (err) {
        // Ignorar error de token y permitir conexión anónima
        // (por si Android escanea QR sin estar logueado)
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Nuevo cliente conectado: ${socket.id} (User: ${socket.userId || 'Anónimo'})`);

    // ─── Rooms / Sesiones ──────────────────────────────────────────
    
    // Unirse a una sesión por código (ej: ASTRO7)
    socket.on('join-session', (data) => {
      const { sessionCode, deviceType } = data || {};
      if (!sessionCode) return;
      
      const roomName = `session_${sessionCode.toUpperCase()}`;
      socket.join(roomName);
      
      // Guardar el contexto en el socket
      socket.sessionCode = sessionCode.toUpperCase();
      socket.deviceType = deviceType || 'unknown'; // 'web', 'android', 'wearos'

      console.log(`[WS] ${socket.id} (${socket.deviceType}) se unió a ${roomName}`);
      
      // Notificar a los demás en la sala
      socket.to(roomName).emit('device-joined', {
        id: socket.id,
        deviceType: socket.deviceType
      });
    });

    socket.on('leave-session', () => {
      if (socket.sessionCode) {
        const roomName = `session_${socket.sessionCode}`;
        socket.leave(roomName);
        console.log(`[WS] ${socket.id} abandonó ${roomName}`);
        socket.sessionCode = null;
      }
    });

    // ─── Targets (Web → Server → Android) ──────────────────────────
    
    socket.on('set-target', (data) => {
      if (!socket.sessionCode) return;
      const roomName = `session_${socket.sessionCode}`;
      
      console.log(`\n======================================================`);
      console.log(`[WS] 🎯 NUEVO OBJETIVO RECIBIDO DE LA WEB`);
      console.log(`Sala: ${roomName}`);
      console.log(`Datos enviados a Android:`);
      console.log(JSON.stringify(data, null, 2));
      console.log(`======================================================\n`);
      
      // Retransmitir a todos los demás en la sesión (ej. Android)
      socket.to(roomName).emit('new-target', data);
    });

    // ─── Alineación (Android → Server → Web/Reloj) ────────────────
    
    socket.on('device-orientation', (data) => {
      if (!socket.sessionCode) return;
      const roomName = `session_${socket.sessionCode}`;
      
      // Log opcional (comentado para no saturar si envían muchos por segundo)
      // console.log(`[WS] 📱 Android Orientation -> Az: ${data.azimuth}, Alt: ${data.altitude}`);
      
      // Retransmitir la orientación actual a la Web para actualizar UI en vivo
      // Limitar a una vez por segundo idealmente desde el cliente, pero el servidor solo retransmite
      socket.to(roomName).emit('phone-pointing', data);
    });

    socket.on('target-aligned', (data) => {
      if (!socket.sessionCode) return;
      const roomName = `session_${socket.sessionCode}`;
      
      console.log(`\n======================================================`);
      console.log(`[WS] ✅ ALINEACIÓN CONFIRMADA DESDE ANDROID`);
      console.log(`Sala: ${roomName}`);
      console.log(`Datos recibidos del celular:`);
      console.log(JSON.stringify(data, null, 2));
      console.log(`-> Enviando notificación a la Web y comando Háptico al Reloj...`);
      console.log(`======================================================\n`);
      
      // Notificar a la web
      socket.to(roomName).emit('aligned', data);
      
      // Enviar comando háptico a Android para que lo pase al Reloj
      socket.to(roomName).emit('haptic-command', {
        pattern: 'aligned',
        intensity: 'strong'
      });
    });

    // ─── Desconexión ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[WS] Cliente desconectado: ${socket.id}`);
      if (socket.sessionCode) {
        const roomName = `session_${socket.sessionCode}`;
        socket.to(roomName).emit('device-left', {
          id: socket.id,
          deviceType: socket.deviceType
        });
      }
    });
  });
};
