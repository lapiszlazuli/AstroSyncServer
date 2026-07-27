'use strict';
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const Device   = require('../models/Device');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const u = user.toJSON ? user.toJSON() : user;
  const { password, ...safe } = u;
  return safe;
}

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 50 }).isAlphanumeric()
    .withMessage('Username debe tener 3-50 caracteres alfanuméricos'),
  body('email').isEmail().normalizeEmail()
    .withMessage('Email inválido'),
  body('password').isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('display_name').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, display_name } = req.body;

  try {
    // Verificar que no exista ya
    const existing = await User.findOne({
      where: { email }, attributes: ['id']
    });
    if (existing) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const existingUser = await User.findOne({
      where: { username }, attributes: ['id']
    });
    if (existingUser) {
      return res.status(409).json({ error: 'El username ya está en uso' });
    }

    // Hash de la contraseña
    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email,
      password:     hashed,
      display_name: display_name || username,
      last_login:   new Date()
    });

    const token = generateToken(user.id);

    res.status(201).json({
      message: 'Cuenta creada exitosamente',
      token,
      user:    sanitizeUser(user)
    });
  } catch (err) {
    console.error('[AUTH] Register error:', err.message);
    res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email, is_active: true } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Actualizar último login
    await user.update({ last_login: new Date() });

    const token = generateToken(user.id);

    res.json({
      message: 'Login exitoso',
      token,
      user:    sanitizeUser(user)
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// ─── PUT /api/v1/auth/location ────────────────────────────────────────────────
// Guardar ubicación habitual del observador
router.put('/location', authMiddleware, [
  body('lat').isFloat({ min: -90,  max: 90  }).withMessage('Latitud inválida'),
  body('lon').isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
  body('name').optional().trim().isLength({ max: 150 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { lat, lon, name } = req.body;
  try {
    await req.user.update({
      location_lat:  lat,
      location_lon:  lon,
      location_name: name || null
    });
    res.json({ message: 'Ubicación actualizada', lat, lon, name });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
});

// ─── POST /api/v1/auth/device ─────────────────────────────────────────────────
// Registrar dispositivo Android o WearOS
router.post('/device', authMiddleware, [
  body('device_type').isIn(['android', 'wearos', 'web', 'ios'])
    .withMessage('Tipo de dispositivo inválido'),
  body('device_name').optional().trim().isLength({ max: 150 }),
  body('device_model').optional().trim().isLength({ max: 100 }),
  body('fcm_token').optional().isLength({ max: 500 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { device_type, device_name, device_model, fcm_token } = req.body;

  try {
    // Upsert: actualizar si ya existe el mismo tipo de dispositivo para este usuario
    const [device, created] = await Device.findOrCreate({
      where:    { user_id: req.user.id, device_type },
      defaults: { device_name, device_model, fcm_token, last_seen: new Date() }
    });

    if (!created) {
      await device.update({ device_name, device_model, fcm_token, last_seen: new Date() });
    }

    res.status(created ? 201 : 200).json({
      message: created ? 'Dispositivo registrado' : 'Dispositivo actualizado',
      device
    });
  } catch (err) {
    console.error('[AUTH] Device error:', err.message);
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
});

module.exports = router;
