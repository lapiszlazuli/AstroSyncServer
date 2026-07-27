'use strict';
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Observation } = require('../models/Observation');
const { authMiddleware } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// Todas las rutas de observaciones requieren autenticación
router.use(authMiddleware);

// ─── GET /api/v1/observations ─────────────────────────────────────────────────
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isIn(['star','planet','moon','sun','messier','galaxy','nebula','cluster','other']),
  query('search').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const limit  = parseInt(req.query.limit  || '20');
  const offset = parseInt(req.query.offset || '0');

  const where = { user_id: req.user.id };
  if (req.query.type)   where.object_type = req.query.type;
  if (req.query.search) where.object_name = { [Op.like]: `%${req.query.search}%` };

  try {
    const { count, rows } = await Observation.findAndCountAll({
      where,
      order:  [['observed_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      total:        count,
      limit,
      offset,
      observations: rows
    });
  } catch (err) {
    console.error('[OBS] List error:', err.message);
    res.status(500).json({ error: 'Error al obtener observaciones' });
  }
});

// ─── POST /api/v1/observations ────────────────────────────────────────────────
router.post('/', [
  body('object_name').trim().isLength({ min: 1, max: 100 }).withMessage('Nombre requerido'),
  body('object_type').optional().isIn(['star','planet','moon','sun','messier','galaxy','nebula','cluster','other']),
  body('ra').optional().isFloat(),
  body('dec_coord').optional().isFloat({ min: -90, max: 90 }),
  body('alt_observed').optional().isFloat({ min: -90, max: 90 }),
  body('az_observed').optional().isFloat({ min: 0, max: 360 }),
  body('magnitude').optional().isFloat({ min: -30, max: 30 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
  body('session_id').optional().isInt(),
  body('equipment').optional().trim().isLength({ max: 200 }),
  body('observed_at').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const obs = await Observation.create({
      user_id:     req.user.id,
      session_id:  req.body.session_id   || null,
      object_name: req.body.object_name,
      object_type: req.body.object_type  || 'other',
      ra:          req.body.ra           || null,
      dec_coord:   req.body.dec_coord    || null,
      alt_observed:req.body.alt_observed || null,
      az_observed: req.body.az_observed  || null,
      magnitude:   req.body.magnitude    || null,
      constellation:req.body.constellation || null,
      notes:       req.body.notes        || null,
      equipment:   req.body.equipment    || null,
      observed_at: req.body.observed_at  ? new Date(req.body.observed_at) : new Date(),
      aligned_by:  req.body.aligned_by   || 'web',
      alignment_accuracy: req.body.alignment_accuracy || null
    });

    res.status(201).json({ message: 'Observación guardada', observation: obs });
  } catch (err) {
    console.error('[OBS] Create error:', err.message);
    res.status(500).json({ error: 'Error al guardar observación' });
  }
});

// ─── GET /api/v1/observations/:id ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const obs = await Observation.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });
    if (!obs) return res.status(404).json({ error: 'Observación no encontrada' });
    res.json({ observation: obs });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener observación' });
  }
});

// ─── PUT /api/v1/observations/:id ─────────────────────────────────────────────
router.put('/:id', [
  body('notes').optional().trim().isLength({ max: 2000 }),
  body('equipment').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const obs = await Observation.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });
    if (!obs) return res.status(404).json({ error: 'Observación no encontrada' });

    const allowed = ['notes', 'equipment', 'magnitude', 'constellation', 'object_type'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await obs.update(updates);
    res.json({ message: 'Observación actualizada', observation: obs });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// ─── DELETE /api/v1/observations/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const obs = await Observation.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });
    if (!obs) return res.status(404).json({ error: 'Observación no encontrada' });
    await obs.destroy();
    res.json({ message: 'Observación eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ─── GET /api/v1/observations/export ─────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const rows = await Observation.findAll({
      where: { user_id: req.user.id },
      order: [['observed_at', 'DESC']]
    });

    const headers = 'Objeto,Tipo,RA,Dec,Altitud,Azimut,Magnitud,Constelación,Equipo,Fecha,Notas\n';
    const csv = rows.map(r => [
      `"${r.object_name}"`,
      r.object_type,
      r.ra           || '',
      r.dec_coord    || '',
      r.alt_observed || '',
      r.az_observed  || '',
      r.magnitude    || '',
      r.constellation|| '',
      `"${r.equipment || ''}"`,
      r.observed_at ? r.observed_at.toISOString() : '',
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="astrosync-observations.csv"');
    res.send(headers + csv);
  } catch (err) {
    res.status(500).json({ error: 'Error al exportar' });
  }
});

module.exports = router;
