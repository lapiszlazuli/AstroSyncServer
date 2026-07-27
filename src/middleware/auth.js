'use strict';
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: verifica JWT en el header Authorization
 * Uso: router.get('/ruta', authMiddleware, handler)
 */
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Cargar usuario desde BD para confirmar que existe y está activo
    const user = await User.findOne({
      where: { id: payload.userId, is_active: true },
      attributes: ['id', 'username', 'email', 'display_name', 'location_lat', 'location_lon']
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.user = user; // disponible en el handler
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado, inicia sesión de nuevo' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware opcional: intenta autenticar pero no bloquea si no hay token
 */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(payload.userId, {
        attributes: ['id', 'username', 'email']
      });
      req.user = user || null;
    }
  } catch (_) {
    req.user = null;
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
