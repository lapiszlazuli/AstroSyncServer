'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const Device = require('../models/Device');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/v1/devices ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const devices = await Device.findAll({
      where: { user_id: req.user.id },
      order: [['last_seen', 'DESC']]
    });
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

// ─── DELETE /api/v1/devices/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });
    if (!device) return res.status(404).json({ error: 'Dispositivo no encontrado' });
    
    await device.destroy();
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dispositivo' });
  }
});

module.exports = router;
