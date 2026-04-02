(() => {
  const SwalRef = window.Swal;
  if (!SwalRef) return;

  const SWAL_BASE = {
    buttonsStyling: false,
    reverseButtons: true,
    customClass: {
      confirmButton: 'btn btn--success',
      cancelButton: 'btn btn--danger',
    },
  };

  function fire(options = {}) {
    return SwalRef.fire({
      ...SWAL_BASE,
      ...options,
    });
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
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
    if (kind === 'usuario') return 'Eliminar usuario';
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

    if (kind === 'usuario') {
      return `
        <div style="text-align:left">
          <b>Nombre:</b> ${esc(form.dataset.nombre || '—')}<br>
          <b>Correo:</b> ${esc(form.dataset.descripcion || '—')}
        </div>
      `;
    }

    return '¿Deseas continuar?';
  }

  function getMessagesFromContainer(container) {
    const liMessages = [...container.querySelectorAll('li')]
      .map((li) => normalizeText(li.textContent))
      .filter(Boolean);

    if (liMessages.length) return liMessages;

    const text = normalizeText(container.textContent);
    return text ? [text] : [];
  }

  function inferFlashType(container, text) {
    const classText = [
      container.className || '',
      ...[...container.querySelectorAll('[class]')].map((el) => el.className || ''),
    ].join(' ').toLowerCase();

    const allText = `${classText} ${String(text || '').toLowerCase()}`;

    if (
      allText.includes('success') ||
      allText.includes('exito') ||
      allText.includes('éxito') ||
      allText.includes('creado') ||
      allText.includes('actualizado') ||
      allText.includes('guardado') ||
      allText.includes('eliminado')
    ) {
      return 'success';
    }

    if (
      allText.includes('warning') ||
      allText.includes('warn') ||
      allText.includes('aviso') ||
      allText.includes('atencion') ||
      allText.includes('atención')
    ) {
      return 'warning';
    }

    if (
      allText.includes('question') ||
      allText.includes('info') ||
      allText.includes('email must be an email') ||
      (allText.includes('correo') && allText.includes('válido'))
    ) {
      return 'question';
    }

    return 'error';
  }

  function inferFlashTitle(type, text) {
    const t = String(text || '').toLowerCase();

    if (type === 'success') {
      if (t.includes('usuario') && t.includes('cread')) return 'Usuario creado';
      if (t.includes('elimin')) return 'Usuario eliminado';
      if (t.includes('actualiz') || t.includes('guardad')) return 'Cambios guardados';
      return 'Operación exitosa';
    }

    if (type === 'warning') {
      return 'Atención';
    }

    if (type === 'question') {
      if (t.includes('email must be an email') || (t.includes('correo') && (t.includes('válido') || t.includes('valido')))) {
        return 'Correo inválido';
      }
      return 'Revisa la información';
    }

    if (t.includes('email must be an email') || (t.includes('correo') && (t.includes('válido') || t.includes('valido')))) {
      return 'Correo inválido';
    }

    return 'No se pudo continuar';
  }

  function inferFlashText(type, text) {
    const t = String(text || '').toLowerCase();

    if (t.includes('email must be an email')) {
      return 'El correo debe ser un email válido.';
    }

    if (type === 'success') {
      if (t.includes('usuario') && t.includes('cread')) {
        return 'El usuario fue creado exitosamente.';
      }
      if (t.includes('elimin')) {
        return 'El usuario fue eliminado correctamente.';
      }
      if (t.includes('actualiz') || t.includes('guardad')) {
        return 'Los cambios se guardaron correctamente.';
      }
    }

    return text;
  }

  async function showFlashMessages() {
    const containers = [
      ...document.querySelectorAll('.js-flash-swal-source, .flash, .alert'),
    ];

    if (!containers.length) return;

    const queue = [];
    const seen = new Set();

    containers.forEach((container) => {
      const messages = getMessagesFromContainer(container);
      const type = inferFlashType(container, messages.join(' '));

      messages.forEach((message) => {
        const clean = normalizeText(message);
        if (!clean) return;

        const key = `${type}|${clean}`;
        if (seen.has(key)) return;
        seen.add(key);

        queue.push({
          type,
          text: clean,
        });
      });

      container.hidden = true;
      container.style.display = 'none';
    });

    for (const item of queue) {
      await fire({
        icon: item.type,
        title: inferFlashTitle(item.type, item.text),
        text: inferFlashText(item.type, item.text),
        confirmButtonText: 'Entendido',
        showCancelButton: false,
      });
    }
  }

  document.querySelectorAll('[data-edit-kind]').forEach((button) => {
    button.addEventListener('click', async () => {
      const kind = button.dataset.editKind;
      const action = button.dataset.updateAction;

      const result = await fire({
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

      const r = await fire({
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

  showFlashMessages();
})();