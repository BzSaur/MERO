(() => {
  const SwalRef = window.Swal;
  if (!SwalRef) return;

  const form = document.getElementById('userForm');
  if (!form) return;

  const pageUsuarios = document.querySelector('.page--usuarios-form');
  if (!pageUsuarios) return;

  const swalBase = {
    buttonsStyling: false,
    reverseButtons: true,
    customClass: {
      confirmButton: 'btn btn--success',
      cancelButton: 'btn btn--danger',
    },
  };

  function fire(options = {}) {
    return SwalRef.fire({
      ...swalBase,
      ...options,
    });
  }

  function firstInvalidField(currentForm) {
    return [...currentForm.querySelectorAll('input, select, textarea')].find((field) => {
      return !field.disabled && field.willValidate && !field.checkValidity();
    }) || null;
  }

  const rolSelect = form.querySelector('#rol');
  const areaSelect = form.querySelector('#areaId');
  const roleScopedBlocks = document.querySelectorAll('[data-role-only]');
  const actividadesSection = document.querySelector('.js-actividades');
  const cambiosInput = document.getElementById('cambiosSubtareas');
  const currentAreaId = actividadesSection
    ? Number(actividadesSection.querySelector('[data-current-area]')?.dataset.currentArea) || null
    : null;

  function applyRoleVisibility() {
    const rol = rolSelect ? rolSelect.value : '';
    roleScopedBlocks.forEach((el) => {
      const allowed = (el.dataset.roleOnly || '').split(',').map((v) => v.trim()).filter(Boolean);
      const visible = allowed.includes(rol);
      el.hidden = !visible;

      el.querySelectorAll('input, select, textarea').forEach((field) => {
        if (!visible) {
          field.dataset.prevRequired = field.required ? '1' : '';
          field.required = false;
          field.disabled = false;
        }
      });
    });

    if (areaSelect) {
      areaSelect.required = rol === 'ENCARGADO';
    }
  }

  function recalcCambios() {
    if (!cambiosInput || !actividadesSection) return;

    if (actividadesSection.hidden) {
      cambiosInput.value = '';
      return;
    }

    const cambios = [];
    const checks = actividadesSection.querySelectorAll('.js-actividad-check');

    checks.forEach((chk) => {
      const subtareaId = Number(chk.dataset.subtareaId);
      const originalArea = Number(chk.dataset.originalArea);
      const item = chk.closest('.js-actividad');
      const moveBox = item ? item.querySelector('.user-form__actividad-move') : null;
      const destSelect = moveBox ? moveBox.querySelector('.js-actividad-destino') : null;

      if (originalArea === currentAreaId) {
        if (!chk.checked) {
          if (moveBox) moveBox.hidden = false;
          if (destSelect) destSelect.required = true;
          const destino = destSelect ? Number(destSelect.value) : NaN;
          if (Number.isInteger(destino) && destino > 0) {
            cambios.push({ subtareaId, nuevaAreaId: destino });
          }
        } else {
          if (moveBox) moveBox.hidden = true;
          if (destSelect) {
            destSelect.required = false;
            destSelect.value = '';
          }
        }
      } else {
        if (chk.checked && currentAreaId) {
          cambios.push({ subtareaId, nuevaAreaId: currentAreaId });
        }
      }
    });

    cambiosInput.value = cambios.length ? JSON.stringify(cambios) : '';
  }

  if (rolSelect) {
    rolSelect.addEventListener('change', () => {
      applyRoleVisibility();
      recalcCambios();
    });
    applyRoleVisibility();
  }

  if (actividadesSection) {
    actividadesSection.addEventListener('change', (ev) => {
      if (ev.target.matches('.js-actividad-check, .js-actividad-destino')) {
        recalcCambios();
      }
    });
    recalcCambios();
  }

  function messageForField(field) {
    const key = field.name || field.id || '';

    if (field.validity.valueMissing) {
      if (key === 'nombre') return 'Debes escribir el nombre completo.';
      if (key === 'email') return 'Debes escribir el correo.';
      if (key === 'password') return 'Debes escribir la contraseña.';
      if (key === 'rol') return 'Debes seleccionar un rol.';
      return 'Completa este campo.';
    }

    if (field.validity.typeMismatch && field.type === 'email') {
      return 'El correo debe ser un email válido.';
    }

    if (field.validity.tooShort && key === 'password') {
      return `La contraseña debe tener al menos ${field.minLength} caracteres.`;
    }

    return field.validationMessage || 'Revisa este campo.';
  }

  async function showInvalidAlert(field) {
    await fire({
      icon: 'question',
      title: 'Revisa el formulario',
      text: messageForField(field),
      confirmButtonText: 'Entendido',
      showCancelButton: false,
    });

    try {
      field.focus();
    } catch (_) {}
  }

  function getFlashMessages() {
    const source =
      document.querySelector('.js-flash-swal-source') ||
      document.querySelector('.flash') ||
      document.querySelector('.alert');

    if (!source) return [];

    const items = [...source.querySelectorAll('li')]
      .map((el) => el.textContent.trim())
      .filter(Boolean);

    if (items.length) {
      source.style.display = 'none';
      return items;
    }

    const text = source.textContent.trim();
    source.style.display = 'none';
    return text ? [text] : [];
  }

  function detectFlashConfig(message) {
    const msg = String(message || '').toLowerCase();

    if (
      msg.includes('creado') ||
      msg.includes('registrado') ||
      msg.includes('usuario creado')
    ) {
      return {
        icon: 'success',
        title: 'Usuario creado',
        text: message,
      };
    }

    if (
      msg.includes('email must be an email') ||
      msg.includes('correo') && msg.includes('válido')
    ) {
      return {
        icon: 'question',
        title: 'Correo inválido',
        text: 'El correo debe ser un email válido.',
      };
    }

    return {
      icon: 'error',
      title: 'No se pudo continuar',
      text: message,
    };
  }

  async function showFlashAsSwal() {
    const messages = getFlashMessages();
    if (!messages.length) return;

    for (const msg of messages) {
      const cfg = detectFlashConfig(msg);
      await fire({
        icon: cfg.icon,
        title: cfg.title,
        text: cfg.text,
        confirmButtonText: 'Entendido',
        showCancelButton: false,
      });
    }
  }

  form.noValidate = true;

  function parseCambios() {
    if (!cambiosInput || !cambiosInput.value) return [];
    try { return JSON.parse(cambiosInput.value); } catch { return []; }
  }

  function buildCambiosHtml(cambios) {
    if (!cambios.length) return '';
    const items = cambios.map((c) => {
      const li = document.querySelector(`.js-actividad[data-subtarea-id="${c.subtareaId}"]`);
      const nombre = li ? li.querySelector('span')?.textContent?.trim() || `Subtarea #${c.subtareaId}` : `Subtarea #${c.subtareaId}`;
      const areaEl = document.querySelector(`#areaId option[value="${c.nuevaAreaId}"]`);
      const destino = areaEl ? areaEl.textContent.trim() : `Área #${c.nuevaAreaId}`;
      return `<li><strong>${nombre}</strong> → ${destino}</li>`;
    });
    return `<ul style="text-align:left;margin:.5rem 0 0;padding-left:1.2rem;font-size:.92rem">${items.join('')}</ul>`;
  }

  form.addEventListener('submit', async (e) => {
    if (form.dataset.submitting === '1') return;

    e.preventDefault();

    const invalid = firstInvalidField(form);
    if (invalid) {
      await showInvalidAlert(invalid);
      return;
    }

    // Validar que subtareas desmarcadas tengan destino seleccionado
    if (actividadesSection && !actividadesSection.hidden) {
      const sinDestino = [...actividadesSection.querySelectorAll('.js-actividad-check')].find((chk) => {
        if (Number(chk.dataset.originalArea) !== currentAreaId) return false;
        if (chk.checked) return false;
        const dest = chk.closest('.js-actividad')?.querySelector('.js-actividad-destino');
        return dest && !dest.value;
      });

      if (sinDestino) {
        const nombre = sinDestino.closest('.js-actividad')?.querySelector('span')?.textContent?.trim() || 'una subtarea';
        await fire({
          icon: 'warning',
          title: 'Falta destino',
          text: `Selecciona a qué área mover "${nombre}" antes de guardar.`,
          confirmButtonText: 'Entendido',
          showCancelButton: false,
        });
        return;
      }
    }

    const isEdit = !!form.action.match(/\/admin\/usuarios\/\d+$/);
    const cambios = parseCambios();

    // Si hay reasignaciones de subtareas, mostrar advertencia primero
    if (cambios.length) {
      const advertencia = await fire({
        icon: 'warning',
        title: `¿Reasignar ${cambios.length} subtarea${cambios.length > 1 ? 's' : ''}?`,
        html: `Esta acción moverá las siguientes subtareas a otra área y quedará registrada en auditoría:${buildCambiosHtml(cambios)}`,
        showCancelButton: true,
        confirmButtonText: 'Sí, reasignar',
        cancelButtonText: 'Cancelar',
      });
      if (!advertencia.isConfirmed) return;
    }

    const result = await fire({
      icon: 'question',
      title: isEdit ? '¿Guardar cambios?' : '¿Crear usuario?',
      text: isEdit
        ? 'Se actualizará la información del usuario.'
        : 'Se registrará el nuevo usuario en el sistema.',
      showCancelButton: true,
      confirmButtonText: isEdit ? 'Sí, guardar' : 'Sí, crear',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    form.dataset.submitting = '1';
    form.submit();
  });

  showFlashAsSwal();
})();