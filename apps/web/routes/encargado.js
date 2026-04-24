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
  // Lunes–Viernes: turno base 8-18 + horas extra flexibles 19-20
  return [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
}

function getSlotsDisponiblesParaCaptura() {
  const { hour, isoDay } = getMexicoNowParts();
  const slotsDelDia = getSlotsDelDia(isoDay);

  if (!slotsDelDia.length) return [];

  const disponibles = [];

  // Slot anterior: último slot válido antes de la hora actual
  const slotsPrev = slotsDelDia.filter(h => h < hour);
  if (slotsPrev.length) {
    const prev = slotsPrev[slotsPrev.length - 1];
    disponibles.push({ hora: prev, label: `${prev}:00 – ${prev + 1}:00` });
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

    const asignacionesHoyUrl = scope.isScoped
      ? `/asignaciones/hoy?areaId=${scope.areaId}`
      : '/asignaciones/hoy';

    const [metRes, asnRes, hoyRes] = await Promise.all([
      client.get(metricasUrl),
      client.get(asignacionesUrl),
      client.get(asignacionesHoyUrl),
    ]);

    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];
    const todasHoy = Array.isArray(hoyRes.data) ? hoyRes.data : [];

    // Cargar capturas (con rechazos) de TODAS las asignaciones del día
    // para que los rechazos aparezcan aunque la asignación ya no esté activa
    const capturasMap = {};
    await Promise.all(
      todasHoy.map(async (a) => {
        try {
          const r = await client.get(`/capturas/asignacion/${a.id}`);
          capturasMap[a.id] = Array.isArray(r.data) ? r.data : [];
        } catch {
          capturasMap[a.id] = [];
        }
      })
    );

    res.render('encargado/dashboard', {
      title: 'Panel Encargado',
      metricas: metRes.data,
      asignaciones,
      todasHoy,
      capturasMap,
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

    // Carga TODAS las asignaciones directas del día (activas + cerradas)
    // para permitir registrar rechazos a empleados que ya terminaron su turno
    const asignacionesPromise = scope.isScoped
      ? client.get(`/asignaciones/hoy?areaId=${scope.areaId}`)
      : client.get('/asignaciones/hoy');

    const [areasRes, modRes, asnRes] = await Promise.all([
      client.get('/catalogos/areas'),
      client.get('/catalogos/modelos'),
      asignacionesPromise,
    ]);

    const areas = Array.isArray(areasRes.data) ? areasRes.data : [];
    const modelos = Array.isArray(modRes.data) ? modRes.data : [];
    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];

    // Cargar capturas existentes de cada asignación para bloquear slots ya registrados
    const capturasMap = {};
    await Promise.all(
      asignaciones.map(async (a) => {
        try {
          const r = await client.get(`/capturas/asignacion/${a.id}`);
          capturasMap[a.id] = Array.isArray(r.data) ? r.data : [];
        } catch {
          capturasMap[a.id] = [];
        }
      })
    );

    const areaFija = scope.isScoped
      ? areas.find((a) => Number(a.id) === Number(scope.areaId)) || null
      : null;

    const { isoDay } = getMexicoNowParts();
    res.render('encargado/captura', {
      title: 'Registrar Captura',
      areas: scope.isScoped ? (areaFija ? [areaFija] : []) : areas,
      modelos,
      asignaciones,
      areaFija,
      lockArea: scope.isScoped,
      slotsDisponibles: getSlotsDisponiblesParaCaptura(),
      todosSlotsDia: getSlotsDelDia(isoDay).map(h => ({ hora: h, label: `${h}:00` })),
      capturasMap,
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
    // 409 = slot ya capturado, mostrar mensaje específico
    const status = err.response?.status;
    const raw = err.response?.data?.message || 'Error al registrar captura';
    if (status === 409) {
      req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    } else {
      req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    }
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

    const [asnRes, areasRes, subRes, modRes, actIndRes] = await Promise.all([
      asignacionesPromise,
      client.get('/catalogos/areas'),
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/modelos'),
      client.get('/catalogos/actividades-indirectas'),
    ]);

    const areas = Array.isArray(areasRes.data) ? areasRes.data : [];
    const subtareas = Array.isArray(subRes.data) ? subRes.data : [];
    const modelos = Array.isArray(modRes.data) ? modRes.data : [];
    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];
    const actividadesIndirectas = Array.isArray(actIndRes.data) ? actIndRes.data : [];

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
      actividadesIndirectas,
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

    await client.post('/asignaciones/scan', { uuidQr, areaId, subtareaId, modeloId });
    req.flash('success', 'Asignación registrada');
    res.redirect('/encargado/asignar');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al asignar';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/asignar');
  }
});

/* ───────────────────────────────────────────────
 * Scan unificado — detecta directo vs indirecto
 * ─────────────────────────────────────────────── */
router.post('/asignar/scan-unified', async (req, res) => {
  try {
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    const uuidQr = (req.body.uuidQr || '').trim();
    const tipo = req.body.tipo; // 'DIRECTA' | 'INDIRECTA'
    let areaId = toInt(req.body.areaId);

    if (scope.isScoped) areaId = scope.areaId;

    if (!uuidQr || !areaId) {
      req.flash('error', 'Completa todos los campos requeridos');
      return res.redirect('/encargado/asignar');
    }

    if (tipo === 'INDIRECTA') {
      const actividadIndirectaId = toInt(req.body.actividadIndirectaId);
      if (!actividadIndirectaId) {
        req.flash('error', 'Selecciona una actividad');
        return res.redirect('/encargado/asignar');
      }
      await client.post('/asignaciones/scan-indirecta', { uuidQr, actividadIndirectaId, areaId });
      req.flash('success', 'Actividad indirecta registrada');
      return res.redirect('/encargado/asignar');
    }

    // DIRECTA
    const subtareaId = toInt(req.body.subtareaId);
    const modeloId = toInt(req.body.modeloId);

    if (!subtareaId || !modeloId) {
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

    await client.post('/asignaciones/scan', { uuidQr, areaId, subtareaId, modeloId });
    req.flash('success', 'Asignación registrada');
    res.redirect('/encargado/asignar');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al registrar asignación';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/asignar');
  }
});

/* ───────────────────────────────────────────────
 * Asignar actividad indirecta por QR (legacy — mantenido por compatibilidad)
 * ─────────────────────────────────────────────── */
router.post('/asignar/scan-indirecta', async (req, res) => {
  try {
    const client = apiClient(req.session.user.token);
    const scope = getUserAreaScope(req);

    const uuidQr = (req.body.uuidQr || '').trim();
    const actividadIndirectaId = toInt(req.body.actividadIndirectaId);
    let areaId = toInt(req.body.areaId);
    if (scope.isScoped) areaId = scope.areaId;

    if (!uuidQr || !actividadIndirectaId || !areaId) {
      req.flash('error', 'Selecciona actividad, área y escanea el QR');
      return res.redirect('/encargado/asignar');
    }

    await client.post('/asignaciones/scan-indirecta', { uuidQr, actividadIndirectaId, areaId });
    req.flash('success', 'Actividad indirecta registrada');
    res.redirect('/encargado/asignar');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al registrar actividad indirecta';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/asignar');
  }
});

/**
 * Finalizar asignación (activa=false, horaFin=ahora)
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

/* ───────────────────────────────────────────────
 * Registrar rechazo contra una captura existente
 * ─────────────────────────────────────────────── */
router.post('/rechazos', async (req, res) => {
  try {
    const capturaId = toInt(req.body.capturaId);
    const cantidad = toInt(req.body.cantidad);
    const motivo = (req.body.motivo || '').trim() || undefined;

    if (!capturaId || !cantidad) {
      req.flash('error', 'Datos incompletos para registrar rechazo');
      return res.redirect('/encargado/captura');
    }

    await apiClient(req.session.user.token).post('/rechazos', { capturaId, cantidad, motivo });
    req.flash('success', `Rechazo de ${cantidad} piezas registrado`);
    res.redirect('/encargado/captura');
  } catch (err) {
    const raw = err.response?.data?.message || 'Error al registrar rechazo';
    req.flash('error', Array.isArray(raw) ? raw.join(', ') : raw);
    res.redirect('/encargado/captura');
  }
});

/* ───────────────────────────────────────────────
 * AJAX endpoints — captura y rechazo sin recarga
 * ─────────────────────────────────────────────── */
router.post('/captura/ajax', async (req, res) => {
  try {
    const { data } = await apiClient(req.session.user.token).post('/capturas', req.body);
    res.json({ ok: true, captura: data });
  } catch (err) {
    const status = err.response?.status || 500;
    const raw = err.response?.data?.message || 'Error al registrar captura';
    res.status(status).json({ ok: false, message: Array.isArray(raw) ? raw.join(', ') : raw });
  }
});

router.post('/rechazos/ajax', async (req, res) => {
  try {
    const capturaId = toInt(req.body.capturaId);
    const cantidad = toInt(req.body.cantidad);
    const motivo = (req.body.motivo || '').trim() || undefined;

    if (!capturaId || !cantidad) {
      return res.status(400).json({ ok: false, message: 'Datos incompletos' });
    }

    const { data } = await apiClient(req.session.user.token).post('/rechazos', { capturaId, cantidad, motivo });
    res.json({ ok: true, rechazo: data });
  } catch (err) {
    const status = err.response?.status || 500;
    const raw = err.response?.data?.message || 'Error al registrar rechazo';
    res.status(status).json({ ok: false, message: Array.isArray(raw) ? raw.join(', ') : raw });
  }
});

module.exports = router;