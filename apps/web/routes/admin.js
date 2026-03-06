const express = require('express');
const axios   = require('axios');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const API    = process.env.API_URL || 'http://localhost:3000/api';

function api(token) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` }
  });
}

function getErrorMessage(err, fallback = 'Error') {
  const raw = err.response?.data?.message || fallback;
  return Array.isArray(raw) ? raw.join(', ') : raw;
}

router.use(requireRole('ADMIN'));

/* ── Dashboard ── */
router.get('/', async (req, res, next) => {
  try {
    const hoy    = new Date().toISOString().slice(0, 10);
    const client = api(req.session.user.token);

    const [metRes, asnRes, areasRes] = await Promise.all([
      client.get(`/metricas/hora?fecha=${hoy}`),
      client.get('/asignaciones/activas'),
      client.get('/catalogos/areas'),
    ]);

    res.render('admin/dashboard', {
      title: 'Panel Administrador',
      metricas: metRes.data,
      asignaciones: asnRes.data,
      areas: areasRes.data,
      hoy,
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────── Usuarios ─────────── */
router.get('/usuarios', async (req, res, next) => {
  try {
    const { data: usuarios } = await api(req.session.user.token).get('/usuarios');
    res.render('admin/usuarios/index', { title: 'Usuarios', usuarios });
  } catch (err) {
    next(err);
  }
});

router.get('/usuarios/nuevo', (req, res) => {
  res.render('admin/usuarios/form', { title: 'Nuevo usuario', usuario: null });
});

router.post('/usuarios', async (req, res) => {
  try {
    await api(req.session.user.token).post('/usuarios', req.body);
    req.flash('success', 'Usuario creado');
    res.redirect('/admin/usuarios');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear usuario'));
    res.redirect('/admin/usuarios/nuevo');
  }
});

router.get('/usuarios/:id/editar', async (req, res, next) => {
  try {
    const { data: usuario } = await api(req.session.user.token).get(`/usuarios/${req.params.id}`);
    res.render('admin/usuarios/form', { title: 'Editar usuario', usuario });
  } catch (err) {
    next(err);
  }
});

router.post('/usuarios/:id', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/usuarios/${req.params.id}`, req.body);
    req.flash('success', 'Usuario actualizado');
    res.redirect('/admin/usuarios');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al actualizar'));
    res.redirect(`/admin/usuarios/${req.params.id}/editar`);
  }
});

router.post('/usuarios/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/usuarios/${req.params.id}`);
    req.flash('success', 'Usuario eliminado permanentemente');
    res.redirect('/admin/usuarios');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al eliminar usuario'));
    res.redirect(`/admin/usuarios/${req.params.id}/editar`);
  }
});

/* ─────────── Empleados (lectura desde VITA) ─────────── */
router.get('/empleados', async (req, res, next) => {
  try {
    const { data: empleados } = await api(req.session.user.token).get('/empleados');
    res.render('admin/empleados/index', { title: 'Empleados (VITA)', empleados });
  } catch (err) {
    next(err);
  }
});

router.get('/empleados/:id', async (req, res, next) => {
  try {
    const { data: empleado } = await api(req.session.user.token).get(`/empleados/${req.params.id}`);
    res.render('admin/empleados/detalle', { title: 'Detalle Empleado', empleado });
  } catch (err) {
    next(err);
  }
});

router.get('/empleados/:id/qr', async (req, res, next) => {
  try {
    const response = await api(req.session.user.token).get(`/empleados/${req.params.id}/qr-image`, {
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="qr-empleado-${req.params.id}.png"`);
    res.send(Buffer.from(response.data));
  } catch (err) {
    next(err);
  }
});

router.get('/empleados/:id/qr-download', async (req, res, next) => {
  try {
    const response = await api(req.session.user.token).get(`/empleados/${req.params.id}/qr-image`, {
      responseType: 'arraybuffer'
    });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="qr-empleado-${req.params.id}.png"`);
    res.send(Buffer.from(response.data));
  } catch (err) {
    next(err);
  }
});

router.post('/empleados/sync', async (req, res) => {
  try {
    const { data } = await api(req.session.user.token).post('/empleados/sync');
    req.flash('success', `Sync completado: ${data.sincronizados} sincronizados, ${data.desactivados} desactivados`);
    res.redirect('/admin/empleados');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al sincronizar'));
    res.redirect('/admin/empleados');
  }
});

/* ─────────── Catálogos — Áreas ─────────── */
router.get('/catalogos/areas', async (req, res, next) => {
  try {
    const { data: areas } = await api(req.session.user.token).get('/catalogos/areas');
    res.render('admin/catalogos/areas', { title: 'Áreas', areas });
  } catch (err) {
    next(err);
  }
});

router.post('/catalogos/areas', async (req, res) => {
  try {
    await api(req.session.user.token).post('/catalogos/areas', req.body);
    req.flash('success', 'Área creada');
    res.redirect('/admin/catalogos/areas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error'));
    res.redirect('/admin/catalogos/areas');
  }
});

router.post('/catalogos/areas/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/catalogos/areas/${req.params.id}`, {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
    });

    req.flash('success', 'Área actualizada');
    res.redirect('/admin/catalogos/areas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al actualizar área'));
    res.redirect('/admin/catalogos/areas');
  }
});

router.post('/catalogos/areas/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/catalogos/areas/${req.params.id}`);
    req.flash('success', 'Área eliminada');
    res.redirect('/admin/catalogos/areas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al eliminar'));
    res.redirect('/admin/catalogos/areas');
  }
});

/* ─────────── Catálogos — Subtareas ─────────── */
router.get('/catalogos/subtareas', async (req, res, next) => {
  try {
    const client = api(req.session.user.token);
    const [stRes, arRes] = await Promise.all([
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/areas'),
    ]);

    res.render('admin/catalogos/subtareas', {
      title: 'Subtareas',
      subtareas: stRes.data,
      areas: arRes.data,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/catalogos/subtareas', async (req, res) => {
  try {
    await api(req.session.user.token).post('/catalogos/subtareas', req.body);
    req.flash('success', 'Subtarea creada');
    res.redirect('/admin/catalogos/subtareas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error'));
    res.redirect('/admin/catalogos/subtareas');
  }
});

router.post('/catalogos/subtareas/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/catalogos/subtareas/${req.params.id}`, {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      areaId: req.body.areaId ? Number(req.body.areaId) : undefined,
    });

    req.flash('success', 'Subtarea actualizada');
    res.redirect('/admin/catalogos/subtareas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al actualizar subtarea'));
    res.redirect('/admin/catalogos/subtareas');
  }
});

router.post('/catalogos/subtareas/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/catalogos/subtareas/${req.params.id}`);
    req.flash('success', 'Subtarea eliminada');
    res.redirect('/admin/catalogos/subtareas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al eliminar subtarea'));
    res.redirect('/admin/catalogos/subtareas');
  }
});

/* ─────────── Catálogos — Modelos ─────────── */
router.get('/catalogos/modelos', async (req, res, next) => {
  try {
    const { data: modelos } = await api(req.session.user.token).get('/catalogos/modelos');
    res.render('admin/catalogos/modelos', { title: 'Modelos', modelos });
  } catch (err) {
    next(err);
  }
});

router.post('/catalogos/modelos', async (req, res) => {
  try {
    await api(req.session.user.token).post('/catalogos/modelos', req.body);
    req.flash('success', 'Modelo creado');
    res.redirect('/admin/catalogos/modelos');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error'));
    res.redirect('/admin/catalogos/modelos');
  }
});

router.post('/catalogos/modelos/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/catalogos/modelos/${req.params.id}`, {
      nombreSku: req.body.nombre,
      descripcion: req.body.descripcion,
    });

    req.flash('success', 'Modelo actualizado');
    res.redirect('/admin/catalogos/modelos');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al actualizar modelo'));
    res.redirect('/admin/catalogos/modelos');
  }
});

router.post('/catalogos/modelos/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/catalogos/modelos/${req.params.id}`);
    req.flash('success', 'Modelo eliminado');
    res.redirect('/admin/catalogos/modelos');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al eliminar modelo'));
    res.redirect('/admin/catalogos/modelos');
  }
});

/* ─────────── Catálogos — Estándares ─────────── */
router.get('/catalogos/estandares', async (req, res, next) => {
  try {
    const client = api(req.session.user.token);
    const [estRes, stRes, modRes] = await Promise.all([
      client.get('/catalogos/estandares'),
      client.get('/catalogos/subtareas'),
      client.get('/catalogos/modelos'),
    ]);

    res.render('admin/catalogos/estandares', {
      title: 'Estándares',
      estandares: estRes.data,
      subtareas: stRes.data,
      modelos: modRes.data,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/catalogos/estandares', async (req, res) => {
  try {
    await api(req.session.user.token).post('/catalogos/estandares', req.body);
    req.flash('success', 'Estándar creado');
    res.redirect('/admin/catalogos/estandares');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error'));
    res.redirect('/admin/catalogos/estandares');
  }
});

router.post('/catalogos/estandares/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/catalogos/estandares/${req.params.id}`, {
      piezasPorHora: Number(req.body.cantidad),
      vigenteDesde: req.body.vigente,
    });

    req.flash('success', 'Estándar actualizado');
    res.redirect('/admin/catalogos/estandares');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al actualizar estándar'));
    res.redirect('/admin/catalogos/estandares');
  }
});

router.post('/catalogos/estandares/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/catalogos/estandares/${req.params.id}`);
    req.flash('success', 'Estándar eliminado');
    res.redirect('/admin/catalogos/estandares');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al eliminar estándar'));
    res.redirect('/admin/catalogos/estandares');
  }
});

/* ─────────── Auditoría ─────────── */
router.get('/auditoria', async (req, res, next) => {
  try {
    const { desde, hasta, tabla } = req.query;
    const params = new URLSearchParams({ limit: '100' });

    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (tabla) params.set('tabla', tabla);

    const { data: registros } = await api(req.session.user.token).get(`/auditoria?${params}`);

    res.render('admin/auditoria', {
      title: 'Auditoría',
      registros,
      filtros: { desde, hasta, tabla },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;