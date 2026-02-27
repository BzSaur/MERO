const express = require('express');
const axios = require('axios');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// En Docker debe venir como http://api:3000/api (por env). Fallback para local.
const API = process.env.API_URL || 'http://localhost:3000/api';

function apiClient(token) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
}

router.use(requireRole('ADMIN', 'ENCARGADO'));

/**
 * Convierte a int seguro:
 * - "" / undefined / null => undefined
 * - "12" => 12
 */
function toInt(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}

/* ───────────────────────────────────────────────
 * Dashboard
 * ─────────────────────────────────────────────── */
router.get('/', async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const client = apiClient(req.session.user.token);

    const [metRes, asnRes] = await Promise.all([
      client.get(`/metricas/hora?fecha=${hoy}`),
      client.get('/asignaciones/activas'),
    ]);

    res.render('encargado/dashboard', {
      title: 'Panel Encargado',
      metricas: metRes.data,
      asignaciones: asnRes.data,
      hoy,
    });
  } catch (err) {
    next(err);
  }
});

/* ───────────────────────────────────────────────
 * Captura
 * ─────────────────────────────────────────────── */
router.get('/captura', async (req, res, next) => {
  try {
    const client = apiClient(req.session.user.token);

    const [areasRes, modRes, asnRes] = await Promise.all([
      client.get('/catalogos/areas'),
      client.get('/catalogos/modelos'),
      client.get('/asignaciones/activas'),
    ]);

    res.render('encargado/captura', {
      title: 'Registrar Captura',
      areas: areasRes.data,
      modelos: modRes.data,
      asignaciones: asnRes.data,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/captura', async (req, res) => {
  try {
    await apiClient(req.session.user.token).post('/capturas', req.body);
    req.flash('success', 'Captura registrada');
    res.redirect('/encargado/captura');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al registrar captura';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/captura');
  }
});

/* ───────────────────────────────────────────────
 * Asignaciones
 * ─────────────────────────────────────────────── */
router.get('/asignar', async (req, res, next) => {
  try {
    const client = apiClient(req.session.user.token);

    const [asnRes, areasRes, subRes, modRes] = await Promise.all([
      client.get('/asignaciones/activas'),
      client.get('/catalogos/areas'),
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/modelos'),
    ]);

    res.render('encargado/asignar', {
      title: 'Asignaciones',
      asignaciones: asnRes.data,
      areas: areasRes.data,
      subtareas: subRes.data,
      modelos: modRes.data,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/asignar/scan', async (req, res) => {
  try {
    const payload = {
      uuidQr: (req.body.uuidQr || '').trim(),
      areaId: toInt(req.body.areaId),
      subtareaId: toInt(req.body.subtareaId),
      modeloId: toInt(req.body.modeloId),
    };

    await apiClient(req.session.user.token).post('/asignaciones/scan', payload);
    req.flash('success', 'Asignación registrada');
    res.redirect('/encargado/asignar');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al asignar';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/asignar');
  }
});

/**
 * Finalizar asignación (activa=false, horaFin=ahora)
 * Requiere que exista PATCH /api/asignaciones/:id/finalizar en el API.
 */
router.post('/asignar/:id/finalizar', async (req, res) => {
  try {
    await apiClient(req.session.user.token).patch(`/asignaciones/${req.params.id}/finalizar`);
    req.flash('success', 'Asignación finalizada');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al finalizar';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
  }
  res.redirect('/encargado/asignar');
});

module.exports = router;