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

  form.addEventListener('submit', async (e) => {
    if (form.dataset.submitting === '1') return;

    e.preventDefault();

    const invalid = firstInvalidField(form);
    if (invalid) {
      await showInvalidAlert(invalid);
      return;
    }

    const isEdit = !!form.action.match(/\/admin\/usuarios\/\d+$/);

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