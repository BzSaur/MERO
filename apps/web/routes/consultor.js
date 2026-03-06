const express = require('express');
const axios   = require('axios');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// ✅ En docker: pon API_URL=http://mero-api:3000/api
// ✅ En local: pon API_URL=http://localhost:3002/api
const API = process.env.API_URL || 'http://mero-api:3000/api';

function api(token) {
  return axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });
}

function hoyCDMX() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // YYYY-MM-DD
}

router.use(requireRole('ADMIN', 'CONSULTOR'));

/* ── Dashboard ── */
router.get('/', async (req, res, next) => {
  try {
    const hoy    = hoyCDMX();
    const client = api(req.session.user.token);

    const [metRes, asnRes, areasRes] = await Promise.all([
      client.get(`/metricas/hora?fecha=${hoy}`),
      client.get('/asignaciones/activas'),
      client.get('/catalogos/areas'),
    ]);

    res.render('consultor/dashboard', {
      title:        'Panel Consultor',
      metricas:     metRes.data,
      asignaciones: asnRes.data,
      areas:        areasRes.data,
      hoy,
    });
  } catch (err) { next(err); }
});

/* ── Histórico ── */
router.get('/historico', async (req, res, next) => {
  try {
    const { desde, hasta, areaId, subtareaId, modeloId } = req.query;
    const hoy    = hoyCDMX();

    const params = new URLSearchParams({
      desde: desde || hoy,
      hasta: hasta || hoy,
    });
    if (areaId)     params.set('areaId', areaId);
    if (subtareaId) params.set('subtareaId', subtareaId);
    if (modeloId)   params.set('modeloId', modeloId);

    const client = api(req.session.user.token);

    const [hisRes, areasRes, stRes, modRes] = await Promise.all([
      client.get(`/metricas/historico?${params}`),
      client.get('/catalogos/areas'),
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/modelos'),
    ]);

    res.render('consultor/historico', {
      title:     'Histórico',
      capturas:  hisRes.data, // ⚠️ esto realmente son asignaciones hoy; luego lo arreglamos
      areas:     areasRes.data,
      subtareas: stRes.data,
      modelos:   modRes.data,
      filtros:   { desde: desde || hoy, hasta: hasta || hoy, areaId, subtareaId, modeloId },
    });
  } catch (err) { next(err); }
});

module.exports = router;