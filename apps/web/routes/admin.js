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

function normalizeForFilename(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildQrDownloadFilename(empleado, id) {
  const rawName = `${empleado?.nombre || ''} ${empleado?.apellidos || ''}`.trim();
  const normalized = normalizeForFilename(rawName);

  return `${normalized || `empleado_${id}`}_QR.png`;
}

function parseIdList(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => Number(value))
      .filter((value, index, arr) => Number.isInteger(value) && value > 0 && arr.indexOf(value) === index);
  }

  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value, index, arr) => Number.isInteger(value) && value > 0 && arr.indexOf(value) === index);
  }

  return [];
}

function chunkItems(items, size) {
  const pages = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function truncateLabel(value, maxLength = 44) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildQrSheetPdfFilename(printable, qrSizeIn) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const areas = [...new Set(printable.map((item) => item.area).filter(Boolean))];
  const areaTag = areas.length === 1
    ? normalizeForFilename(areas[0]) || 'AREA'
    : 'GENERAL';
  const sizeTag = String(Number(qrSizeIn || 2).toFixed(1)).replace('.', '_');
  return `QR_${areaTag}_${sizeTag}in_${dateTag}.pdf`;
}

function streamQrSheetPdf(res, printable, qrSizeIn) {
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch {
    throw new Error('PDF_EXPORT_DEPENDENCY_MISSING');
  }

  const pages = chunkItems(printable, 6);
  const filename = buildQrSheetPdfFilename(printable, qrSizeIn);

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 36, left: 36, right: 36, bottom: 36 },
    info: {
      Title: 'Hoja de QRs MERO',
      Author: 'MERO',
    },
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });

  doc.pipe(res);

  const qrSizePt = Number(qrSizeIn || 2) * 72;
  const colGapPt = qrSizeIn === 2.5 ? 30 : 45;
  const rowGapPt = qrSizeIn === 2.5 ? 8 : 16;
  const slotHeightPt = qrSizePt + 40;
  const labelWidth = qrSizePt + 28;

  const pageWidth = doc.page.width;
  const marginLeft = doc.page.margins.left;
  const marginRight = doc.page.margins.right;
  const marginTop = doc.page.margins.top;

  const contentWidth = pageWidth - marginLeft - marginRight;
  const gridWidth = qrSizePt * 2 + colGapPt;
  const startX = marginLeft + Math.max((contentWidth - gridWidth) / 2, 0);
  const startY = marginTop + 6;

  pages.forEach((pageItems, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    for (let slotIndex = 0; slotIndex < 6; slotIndex++) {
      const item = pageItems[slotIndex];
      if (!item?.qrBuffer) continue;

      const row = Math.floor(slotIndex / 2);
      const col = slotIndex % 2;
      const x = startX + col * (qrSizePt + colGapPt);
      const y = startY + row * (slotHeightPt + rowGapPt);

      doc.save();
      doc
        .lineWidth(0.6)
        .strokeColor('#94a3b8')
        .rect(x - 1, y - 1, qrSizePt + 2, qrSizePt + 2)
        .stroke();
      doc.restore();

      try {
        doc.image(item.qrBuffer, x, y, { fit: [qrSizePt, qrSizePt] });
      } catch {
        doc
          .fillColor('#ef4444')
          .font('Helvetica')
          .fontSize(9)
          .text('QR no disponible', x + 8, y + qrSizePt / 2 - 4);
      }

      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(qrSizeIn === 2.5 ? 11 : 10.5)
        .text(truncateLabel(item.nombre, qrSizeIn === 2.5 ? 40 : 30), x - 14, y + qrSizePt + 8, {
          width: labelWidth,
          align: 'center',
          lineBreak: false,
          ellipsis: true,
        });

      if (item.area) {
        doc
          .fillColor('#475569')
          .font('Helvetica')
          .fontSize(qrSizeIn === 2.5 ? 9.5 : 9)
          .text(truncateLabel(item.area, 38), x - 14, y + qrSizePt + 23, {
            width: labelWidth,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          });
      }
    }
  });

  doc.end();
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

router.get('/empleados/:id(\\d+)', async (req, res, next) => {
  try {
    const { data: empleado } = await api(req.session.user.token).get(`/empleados/${req.params.id}`);
    res.render('admin/empleados/detalle', { title: 'Detalle Empleado', empleado });
  } catch (err) {
    next(err);
  }
});

router.get('/empleados/:id(\\d+)/qr-descargar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    req.flash('error', 'ID de empleado inválido');
    return res.redirect('/admin/empleados');
  }

  try {
    const client = api(req.session.user.token);
    const { data: qrBuffer } = await client.get(`/empleados/${id}/qr-image`, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });

    let filename = `empleado_${id}_QR.png`;
    try {
      const { data: empleado } = await client.get(`/empleados/${id}`);
      filename = buildQrDownloadFilename(empleado, id);
    } catch {
      // Si falla el detalle, se conserva nombre genérico y se descarga de todos modos.
    }

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });

    return res.send(Buffer.from(qrBuffer));
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'No se pudo descargar el QR'));
    return res.redirect(`/admin/empleados/${id}`);
  }
});

async function renderPrintQrSheet(req, res) {
  const ids = parseIdList(req.body?.ids ?? req.query?.ids);
  const rawSize = Number(req.body?.qrSizeIn ?? req.query?.qrSizeIn ?? 2);
  const qrSizeIn = rawSize >= 2.5 ? 2.5 : 2;
  const outputFormat = String(req.body?.format ?? req.query?.format ?? 'html').toLowerCase() === 'pdf'
    ? 'pdf'
    : 'html';

  if (!ids.length) {
    req.flash('error', 'Selecciona al menos un empleado para imprimir QR');
    return res.redirect('/admin/empleados');
  }

  try {
    const client = api(req.session.user.token);
    const { data: empleados } = await client.get('/empleados');
    const byId = new Map((Array.isArray(empleados) ? empleados : []).map((emp) => [Number(emp.id), emp]));

    const selected = ids
      .map((id) => byId.get(id))
      .filter(Boolean);

    if (!selected.length) {
      req.flash('error', 'No se encontraron empleados activos para los IDs seleccionados');
      return res.redirect('/admin/empleados');
    }

    const printable = [];
    const fallidos = [];

    for (const emp of selected) {
      try {
        const { data: qrBuffer } = await client.get(`/empleados/${emp.id}/qr-image`, {
          responseType: 'arraybuffer',
          timeout: 60_000,
        });

        const qrRawBuffer = Buffer.from(qrBuffer);

        printable.push({
          id: emp.id,
          nombre: `${emp.nombre || ''} ${emp.apellidos || ''}`.trim() || `Empleado ${emp.id}`,
          area: emp?.vita?.area || null,
          qrDataUrl: `data:image/png;base64,${qrRawBuffer.toString('base64')}`,
          qrBuffer: qrRawBuffer,
        });
      } catch (err) {
        fallidos.push({
          id: emp.id,
          nombre: `${emp.nombre || ''} ${emp.apellidos || ''}`.trim() || `Empleado ${emp.id}`,
          error: getErrorMessage(err, 'No se pudo generar QR para impresión'),
        });
      }
    }

    if (!printable.length) {
      req.flash('error', 'No se pudo preparar ninguna etiqueta QR para impresión');
      return res.redirect('/admin/empleados');
    }

    if (outputFormat === 'pdf') {
      try {
        return streamQrSheetPdf(res, printable, qrSizeIn);
      } catch (pdfErr) {
        if (pdfErr?.message === 'PDF_EXPORT_DEPENDENCY_MISSING') {
          req.flash('error', 'Exportación PDF no disponible en este entorno. Usa el botón Imprimir y guarda como PDF.');
          return res.redirect('/admin/empleados');
        }
        throw pdfErr;
      }
    }

    const pages = chunkItems(printable, 6);
    const colGapIn = qrSizeIn === 2.5 ? 0.42 : 0.62;
    const rowGapIn = qrSizeIn === 2.5 ? 0.1 : 0.22;
    const slotMinHeightIn = qrSizeIn === 2.5 ? 3.05 : 2.5;
    const nameMaxWidthIn = qrSizeIn === 2.5 ? 3.2 : 2.85;
    const nameFontPx = qrSizeIn === 2.5 ? 13 : 12;
    const areaFontPx = qrSizeIn === 2.5 ? 11 : 10;

    return res.render('admin/empleados/print-sheet', {
      title: 'Imprimir QR',
      pages,
      total: printable.length,
      requested: ids.length,
      fallidos,
      selectedIds: selected.map((emp) => emp.id).join(','),
      qrSizeIn,
      colGapIn,
      rowGapIn,
      slotMinHeightIn,
      nameMaxWidthIn,
      nameFontPx,
      areaFontPx,
      generatedAt: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    });
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'No se pudo preparar la hoja de impresión QR'));
    return res.redirect('/admin/empleados');
  }
}

router.post('/empleados/imprimir-qr-hoja', renderPrintQrSheet);
router.get('/empleados/imprimir-qr-hoja', renderPrintQrSheet);

router.post('/empleados/sync', async (req, res) => {
  try {
    const { data } = await api(req.session.user.token).post('/empleados/sync');
    const qrMsg = data?.qr
      ? ` | QR: ${data.qr.generados} generados, ${data.qr.existentes} existentes, ${data.qr.errores} errores`
      : '';
    req.flash(
      'success',
      `Sync completado: ${data.sincronizados} sincronizados, ${data.desactivados} desactivados${qrMsg}`
    );
    res.redirect('/admin/empleados');
  } catch (err) {
    req.flash('error', getErrorMessage(err, 'Error al sincronizar'));
    res.redirect('/admin/empleados');
  }
});

/**
 * POST /admin/empleados/enviar-qr
 * Proxy hacia la API: recibe { ids: number[] } y retorna JSON con resultados.
 * Timeout extendido a 5 minutos para soportar envíos masivos con delay anti-throttling.
 */
router.post('/empleados/enviar-qr', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs de empleados' });
    }

    const { data } = await api(req.session.user.token).post(
      '/empleados/enviar-qr',
      { ids },
      { timeout: 300_000 } // 5 minutos para envíos masivos
    );

    res.json(data);
  } catch (err) {
    const msg = getErrorMessage(err, 'Error al enviar QR');
    res.status(500).json({ error: msg });
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