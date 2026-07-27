'use strict';
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { ObservationSession, Observation } = require('../models/Observation');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Genera código de sesión legible: 3 letras + 3 números
function generateSyncCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I, O
  const digits  = '23456789';                 // sin 0, 1
  let code = '';
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

// ─── POST /api/v1/sessions — Iniciar sesión de observación ───────────────────
router.post('/', [
  body('location_lat').optional().isFloat({ min: -90, max: 90 }),
  body('location_lon').optional().isFloat({ min: -180, max: 180 }),
  body('location_name').optional().trim().isLength({ max: 150 }),
  body('notes').optional().trim().isLength({ max: 2000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    // Generar código único de sincronización
    let syncCode, exists = true;
    while (exists) {
      syncCode = generateSyncCode();
      exists = !!(await ObservationSession.findOne({ where: { sync_code: syncCode, is_active: true } }));
    }

    const session = await ObservationSession.create({
      user_id:      req.user.id,
      sync_code:    syncCode,
      location_lat: req.body.location_lat  || req.user.location_lat  || null,
      location_lon: req.body.location_lon  || req.user.location_lon  || null,
      location_name:req.body.location_name || req.user.location_name || null,
      notes:        req.body.notes         || null,
      started_at:   new Date(),
      is_active:    true
    });

    res.status(201).json({
      message:   'Sesión iniciada',
      session,
      sync_code: syncCode,
      qr_url:    `astrosync://join/${syncCode}` // deep link para la app Android
    });
  } catch (err) {
    console.error('[SESS] Create error:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ─── GET /api/v1/sessions — Mis sesiones ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const sessions = await ObservationSession.findAll({
      where:   { user_id: req.user.id },
      order:   [['started_at', 'DESC']],
      limit:   20,
      include: [{
        model:      Observation,
        as:         'observations',
        attributes: ['id', 'object_name', 'object_type', 'observed_at']
      }]
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// ─── GET /api/v1/sessions/:id — Detalle de sesión ────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const session = await ObservationSession.findOne({
      where:   { id: req.params.id, user_id: req.user.id },
      include: [{ model: Observation, as: 'observations' }]
    });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sesión' });
  }
});

// ─── PUT /api/v1/sessions/:id/end — Terminar sesión ─────────────────────────
router.put('/:id/end', async (req, res) => {
  try {
    const session = await ObservationSession.findOne({
      where: { id: req.params.id, user_id: req.user.id, is_active: true }
    });
    if (!session) return res.status(404).json({ error: 'Sesión activa no encontrada' });

    await session.update({ ended_at: new Date(), is_active: false });
    res.json({ message: 'Sesión terminada', session });
  } catch (err) {
    res.status(500).json({ error: 'Error al terminar sesión' });
  }
});

// ─── GET /api/v1/sessions/join/:code — Info pública por sync_code ─────────────
// (usado por Android para unirse a la sesión)
router.get('/join/:code', async (req, res) => {
  try {
    const session = await ObservationSession.findOne({
      where:      { sync_code: req.params.code.toUpperCase(), is_active: true },
      attributes: ['id', 'sync_code', 'location_lat', 'location_lon', 'location_name', 'started_at']
    });
    if (!session) return res.status(404).json({ error: 'Código de sesión inválido o expirado' });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar sesión' });
  }
});

module.exports = router;
