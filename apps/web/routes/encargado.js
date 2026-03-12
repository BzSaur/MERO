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

function getUserAreaScope(req) {
  const user = req.session.user || {};
  const isEncargado = user.rol === 'ENCARGADO';
  const areaId = toInt(user.areaId);
  return {
    isEncargado,
    areaId,
    isScoped: isEncargado && Number.isInteger(areaId),
  };
}

function getMexicoNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';

  const isoMap = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    hour,
    minute,
    isoDay: isoMap[weekday] ?? 0,
  };
}

function getSlotsDelDia(isoDay) {
  if (isoDay === 7) return [];
  if (isoDay === 6) return [8, 9, 10, 11, 12, 13];
  return [8, 9, 10, 11, 12, 13, 15, 16, 17, 18];
}

function getSlotsDisponiblesParaCaptura() {
  const { hour, isoDay } = getMexicoNowParts();
  const slotsDelDia = getSlotsDelDia(isoDay);

  if (!slotsDelDia.length) return [];

  const disponibles = [];

  // Slot anterior: sigue disponible durante toda la hora siguiente
  if (slotsDelDia.includes(hour - 1)) {
    disponibles.push({
      hora: hour - 1,
      label: `${hour - 1}:00 – ${hour}:00`,
    });
  }

  // Slot actual: si la hora actual es un slot válido, también se puede capturar
  if (slotsDelDia.includes(hour)) {
    disponibles.push({
      hora: hour,
      label: `${hour}:00 – ${hour + 1}:00`,
    });
  }

  return disponibles;
}

async function renderDashboard(req, res, next) {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    const metricasUrl = scope.isScoped
      ? `/metricas/hora?fecha=${hoy}&areaId=${scope.areaId}`
      : `/metricas/hora?fecha=${hoy}`;

    const asignacionesUrl = scope.isScoped
      ? `/asignaciones/activas?areaId=${scope.areaId}`
      : '/asignaciones/activas';

    const [metRes, asnRes] = await Promise.all([
      client.get(metricasUrl),
      client.get(asignacionesUrl),
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
}

/* ───────────────────────────────────────────────
 * Dashboard
 * ─────────────────────────────────────────────── */
router.get('/', renderDashboard);
router.get('/dashboard', renderDashboard);

/* ───────────────────────────────────────────────
 * Captura
 * ─────────────────────────────────────────────── */
router.get('/captura', async (req, res, next) => {
  try {
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    const areasPromise = client.get('/catalogos/areas');
    const modelosPromise = client.get('/catalogos/modelos');
    const asignacionesPromise = scope.isScoped
      ? client.get(`/asignaciones/activas?areaId=${scope.areaId}`)
      : client.get('/asignaciones/activas');

    const [areasRes, modRes, asnRes] = await Promise.all([
      areasPromise,
      modelosPromise,
      asignacionesPromise,
    ]);

    const areas = Array.isArray(areasRes.data) ? areasRes.data : [];
    const modelos = Array.isArray(modRes.data) ? modRes.data : [];
    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];

    const areaFija = scope.isScoped
      ? areas.find((a) => Number(a.id) === Number(scope.areaId)) || null
      : null;

    const slotsDisponibles = getSlotsDisponiblesParaCaptura();

    res.render('encargado/captura', {
      title: 'Registrar Captura',
      areas: scope.isScoped ? (areaFija ? [areaFija] : []) : areas,
      modelos,
      asignaciones,
      areaFija,
      lockArea: scope.isScoped,
      slotsDisponibles,
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
    const scope = getUserAreaScope(req);

    const asignacionesPromise = scope.isScoped
      ? client.get(`/asignaciones/activas?areaId=${scope.areaId}`)
      : client.get('/asignaciones/activas');

    const [asnRes, areasRes, subRes, modRes] = await Promise.all([
      asignacionesPromise,
      client.get('/catalogos/areas'),
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/modelos'),
    ]);

    const areas = Array.isArray(areasRes.data) ? areasRes.data : [];
    const subtareas = Array.isArray(subRes.data) ? subRes.data : [];
    const modelos = Array.isArray(modRes.data) ? modRes.data : [];
    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];

    let areaFija = null;
    let areasFiltradas = areas;
    let subtareasFiltradas = subtareas;

    if (scope.isScoped) {
      areaFija = areas.find((a) => Number(a.id) === Number(scope.areaId)) || null;
      areasFiltradas = areaFija ? [areaFija] : [];
      subtareasFiltradas = subtareas.filter(
        (s) => Number(s.areaId) === Number(scope.areaId)
      );
    }

    res.render('encargado/asignar', {
      title: 'Asignaciones',
      asignaciones,
      areas: areasFiltradas,
      subtareas: subtareasFiltradas,
      modelos,
      areaFija,
      lockArea: scope.isScoped,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/asignar/scan', async (req, res) => {
  try {
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    let areaId = toInt(req.body.areaId);
    const subtareaId = toInt(req.body.subtareaId);
    const modeloId = toInt(req.body.modeloId);
    const uuidQr = (req.body.uuidQr || '').trim();

    if (scope.isScoped) {
      areaId = scope.areaId;
    }

    if (!uuidQr || !areaId || !subtareaId || !modeloId) {
      req.flash('error', 'Completa todos los campos requeridos');
      return res.redirect('/encargado/asignar');
    }

    const { data: subtareas } = await client.get('/catalogos/subtareas');
    const subtarea = (subtareas || []).find((s) => Number(s.id) === Number(subtareaId));

    if (!subtarea) {
      req.flash('error', 'La subtarea seleccionada no existe');
      return res.redirect('/encargado/asignar');
    }

    if (Number(subtarea.areaId) !== Number(areaId)) {
      req.flash('error', 'La subtarea no pertenece al área seleccionada');
      return res.redirect('/encargado/asignar');
    }

    const payload = {
      uuidQr,
      areaId,
      subtareaId,
      modeloId,
    };

    await client.post('/asignaciones/scan', payload);
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
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    if (scope.isScoped) {
      const { data: asignacion } = await client.get(`/asignaciones/${req.params.id}`);
      if (!asignacion || Number(asignacion.areaId) !== Number(scope.areaId)) {
        req.flash('error', 'No puedes finalizar asignaciones de otra área');
        return res.redirect('/encargado/asignar');
      }
    }

    await client.patch(`/asignaciones/${req.params.id}/finalizar`);
    req.flash('success', 'Asignación finalizada');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al finalizar';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
  }
  res.redirect('/encargado/asignar');
});

module.exports = router;