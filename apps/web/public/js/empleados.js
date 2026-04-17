/**
 * MERO — Vista de Empleados (Tarea 4.0 + 5)
 * Agenda alfabética con filtros, selección y envío de QR por correo.
 */
(function () {
  'use strict';

  /* ──────────────────────────────────────
     Estado
  ────────────────────────────────────── */
  const ALL = window.EMPLEADOS_DATA || [];
  let filtered = [];
  const selected = new Set(); // IDs seleccionados

  let searchTerm = '';
  let activeAreas = new Set();
  let quickFilter = null; // null | 'sin-correo' | 'sin-qr'
  let searchDebounce = null;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function getFirstNameToken(emp) {
    return (emp?.nombre || '').trim().split(/\s+/)[0] || '';
  }

  function getLetterKey(emp) {
    const firstName = normalizeText(getFirstNameToken(emp));
    const letter = firstName.charAt(0).toUpperCase();
    return /^[A-Z]$/.test(letter) ? letter : '#';
  }

  function compareByFirstName(a, b) {
    const aFirst = normalizeText(getFirstNameToken(a));
    const bFirst = normalizeText(getFirstNameToken(b));
    const firstCmp = aFirst.localeCompare(bFirst, 'es');
    if (firstCmp !== 0) return firstCmp;

    const aFull = normalizeText(`${a.nombre} ${a.apellidos || ''}`.trim());
    const bFull = normalizeText(`${b.nombre} ${b.apellidos || ''}`.trim());
    return aFull.localeCompare(bFull, 'es');
  }

  /* ──────────────────────────────────────
     Referencias DOM
  ────────────────────────────────────── */
  const agendaContainer = document.getElementById('agendaContainer');
  const empEmpty        = document.getElementById('empEmpty');
  const selectAll       = document.getElementById('selectAll');
  const selectedCount   = document.getElementById('selectedCount');
  const actionBar       = document.getElementById('actionBar');
  const actionBarInfo   = document.getElementById('actionBarInfo');
  const sendQrBtn       = document.getElementById('sendQrBtn');
  const qrSheetBtn = document.getElementById('qrSheetBtn');
  const headerSummary   = document.getElementById('headerSummary');
  const searchInput     = document.getElementById('empSearch');
  const searchClear     = document.getElementById('searchClear');
  const areaChips       = document.getElementById('areaChips');

  /* ──────────────────────────────────────
     Resumen en header
  ────────────────────────────────────── */
  function buildHeaderSummary() {
    const areas   = new Set(ALL.map(e => e.vita?.area).filter(Boolean)).size;
    const conQr   = ALL.filter(e => e.hasQr).length;
    const sinCorreo = ALL.filter(e => !e.hasEmail).length;
    if (headerSummary) {
      headerSummary.textContent =
        `${areas} áreas • ${ALL.length} activos • ${conQr} con QR • ${sinCorreo} sin correo`;
    }
  }

  /* ──────────────────────────────────────
     Chips de área
  ────────────────────────────────────── */
  function buildAreaChips() {
    const areas = [...new Set(ALL.map(e => e.vita?.area).filter(Boolean))].sort();
    if (!areaChips) return;
    areaChips.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = 'chip chip--area chip--all chip--active';
    allChip.textContent = 'Todas';
    allChip.dataset.area = '__all';
    areaChips.appendChild(allChip);

    areas.forEach(area => {
      const btn = document.createElement('button');
      btn.className = 'chip chip--area';
      btn.textContent = area;
      btn.dataset.area = area;
      areaChips.appendChild(btn);
    });

    areaChips.addEventListener('click', e => {
      const btn = e.target.closest('[data-area]');
      if (!btn) return;

      if (btn.dataset.area === '__all') {
        activeAreas.clear();
        areaChips.querySelectorAll('.chip--area').forEach(c => c.classList.remove('chip--active'));
        btn.classList.add('chip--active');
      } else {
        const allBtn = areaChips.querySelector('[data-area="__all"]');
        if (activeAreas.has(btn.dataset.area)) {
          activeAreas.delete(btn.dataset.area);
          btn.classList.remove('chip--active');
        } else {
          activeAreas.add(btn.dataset.area);
          btn.classList.add('chip--active');
          if (allBtn) allBtn.classList.remove('chip--active');
        }
        if (activeAreas.size === 0 && allBtn) allBtn.classList.add('chip--active');
      }

      applyFilters();
    });
  }

  /* ──────────────────────────────────────
     Filtrado
  ────────────────────────────────────── */
  function applyFilters() {
    const term = normalizeText(searchTerm).trim();

    filtered = ALL.filter(emp => {
      // Búsqueda por nombre o área
      if (term) {
        const nombre = normalizeText(`${emp.nombre} ${emp.apellidos || ''}`);
        const area   = normalizeText(emp.vita?.area || '');
        if (!nombre.includes(term) && !area.includes(term)) return false;
      }

      // Filtro por área
      if (activeAreas.size > 0) {
        if (!activeAreas.has(emp.vita?.area)) return false;
      }

      // Filtros rápidos
      if (quickFilter === 'sin-correo' && emp.hasEmail) return false;
      if (quickFilter === 'sin-qr'     && emp.hasQr)    return false;

      return true;
    }).sort(compareByFirstName);

    renderAgenda();
    updateSelectionUI();
  }

  /* ──────────────────────────────────────
     Renderizado de agenda
  ────────────────────────────────────── */
  function renderAgenda() {
    agendaContainer.innerHTML = '';

    if (filtered.length === 0) {
      empEmpty.removeAttribute('hidden');
      return;
    }
    empEmpty.setAttribute('hidden', '');

    // Agrupar por primera letra del nombre
    const groups = {};
    filtered.forEach(emp => {
      const letter = getLetterKey(emp);
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(emp);
    });

    const letters = Object.keys(groups).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b, 'es');
    });

    letters.forEach(letter => {
      const group = groups[letter];

      // Separador de letra
      const letterEl = document.createElement('div');
      letterEl.className = 'agenda-letter-header';
      letterEl.innerHTML = `
        <span class="agenda-letter-header__letter">${letter}</span>
        <span class="agenda-letter-header__line"></span>
        <label class="agenda-letter-header__check" title="Seleccionar todos de esta letra">
          <input type="checkbox" class="emp-cb letter-select-all" data-letter="${letter}">
          <span class="agenda-letter-header__check-label">Seleccionar ${letter}</span>
        </label>
      `;
      agendaContainer.appendChild(letterEl);

      // Rows de empleados
      group.forEach(emp => {
        const row = buildEmployeeRow(emp);
        agendaContainer.appendChild(row);
      });
    });

    // Vincular eventos a los checkboxes de letra
    agendaContainer.querySelectorAll('.letter-select-all').forEach(cb => {
      cb.addEventListener('change', () => {
        const letter = cb.dataset.letter;
        const empIds = filtered
          .filter(e => getLetterKey(e) === letter)
          .map(e => e.id);
        empIds.forEach(id => {
          if (cb.checked) selected.add(id);
          else selected.delete(id);
        });
        // Actualizar checkboxes de empleados de esa letra
        agendaContainer.querySelectorAll(`.emp-row-cb[data-id]`).forEach(rowCb => {
          if (empIds.includes(Number(rowCb.dataset.id))) {
            rowCb.checked = cb.checked;
            rowCb.closest('.agenda-employee-row')?.classList.toggle('agenda-employee-row--selected', cb.checked);
          }
        });
        updateSelectionUI();
      });
    });

    // Sincronizar estado de checkboxes de letra tras render
    syncLetterCheckboxes();
  }

  function buildEmployeeRow(emp) {
    const fullName  = `${emp.nombre} ${emp.apellidos || ''}`.trim();
    const area      = emp.vita?.area   || '—';
    const puesto    = emp.vita?.puesto || '—';
    const isSelected = selected.has(emp.id);

    const row = document.createElement('div');
    row.className = 'agenda-employee-row' + (isSelected ? ' agenda-employee-row--selected' : '');
    row.dataset.empId = emp.id;

    row.innerHTML = `
      <label class="agenda-employee-row__check">
        <input type="checkbox" class="emp-cb emp-row-cb" data-id="${emp.id}" ${isSelected ? 'checked' : ''}>
      </label>
      <div class="agenda-employee-row__info">
        <span class="agenda-employee-row__name">${escapeHtml(fullName)}</span>
        <span class="agenda-employee-row__meta">
          <span class="agenda-employee-row__area">${escapeHtml(area)}</span>
          <span class="agenda-employee-row__sep">·</span>
          <span class="agenda-employee-row__puesto">${escapeHtml(puesto)}</span>
        </span>
      </div>
      <div class="agenda-employee-row__badges">
        ${emp.hasQr
          ? `<span class="badge badge--ok badge--xs" title="QR generado"><svg class="icon"><use href="#icon-qr"/></svg></span>`
          : `<span class="badge badge--warn badge--xs" title="Sin QR"><svg class="icon"><use href="#icon-qr"/></svg></span>`}
        ${emp.hasEmail
          ? `<span class="badge badge--ok badge--xs" title="Tiene correo"><svg class="icon"><use href="#icon-mail"/></svg></span>`
          : `<span class="badge badge--muted badge--xs" title="Sin correo"><svg class="icon"><use href="#icon-mail-off"/></svg></span>`}
      </div>
      <div class="agenda-employee-row__actions">
        <a href="/admin/empleados/${emp.id}/qr-descargar" class="btn btn--ghost btn--sm" title="Descargar QR">
          <svg class="icon"><use href="#icon-qr"/></svg>
        </a>
        <a href="/admin/empleados/${emp.id}" class="btn btn--ghost btn--sm" title="Ver detalle">
          <svg class="icon"><use href="#icon-eye"/></svg>
        </a>
      </div>
    `;

    // Checkbox individual
    const cb = row.querySelector('.emp-row-cb');
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(emp.id);
      else selected.delete(emp.id);
      row.classList.toggle('agenda-employee-row--selected', cb.checked);
      updateSelectionUI();
      syncLetterCheckboxes();
    });

    return row;
  }

  /* ──────────────────────────────────────
     Selección
  ────────────────────────────────────── */
  function updateSelectionUI() {
    const count = selected.size;
    const label = count === 1 ? '1 empleado seleccionado' : `${count} empleados seleccionados`;

    if (selectedCount) selectedCount.textContent = label;
    if (actionBarInfo) actionBarInfo.textContent = label;

    if (actionBar) {
      if (count > 0) actionBar.removeAttribute('hidden');
      else actionBar.setAttribute('hidden', '');
    }

    // Estado del "Seleccionar todos"
    if (selectAll) {
      const visibleIds = filtered.map(e => e.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
      const someSelected = visibleIds.some(id => selected.has(id));
      selectAll.checked = allSelected;
      selectAll.indeterminate = !allSelected && someSelected;
    }
  }

  function syncLetterCheckboxes() {
    agendaContainer.querySelectorAll('.letter-select-all').forEach(cb => {
      const letter = cb.dataset.letter;
      const empIds = filtered
        .filter(e => getLetterKey(e) === letter)
        .map(e => e.id);
      const allSel = empIds.length > 0 && empIds.every(id => selected.has(id));
      const someSel = empIds.some(id => selected.has(id));
      cb.checked = allSel;
      cb.indeterminate = !allSel && someSel;
    });
  }

  /* ──────────────────────────────────────
     Eventos de controles
  ────────────────────────────────────── */

  // Búsqueda con debounce
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value;
      if (searchClear) {
        if (searchTerm) searchClear.removeAttribute('hidden');
        else searchClear.setAttribute('hidden', '');
      }
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(applyFilters, 300);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchTerm = '';
      searchClear.setAttribute('hidden', '');
      applyFilters();
      searchInput.focus();
    });
  }

  // Filtros rápidos
  document.querySelectorAll('.chip--quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const qf = btn.dataset.qf;
      if (quickFilter === qf) {
        quickFilter = null;
        btn.classList.remove('chip--active');
      } else {
        document.querySelectorAll('.chip--quick').forEach(b => b.classList.remove('chip--active'));
        quickFilter = qf;
        btn.classList.add('chip--active');
      }
      applyFilters();
    });
  });

  // Seleccionar todos
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      filtered.forEach(emp => {
        if (selectAll.checked) selected.add(emp.id);
        else selected.delete(emp.id);
      });
      agendaContainer.querySelectorAll('.emp-row-cb').forEach(cb => {
        const id = Number(cb.dataset.id);
        if (filtered.find(e => e.id === id)) {
          cb.checked = selectAll.checked;
          cb.closest('.agenda-employee-row')?.classList.toggle('agenda-employee-row--selected', selectAll.checked);
        }
      });
      syncLetterCheckboxes();
      updateSelectionUI();
    });
  }

  /* ──────────────────────────────────────
     Modal de envío
  ────────────────────────────────────── */
  const backdrop      = document.getElementById('sendModalBackdrop');
  const viewConfirm   = document.getElementById('sendViewConfirm');
  const viewProgress  = document.getElementById('sendViewProgress');
  const viewResults   = document.getElementById('sendViewResults');
  const sendModalDesc = document.getElementById('sendModalDesc');
  const sendModalBreakdown = document.getElementById('sendModalBreakdown');
  const progressFill  = document.getElementById('progressFill');
  const progressLabel = document.getElementById('progressLabel');
  const resultsSummary = document.getElementById('resultsSummary');
  const resultsDetail  = document.getElementById('resultsDetail');
  const resultsTableBody = document.getElementById('resultsTableBody');
  const resultsToggleBtn = document.getElementById('resultsToggleBtn');

  function openModal() {
    const selArr = [...selected];
    const conCorreo  = selArr.filter(id => ALL.find(e => e.id === id)?.hasEmail).length;
    const sinCorreo2 = selArr.length - conCorreo;

    sendModalDesc.textContent = `Se enviará QR a ${conCorreo} empleado${conCorreo !== 1 ? 's' : ''}.`;

    sendModalBreakdown.innerHTML = `
      <div class="emp-modal-badge emp-modal-badge--ok">
        <svg class="icon"><use href="#icon-mail"/></svg>
        ${conCorreo} con correo — se enviarán
      </div>
      ${sinCorreo2 > 0 ? `
      <div class="emp-modal-badge emp-modal-badge--muted">
        <svg class="icon"><use href="#icon-mail-off"/></svg>
        ${sinCorreo2} sin correo — se omitirán
      </div>` : ''}
    `;

    showView('confirm');
    if (progressFill) {
      progressFill.style.width = '0%';
      progressFill.style.background = '';
    }
    backdrop.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.setAttribute('hidden', '');
    document.body.style.overflow = '';
    showView('confirm');
  }

  function showView(v) {
    viewConfirm.hidden  = v !== 'confirm';
    viewProgress.hidden = v !== 'progress';
    viewResults.hidden  = v !== 'results';
  }

  function openPrintSheet(ids, format = 'pdf') {
    const qrSizeIn = '2.5';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/admin/empleados/imprimir-qr-hoja';
    // Keep navigation in the same tab to avoid popup blockers.
    form.target = '_self';
    form.style.display = 'none';

    const idsInput = document.createElement('input');
    idsInput.type = 'hidden';
    idsInput.name = 'ids';
    idsInput.value = ids.join(',');
    form.appendChild(idsInput);

    const sizeInput = document.createElement('input');
    sizeInput.type = 'hidden';
    sizeInput.name = 'qrSizeIn';
    sizeInput.value = qrSizeIn;
    form.appendChild(sizeInput);

    const formatInput = document.createElement('input');
    formatInput.type = 'hidden';
    formatInput.name = 'format';
    formatInput.value = format === 'pdf' ? 'pdf' : 'html';
    form.appendChild(formatInput);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  if (sendQrBtn) sendQrBtn.addEventListener('click', openModal);
  if (qrSheetBtn) {
    qrSheetBtn.addEventListener('click', () => {
      const ids = [...selected];
      if (!ids.length) return;
      openPrintSheet(ids, 'pdf');
    });
  }

  document.getElementById('sendModalClose')?.addEventListener('click', closeModal);
  document.getElementById('cancelSendBtn')?.addEventListener('click', closeModal);
  document.getElementById('resultsModalClose')?.addEventListener('click', closeModal);
  document.getElementById('closeResultsBtn')?.addEventListener('click', closeModal);

  backdrop?.addEventListener('click', e => {
    if (e.target === backdrop) closeModal();
  });

  document.getElementById('confirmSendBtn')?.addEventListener('click', async () => {
    const ids = [...selected];
    if (!ids.length) return;

    const queue = ids
      .map(id => ALL.find(e => e.id === id))
      .filter(Boolean)
      .map(e => `${e.nombre} ${e.apellidos || ''}`.trim());
    const total = queue.length;

    showView('progress');
    progressFill.style.width = '5%';
    progressFill.style.background = '';
    progressLabel.textContent = total
      ? `Iniciando envío para ${total} empleado${total !== 1 ? 's' : ''}…`
      : 'Conectando con el servidor…';

    // Simular avance visual mientras el servidor procesa secuencialmente.
    const startedAt = Date.now();
    const perEmployeeMs = 1600;
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const estimatedIndex = Math.min(
        Math.floor(elapsed / perEmployeeMs),
        Math.max(total - 1, 0),
      );
      const progressBase = total ? ((estimatedIndex + 0.5) / total) * 85 : 0;
      const pct = Math.min(5 + progressBase, 90);

      progressFill.style.width = pct + '%';

      if (total) {
        const currentName = queue[estimatedIndex] || 'empleado';
        progressLabel.textContent =
          `Enviando a ${currentName}… (${Math.min(estimatedIndex + 1, total)}/${total})`;
      } else {
        progressLabel.textContent = `Enviando… (${Math.round(pct)}%)`;
      }
    }, 300);

    try {
      const res = await fetch('/admin/empleados/enviar-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      clearInterval(ticker);
      progressFill.style.width = '100%';

      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);
      const data = await res.json();
      progressLabel.textContent =
        `Completado: ${data?.totales?.enviados || 0} enviados, ${data?.totales?.fallidos || 0} fallidos, ${data?.totales?.sinCorreo || 0} sin correo.`;

      await new Promise(r => setTimeout(r, 400));
      showResults(data);
    } catch (err) {
      clearInterval(ticker);
      progressFill.style.width = '100%';
      progressFill.style.background = '#ef4444';
      progressLabel.textContent = `Error: ${err.message}`;
      await new Promise(r => setTimeout(r, 2000));
      closeModal();
    }
  });

  function showResults(data) {
    const { totales, resultados } = data;

    resultsSummary.innerHTML = `
      <div class="emp-results-totals">
        <div class="emp-result-stat emp-result-stat--ok">
          <span class="emp-result-stat__num">${totales.enviados}</span>
          <span class="emp-result-stat__lbl">Enviados</span>
        </div>
        <div class="emp-result-stat emp-result-stat--fail">
          <span class="emp-result-stat__num">${totales.fallidos}</span>
          <span class="emp-result-stat__lbl">Fallidos</span>
        </div>
        <div class="emp-result-stat emp-result-stat--muted">
          <span class="emp-result-stat__num">${totales.sinCorreo}</span>
          <span class="emp-result-stat__lbl">Sin correo</span>
        </div>
      </div>
    `;

    // Tabla de detalle
    resultsTableBody.innerHTML = resultados.map(r => `
      <tr>
        <td>${escapeHtml(r.nombre)}</td>
        <td class="td-mono">${r.email ? escapeHtml(r.email) : '<span class="text-muted">—</span>'}</td>
        <td>
          ${r.status === 'enviado'
            ? '<span class="badge badge--ok">Enviado</span>'
            : r.status === 'sin_correo'
            ? '<span class="badge badge--muted">Sin correo</span>'
            : `<span class="badge badge--danger" title="${escapeHtml(r.error || '')}">Fallido</span>`}
        </td>
      </tr>
    `).join('');

    if (resultsToggleBtn) {
      resultsToggleBtn.onclick = () => {
        const show = resultsDetail.hidden;
        resultsDetail.hidden = !show;
        resultsToggleBtn.textContent = show ? 'Ocultar detalle' : 'Ver detalle';
      };
    }

    showView('results');
  }

  /* ──────────────────────────────────────
     Util
  ────────────────────────────────────── */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────
     Init
  ────────────────────────────────────── */
  buildHeaderSummary();
  buildAreaChips();
  applyFilters();

})();
