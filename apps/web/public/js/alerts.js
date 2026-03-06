(() => {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  const hasSwal = typeof window !== 'undefined'
    && window.Swal
    && typeof window.Swal.fire === 'function';

  // ─────────────────────────────────────────────
  // Flash -> SweetAlert2
  // ─────────────────────────────────────────────
  const flashEls = Array.from(document.querySelectorAll('.flash'));
  const errMsgs = flashEls
    .filter(f => f.classList.contains('flash--error'))
    .map(f => f.textContent.trim())
    .filter(Boolean);

  const okMsgs = flashEls
    .filter(f => f.classList.contains('flash--success'))
    .map(f => f.textContent.trim())
    .filter(Boolean);

  const hideFlashList = () => {
    const flashList = document.querySelector('.flash-list');
    if (flashList) flashList.style.display = 'none';
  };

  if ((errMsgs.length || okMsgs.length) && hasSwal) {
    const joinedOk = okMsgs.join(' ').toLowerCase();
    let okTitle = 'Listo';
    if (joinedOk.includes('cread')) okTitle = 'Creado';
    else if (joinedOk.includes('elimin')) okTitle = 'Eliminado';
    else if (joinedOk.includes('actualiz') || joinedOk.includes('guard')) okTitle = 'Cambios guardados';

    if (errMsgs.length) {
      window.Swal.fire({
        icon: 'error',
        title: 'Revisa los datos',
        html: `<ul style="text-align:left; margin:0; padding-left:1.1rem">
                ${errMsgs.map(m => `<li>${esc(m)}</li>`).join('')}
              </ul>`,
        confirmButtonText: 'Entendido',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn--primary' }
      });
      hideFlashList();
    } else if (okMsgs.length) {
      window.Swal.fire({
        icon: 'success',
        title: okTitle,
        text: okMsgs.length === 1 ? okMsgs[0] : 'Operación completada.',
        confirmButtonText: 'OK',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn--primary' }
      });
      hideFlashList();
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const postUrlEncoded = async (url, dataObj) => {
    const body = new URLSearchParams();
    Object.entries(dataObj).forEach(([k, v]) => body.set(k, v ?? ''));
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Requested-With': 'fetch'
      },
      body
    });
  };

  // ─────────────────────────────────────────────
  // Confirmación Eliminar (genérico por tipo)
  // ─────────────────────────────────────────────
  const delForms = Array.from(document.querySelectorAll('form[data-confirm-delete]'));
  delForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed === '1') return;
      e.preventDefault();

      const kind = (form.getAttribute('data-kind') || '').trim();

      const htmlByKind = () => {
        if (kind === 'modelo') {
          const nombre = form.getAttribute('data-nombre') || '—';
          const descripcion = form.getAttribute('data-descripcion') || '—';
          return `
            <div style="text-align:center">
              <p style="margin:.25rem 0 .5rem">Se eliminará permanentemente:</p>
              <div style="display:inline-block; text-align:left; padding:.6rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
                <div><strong>Nombre:</strong> ${esc(nombre)}</div>
                <div style="margin-top:.25rem"><strong>Descripción:</strong> ${esc(descripcion)}</div>
              </div>
              <p style="margin:.65rem 0 0; opacity:.85">Esta acción no se puede deshacer.</p>
            </div>`;
        }

        if (kind === 'subtarea') {
          const area = form.getAttribute('data-area') || '—';
          const nombre = form.getAttribute('data-nombre') || '—';
          const descripcion = form.getAttribute('data-descripcion') || '—';
          return `
            <div style="text-align:center">
              <p style="margin:.25rem 0 .5rem">Se eliminará permanentemente:</p>
              <div style="display:inline-block; text-align:left; padding:.6rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
                <div><strong>Área:</strong> ${esc(area)}</div>
                <div style="margin-top:.25rem"><strong>Subtarea:</strong> ${esc(nombre)}</div>
                <div style="margin-top:.25rem"><strong>Descripción:</strong> ${esc(descripcion)}</div>
              </div>
              <p style="margin:.65rem 0 0; opacity:.85">Esta acción no se puede deshacer.</p>
            </div>`;
        }

        if (kind === 'estandar') {
          const subtarea = form.getAttribute('data-subtarea') || '—';
          const modelo = form.getAttribute('data-modelo') || '—';
          const cantidad = form.getAttribute('data-cantidad') || '—';
          const vigente = form.getAttribute('data-vigente') || '—';
          return `
            <div style="text-align:center">
              <p style="margin:.25rem 0 .5rem">Se eliminará permanentemente:</p>
              <div style="display:inline-block; text-align:left; padding:.6rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
                <div><strong>Subtarea:</strong> ${esc(subtarea)}</div>
                <div style="margin-top:.25rem"><strong>Modelo:</strong> ${esc(modelo)}</div>
                <div style="margin-top:.25rem"><strong>Unid/h:</strong> ${esc(cantidad)}</div>
                <div style="margin-top:.25rem"><strong>Vigente:</strong> ${esc(vigente)}</div>
              </div>
              <p style="margin:.65rem 0 0; opacity:.85">Esta acción no se puede deshacer.</p>
            </div>`;
        }

        // Áreas (por compatibilidad)
        const nombre = form.getAttribute('data-area-nombre') || form.getAttribute('data-nombre') || '—';
        const descripcion = form.getAttribute('data-area-descripcion') || form.getAttribute('data-descripcion') || '—';
        return `
          <div style="text-align:center">
            <p style="margin:.25rem 0 .5rem">Se eliminará permanentemente:</p>
            <div style="display:inline-block; text-align:left; padding:.6rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
              <div><strong>Nombre:</strong> ${esc(nombre)}</div>
              <div style="margin-top:.25rem"><strong>Descripción:</strong> ${esc(descripcion)}</div>
            </div>
            <p style="margin:.65rem 0 0; opacity:.85">Esta acción no se puede deshacer.</p>
          </div>`;
      };

      if (!hasSwal) {
        const ok = window.confirm('¿Eliminar permanentemente? Esta acción no se puede deshacer.');
        if (ok) { form.dataset.confirmed = '1'; form.submit(); }
        return;
      }

      window.Swal.fire({
        icon: 'warning',
        title: '¿Eliminar permanentemente?',
        html: htmlByKind(),
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
          confirmButton: 'btn btn--danger',
          cancelButton: 'btn btn--ghost'
        }
      }).then((r) => {
        if (!r.isConfirmed) return;
        form.dataset.confirmed = '1';
        form.submit();
      });
    });
  });

  // ─────────────────────────────────────────────
  // Editar (genérico por tipo)
  // ─────────────────────────────────────────────
  const editBtns = Array.from(document.querySelectorAll('[data-edit-kind]'));
  editBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = (btn.getAttribute('data-edit-kind') || '').trim();
      const action = btn.getAttribute('data-update-action');
      const id = btn.getAttribute('data-id');

      if (!action) return;

      const old = {
        area: (btn.getAttribute('data-area') || '').trim(),
        subtarea: (btn.getAttribute('data-subtarea') || '').trim(),
        modelo: (btn.getAttribute('data-modelo') || '').trim(),
        nombre: (btn.getAttribute('data-nombre') || '').trim(),
        descripcion: (btn.getAttribute('data-descripcion') || '').trim(),
        cantidad: (btn.getAttribute('data-cantidad') || '').trim(),
        vigente: (btn.getAttribute('data-vigente') || '').trim(),
        vigenteMx: (btn.getAttribute('data-vigente-mx') || '').trim(),
      };

      if (!hasSwal) return;

      // Panel por tipo
      const panelHtml = () => {
        if (kind === 'estandar') {
          return `
            <div style="text-align:left">
              <div style="margin:0 0 .45rem; opacity:.85">
                <div><strong>Subtarea:</strong> ${esc(old.subtarea)}</div>
                <div><strong>Modelo:</strong> ${esc(old.modelo)}</div>
              </div>

              <label style="display:block; font-weight:800; margin:.6rem 0 .35rem">Unidades / hora</label>
              <input id="swCantidad" type="number" min="1" class="swal2-input" style="margin:0; height:44px" value="${esc(old.cantidad)}" />

              <label style="display:block; font-weight:800; margin:.9rem 0 .35rem">Vigente desde</label>
              <input id="swVigente" type="date" class="swal2-input" style="margin:0; height:44px" value="${esc(old.vigente)}" />
            </div>`;
        }

        // modelo / subtarea / area: nombre + descripcion
        const extra = (kind === 'subtarea')
          ? `<div style="margin:0 0 .45rem; opacity:.85"><strong>Área:</strong> ${esc(old.area)}</div>`
          : '';

        return `
          <div style="text-align:left">
            ${extra}
            <label style="display:block; font-weight:800; margin:.25rem 0 .35rem">Nombre</label>
            <input id="swNombre" class="swal2-input" style="margin:0; height:44px" value="${esc(old.nombre)}" />

            <label style="display:block; font-weight:800; margin:.9rem 0 .35rem">Descripción</label>
            <input id="swDesc" class="swal2-input" style="margin:0; height:44px" value="${esc(old.descripcion)}" />
          </div>`;
      };

      const r1 = await window.Swal.fire({
        icon: 'info',
        title: (kind === 'estandar') ? 'Editar estándar' :
               (kind === 'modelo') ? 'Editar modelo' :
               (kind === 'subtarea') ? 'Editar subtarea' : 'Editar',
        html: panelHtml(),
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        focusCancel: true,
        reverseButtons: true,
        buttonsStyling: false,
        customClass: {
          confirmButton: 'btn btn--success',
          cancelButton: 'btn btn--danger'
        },
        preConfirm: () => {
          if (kind === 'estandar') {
            const cantidad = document.getElementById('swCantidad')?.value?.trim() || '';
            const vigente = document.getElementById('swVigente')?.value?.trim() || '';
            if (!cantidad || Number(cantidad) < 1) {
              window.Swal.showValidationMessage('Unidades/h debe ser mayor a 0.');
              return false;
            }
            if (!vigente) {
              window.Swal.showValidationMessage('La fecha es obligatoria.');
              return false;
            }
            return { cantidad, vigente };
          }

          const nombre = document.getElementById('swNombre')?.value?.trim() || '';
          const descripcion = document.getElementById('swDesc')?.value?.trim() || '';
          if (!nombre) {
            window.Swal.showValidationMessage('El nombre es obligatorio.');
            return false;
          }
          return { nombre, descripcion };
        }
      });

      if (!r1.isConfirmed) return;

      // Datos nuevos
      const next = (kind === 'estandar')
        ? { cantidad: r1.value.cantidad, vigente: r1.value.vigente }
        : { nombre: r1.value.nombre, descripcion: r1.value.descripcion };

      // Confirmación Antes/Después
      const beforeAfterHtml = () => {
        if (kind === 'estandar') {
          return `
            <div style="text-align:left">
              <div style="padding:.65rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
                <div style="font-weight:900; margin-bottom:.35rem">Antes</div>
                <div><strong>Subtarea:</strong> ${esc(old.subtarea)}</div>
                <div style="margin-top:.25rem"><strong>Modelo:</strong> ${esc(old.modelo)}</div>
                <div style="margin-top:.25rem"><strong>Unid/h:</strong> ${esc(old.cantidad)}</div>
                <div style="margin-top:.25rem"><strong>Vigente:</strong> ${esc(old.vigenteMx || old.vigente || '—')}</div>
              </div>

              <div style="height:10px"></div>

              <div style="padding:.65rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
                <div style="font-weight:900; margin-bottom:.35rem">Después</div>
                <div><strong>Subtarea:</strong> ${esc(old.subtarea)}</div>
                <div style="margin-top:.25rem"><strong>Modelo:</strong> ${esc(old.modelo)}</div>
                <div style="margin-top:.25rem"><strong>Unid/h:</strong> ${esc(next.cantidad)}</div>
                <div style="margin-top:.25rem"><strong>Vigente:</strong> ${esc(next.vigente)}</div>
              </div>
            </div>`;
        }

        const extra = (kind === 'subtarea')
          ? `<div style="margin-bottom:.35rem"><strong>Área:</strong> ${esc(old.area)}</div>`
          : '';

        return `
          <div style="text-align:left">
            <div style="padding:.65rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
              <div style="font-weight:900; margin-bottom:.35rem">Antes</div>
              ${extra}
              <div><strong>Nombre:</strong> ${esc(old.nombre || '—')}</div>
              <div style="margin-top:.25rem"><strong>Descripción:</strong> ${esc(old.descripcion || '—')}</div>
            </div>

            <div style="height:10px"></div>

            <div style="padding:.65rem .8rem; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#fff">
              <div style="font-weight:900; margin-bottom:.35rem">Después</div>
              ${extra}
              <div><strong>Nombre:</strong> ${esc(next.nombre || '—')}</div>
              <div style="margin-top:.25rem"><strong>Descripción:</strong> ${esc(next.descripcion || '—')}</div>
            </div>
          </div>`;
      };

      const r2 = await window.Swal.fire({
        icon: 'warning',
        title: 'Confirmar cambios',
        html: beforeAfterHtml(),
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar cambios',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
          confirmButton: 'btn btn--success',
          cancelButton: 'btn btn--danger'
        }
      });

      if (!r2.isConfirmed) return;

      try {
        const payload = { id, ...next };
        const res = await postUrlEncoded(action, payload);
        if (!res.ok) throw new Error('HTTP ' + res.status);

        await window.Swal.fire({
          icon: 'success',
          title: 'Cambio aceptado',
          text: 'Los datos fueron actualizados correctamente.',
          confirmButtonText: 'OK',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn--success' }
        });

        window.location.reload();
      } catch (err) {
        window.Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Ocurrió un error al guardar los cambios.',
          confirmButtonText: 'Entendido',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn--primary' }
        });
      }
    });
  });

// ─────────────────────────────────────────────
  // Confirmación de envío de formularios NUEVO USUARIO EDITAR 
  // ─────────────────────────────────────────────

  const submitForms = Array.from(document.querySelectorAll('form[data-confirm-submit]'));

  submitForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      if (form.dataset.confirmed === '1') return;

      e.preventDefault();

      const title = form.getAttribute('data-confirm-title') || '¿Confirmar acción?';
      const text = form.getAttribute('data-confirm-text') || 'Se enviará la información capturada.';
      const confirmText = form.getAttribute('data-confirm-button') || 'Sí, continuar';

      if (!hasSwal) {
        const ok = window.confirm(text);
        if (ok) {
          form.dataset.confirmed = '1';
          form.submit();
        }
        return;
      }

      const r = await window.Swal.fire({
        icon: 'question',
        title,
        text,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true,
        buttonsStyling: false,
        customClass: {
          confirmButton: 'btn btn--create',
          cancelButton: 'btn btn--ghost'
        }
      });

      if (!r.isConfirmed) return;

      form.dataset.confirmed = '1';
      form.submit();
    });
  });

})();



  