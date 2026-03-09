(() => {
  const SwalRef = window.Swal;
  if (!SwalRef) return;

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function titleForEdit(kind) {
    if (kind === 'area') return 'Editar área';
    if (kind === 'subtarea') return 'Editar subtarea';
    if (kind === 'modelo') return 'Editar modelo';
    if (kind === 'estandar') return 'Editar estándar';
    return 'Editar';
  }

  function titleForDelete(kind) {
    if (kind === 'area') return 'Eliminar área';
    if (kind === 'subtarea') return 'Eliminar subtarea';
    if (kind === 'modelo') return 'Eliminar modelo';
    if (kind === 'estandar') return 'Eliminar estándar';
    return 'Eliminar';
  }

  function buildEditHtml(button) {
    const kind = button.dataset.editKind;

    if (kind === 'area' || kind === 'subtarea' || kind === 'modelo') {
      return `
        <div style="text-align:left">
          <label style="display:block;margin:0 0 6px;font-weight:600;">Nombre</label>
          <input id="swal-nombre" class="swal2-input" value="${esc(button.dataset.nombre || '')}" placeholder="Nombre">

          <label style="display:block;margin:12px 0 6px;font-weight:600;">Descripción</label>
          <input id="swal-descripcion" class="swal2-input" value="${esc(button.dataset.descripcion || '')}" placeholder="Descripción">
        </div>
      `;
    }

    if (kind === 'estandar') {
      return `
        <div style="text-align:left">
          <label style="display:block;margin:0 0 6px;font-weight:600;">Subtarea</label>
          <input class="swal2-input" value="${esc(button.dataset.subtarea || '')}" disabled>

          <label style="display:block;margin:12px 0 6px;font-weight:600;">Modelo</label>
          <input class="swal2-input" value="${esc(button.dataset.modelo || '')}" disabled>

          <label style="display:block;margin:12px 0 6px;font-weight:600;">Unidades / hora</label>
          <input id="swal-cantidad" type="number" min="1" class="swal2-input" value="${esc(button.dataset.cantidad || '')}" placeholder="Cantidad">

          <label style="display:block;margin:12px 0 6px;font-weight:600;">Vigente desde</label>
          <input id="swal-vigente" type="date" class="swal2-input" value="${esc(button.dataset.vigente || '')}">
        </div>
      `;
    }

    return '';
  }

  function buildDeleteHtml(form) {
    const kind = form.dataset.kind;

    if (kind === 'area' || kind === 'subtarea' || kind === 'modelo') {
      return `
        <div style="text-align:left">
          <b>Nombre:</b> ${esc(form.dataset.nombre || '—')}<br>
          <b>Descripción:</b> ${esc(form.dataset.descripcion || '—')}
        </div>
      `;
    }

    if (kind === 'estandar') {
      return `
        <div style="text-align:left">
          <b>Subtarea:</b> ${esc(form.dataset.subtarea || '—')}<br>
          <b>Modelo:</b> ${esc(form.dataset.modelo || '—')}<br>
          <b>Unid/h:</b> ${esc(form.dataset.cantidad || '—')}<br>
          <b>Vigente desde:</b> ${esc(form.dataset.vigente || '—')}
        </div>
      `;
    }

    return '¿Deseas continuar?';
  }

  document.querySelectorAll('[data-edit-kind]').forEach((button) => {
    button.addEventListener('click', async () => {
      const kind = button.dataset.editKind;
      const action = button.dataset.updateAction;

      const result = await SwalRef.fire({
        title: titleForEdit(kind),
        html: buildEditHtml(button),
        showCancelButton: true,
        confirmButtonText: 'Guardar cambios',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
          if (kind === 'area' || kind === 'subtarea' || kind === 'modelo') {
            const nombre = document.getElementById('swal-nombre')?.value?.trim() || '';
            if (!nombre) {
              SwalRef.showValidationMessage('El nombre es obligatorio');
              return false;
            }
          }

          if (kind === 'estandar') {
            const cantidad = document.getElementById('swal-cantidad')?.value?.trim() || '';
            const vigente = document.getElementById('swal-vigente')?.value?.trim() || '';

            if (!cantidad) {
              SwalRef.showValidationMessage('La cantidad es obligatoria');
              return false;
            }

            if (!vigente) {
              SwalRef.showValidationMessage('La fecha es obligatoria');
              return false;
            }
          }

          return true;
        },
      });

      if (!result.isConfirmed) return;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = action;
      form.style.display = 'none';

      function appendField(name, value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value ?? '';
        form.appendChild(input);
      }

      if (kind === 'area' || kind === 'subtarea' || kind === 'modelo') {
        appendField('nombre', document.getElementById('swal-nombre')?.value?.trim() || '');
        appendField('descripcion', document.getElementById('swal-descripcion')?.value?.trim() || '');
      }

      if (kind === 'estandar') {
        appendField('cantidad', document.getElementById('swal-cantidad')?.value?.trim() || '');
        appendField('vigente', document.getElementById('swal-vigente')?.value?.trim() || '');
      }

      document.body.appendChild(form);
      form.submit();
    });
  });

  document.querySelectorAll('[data-confirm-delete]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const kind = form.dataset.kind || 'registro';

      const r = await SwalRef.fire({
        icon: 'warning',
        title: titleForDelete(kind),
        html: buildDeleteHtml(form),
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      });

      if (!r.isConfirmed) return;

      form.submit();
    });
  });
})();