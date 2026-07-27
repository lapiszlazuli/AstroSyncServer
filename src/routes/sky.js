'use strict';
const express = require('express');
const router = express.Router();

// Si usamos la librería local o una externa para calcular coordenadas,
// esto serviría de fallback para el cliente si no quiere calcular localmente.
// En AstroSync, la app web y el Android pueden usar sus propios cálculos,
// pero proveer una API centralizada es útil.

router.get('/coordinates', async (req, res) => {
  const { body, lat, lon, time } = req.query;
  // TODO: Implementar cálculo de coordenadas usando astronomy-engine en Node.js
  res.json({
    message: 'Endpoint de coordenadas pendiente de implementación en Phase 1.5',
    query: req.query
  });
});

router.get('/visible', async (req, res) => {
  const { lat, lon, time } = req.query;
  // TODO: Devolver lista de objetos celestes visibles por encima del horizonte
  res.json({
    message: 'Endpoint de objetos visibles pendiente',
    query: req.query
  });
});

module.exports = router;
