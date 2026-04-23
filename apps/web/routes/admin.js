const express = require('express');
const axios = require('axios');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const API = process.env.API_URL || 'http://localhost:3000/api';

function api(token) {
  return axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function getErrorMessage(err, fallback = 'Error') {
  const raw = err.response?.data?.message || fallback;
  return Array.isArray(raw) ? raw.join(', ') : raw;
}

function toIsoDateStart(value) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

router.use(requireRole('ADMIN'));

/* ── Dashboard ── */
router.get('/', async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const client = api(req.session.user.token);

    const [metRes, asnRes, areasRes] = await Promise.all([
      client.get(`/metricas/hora?fecha=${hoy}`),
      client.get('/asignaciones/activas'),
      client.get('/catalogos/areas'),
    ]);

    const asignaciones = Array.isArray(asnRes.data) ? asnRes.data : [];

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

    res.render('admin/dashboard', {
      title: 'Panel Administrador',
      metricas: metRes.data,
      asignaciones,
      capturasMap,
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
    const client = api(req.session.user.token);
    const { data: empleado } = await client.get(`/empleados/${req.params.id}`);

    const asignaciones = Array.isArray(empleado?.asignaciones)
      ? empleado.asignaciones
      : [];

    const asignacionesDirectas = asignaciones.filter((asignacion) => {
      if (!Number.isInteger(Number(asignacion?.id))) return false;
      return asignacion?.tipo !== 'INDIRECTA';
    });

    const fechasUnicas = [...new Set(
      asignacionesDirectas
        .map((asignacion) => {
          if (!asignacion?.fecha) return null;
          return new Date(asignacion.fecha).toISOString().slice(0, 10);
        })
        .filter(Boolean)
    )];

    const metricasPorFecha = new Map();
    await Promise.all(
      fechasUnicas.map(async (fecha) => {
        try {
          const { data } = await client.get(`/metricas/hora?fecha=${fecha}`);
          metricasPorFecha.set(fecha, Array.isArray(data) ? data : []);
        } catch {
          metricasPorFecha.set(fecha, []);
        }
      })
    );

    const eficienciaPorSlot = new Map();
    metricasPorFecha.forEach((rows) => {
      rows.forEach((row) => {
        const asignacionId = Number(row?.asignacionId);
        const slotHora = Number(row?.slotHora);
        const eficiencia = Number(row?.eficienciaPct);

        if (!Number.isInteger(asignacionId) || !Number.isInteger(slotHora)) {
          return;
        }

        eficienciaPorSlot.set(
          `${asignacionId}-${slotHora}`,
          Number.isFinite(eficiencia) ? eficiencia : null,
        );
      });
    });

    const capturasPorAsignacion = {};
    await Promise.all(
      asignacionesDirectas.map(async (asignacion) => {
        try {
          const { data } = await client.get(`/capturas/asignacion/${asignacion.id}`);
          capturasPorAsignacion[asignacion.id] = Array.isArray(data) ? data : [];
        } catch {
          capturasPorAsignacion[asignacion.id] = [];
        }
      })
    );

    const resumenPorFecha = new Map();
    const eficienciasCapturadas = [];
    let totalPiezas = 0;
    let totalRechazos = 0;
    let totalNeto = 0;
    let totalSlots = 0;

    asignacionesDirectas.forEach((asignacion) => {
      const fechaIso = asignacion?.fecha
        ? new Date(asignacion.fecha).toISOString().slice(0, 10)
        : null;
      const capturas = capturasPorAsignacion[asignacion.id] || [];

      capturas.forEach((captura) => {
        const cantidad = Number(captura?.cantidad) || 0;
        const rechazadas = Array.isArray(captura?.rechazos)
          ? captura.rechazos.reduce((sum, rechazo) => sum + (Number(rechazo?.cantidad) || 0), 0)
          : 0;
        const neto = Math.max(cantidad - rechazadas, 0);

        totalPiezas += cantidad;
        totalRechazos += rechazadas;
        totalNeto += neto;
        totalSlots += 1;

        const slotKey = `${Number(asignacion.id)}-${Number(captura?.slotHora)}`;
        const eficiencia = eficienciaPorSlot.get(slotKey);

        if (Number.isFinite(eficiencia)) {
          eficienciasCapturadas.push(eficiencia);
        }

        if (!fechaIso) return;

        if (!resumenPorFecha.has(fechaIso)) {
          resumenPorFecha.set(fechaIso, {
            productividadNeta: 0,
            rechazos: 0,
            eficiencia: [],
          });
        }

        const dia = resumenPorFecha.get(fechaIso);
        dia.productividadNeta += neto;
        dia.rechazos += rechazadas;
        if (Number.isFinite(eficiencia)) {
          dia.eficiencia.push(eficiencia);
        }
      });
    });

    const round2 = (value) => Math.round(value * 100) / 100;
    const eficienciaPromedio = eficienciasCapturadas.length
      ? round2(eficienciasCapturadas.reduce((sum, value) => sum + value, 0) / eficienciasCapturadas.length)
      : null;
    const productividadPromedioSlot = totalSlots
      ? round2(totalNeto / totalSlots)
      : 0;
    const tasaRechazo = totalPiezas
      ? round2((totalRechazos / totalPiezas) * 100)
      : 0;

    const fechasOrdenadas = [...resumenPorFecha.keys()].sort((a, b) => a.localeCompare(b));
    const chartLabels = fechasOrdenadas.map((fecha) => {
      const [year, month, day] = fecha.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
      });
    });

    const chartProductividad = fechasOrdenadas.map((fecha) => round2(resumenPorFecha.get(fecha).productividadNeta));
    const chartRechazos = fechasOrdenadas.map((fecha) => round2(resumenPorFecha.get(fecha).rechazos));
    const chartEficiencia = fechasOrdenadas.map((fecha) => {
      const values = resumenPorFecha.get(fecha).eficiencia;
      if (!values.length) return null;
      return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
    });

    res.render('admin/empleados/detalle', {
      title: 'Detalle Empleado',
      empleado,
      empleadoMetricas: {
        totalPiezas,
        totalNeto,
        totalRechazos,
        totalSlots,
        eficienciaPromedio,
        productividadPromedioSlot,
        tasaRechazo,
      },
      empleadoCharts: {
        labels: chartLabels,
        productividad: chartProductividad,
        rechazos: chartRechazos,
        eficiencia: chartEficiencia,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/empleados/:id/qr', async (req, res, next) => {
  try {
    const response = await api(req.session.user.token).get(`/empleados/${req.params.id}/qr-image`, {
      responseType: 'arraybuffer',
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
      responseType: 'arraybuffer',
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
    req.flash(
      'success',
      `Sync completado: ${data.sincronizados} sincronizados, ${data.desactivados} desactivados`
    );
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
    await api(req.session.user.token).post('/catalogos/areas', {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
    });
    req.flash('success', 'Área creada');
    res.redirect('/admin/catalogos/areas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear área'));
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
    req.flash('error', getErrorMessage(err, 'Error al eliminar área'));
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
    await api(req.session.user.token).post('/catalogos/subtareas', {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      areaId: req.body.areaId ? Number(req.body.areaId) : undefined,
    });
    req.flash('success', 'Subtarea creada');
    res.redirect('/admin/catalogos/subtareas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear subtarea'));
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
    await api(req.session.user.token).post('/catalogos/modelos', {
      nombreSku: req.body.nombreSku,
      descripcion: req.body.descripcion,
    });
    req.flash('success', 'Modelo creado');
    res.redirect('/admin/catalogos/modelos');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear modelo'));
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
    await api(req.session.user.token).post('/catalogos/estandares', {
      subtareaId: req.body.subtareaId ? Number(req.body.subtareaId) : undefined,
      modeloId: req.body.modeloId ? Number(req.body.modeloId) : undefined,
      piezasPorHora: req.body.piezasPorHora ? Number(req.body.piezasPorHora) : undefined,
      vigenteDesde: toIsoDateStart(req.body.vigenteDesde),
    });

    req.flash('success', 'Estándar creado');
    res.redirect('/admin/catalogos/estandares');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear estándar'));
    res.redirect('/admin/catalogos/estandares');
  }
});

router.post('/catalogos/estandares/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(`/catalogos/estandares/${req.params.id}`, {
      piezasPorHora: req.body.cantidad ? Number(req.body.cantidad) : undefined,
      vigenteDesde: toIsoDateStart(req.body.vigente),
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

/* ─────────── Actividades Indirectas ─────────── */
router.get('/catalogos/actividades-indirectas', async (req, res, next) => {
  try {
    const { data } = await api(req.session.user.token).get('/catalogos/actividades-indirectas/todas');
    res.render('admin/catalogos/actividades-indirectas', {
      title: 'Actividades Indirectas',
      actividades: Array.isArray(data) ? data : [],
    });
  } catch (err) { next(err); }
});

router.post('/catalogos/actividades-indirectas', async (req, res) => {
  try {
    await api(req.session.user.token).post('/catalogos/actividades-indirectas', {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion || undefined,
    });
    req.flash('success', 'Actividad indirecta creada');
    res.redirect('/admin/catalogos/actividades-indirectas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al crear actividad indirecta'));
    res.redirect('/admin/catalogos/actividades-indirectas');
  }
});

router.post('/catalogos/actividades-indirectas/:id/editar', async (req, res) => {
  try {
    await api(req.session.user.token).patch(
      `/catalogos/actividades-indirectas/${req.params.id}`,
      {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion || undefined,
        activo: req.body.activo === 'true',
      },
    );
    req.flash('success', 'Actividad indirecta actualizada');
    res.redirect('/admin/catalogos/actividades-indirectas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al editar actividad indirecta'));
    res.redirect('/admin/catalogos/actividades-indirectas');
  }
});

router.post('/catalogos/actividades-indirectas/:id/eliminar', async (req, res) => {
  try {
    await api(req.session.user.token).delete(`/catalogos/actividades-indirectas/${req.params.id}`);
    req.flash('success', 'Actividad desactivada');
    res.redirect('/admin/catalogos/actividades-indirectas');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al desactivar actividad indirecta'));
    res.redirect('/admin/catalogos/actividades-indirectas');
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