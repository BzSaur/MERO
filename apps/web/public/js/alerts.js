(() => {
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, c => ({
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
    if (joinedOk.includes('cread')) okTitle = 'Usuario creado';
    else if (joinedOk.includes('elimin')) okTitle = 'Usuario eliminado';
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
  // Confirmación Eliminar usuario (SweetAlert2)
  // ─────────────────────────────────────────────
  const delForms = Array.from(document.querySelectorAll('form[data-confirm-delete]'));
  delForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed === '1') return;

      e.preventDefault();

      const name = (form.getAttribute('data-user-name') || 'este usuario').trim();

      if (!hasSwal) {
        const ok = window.confirm(`¿Eliminar permanentemente a "${name}"? Esta acción no se puede deshacer.`);
        if (ok) {
          form.dataset.confirmed = '1';
          form.submit();
        }
        return;
      }

      window.Swal.fire({
        icon: 'warning',
        title: '¿Eliminar usuario permanentemente?',
        html: `
          <div style="text-align:center">
            <p style="margin:.25rem 0 .6rem">
              Se eliminará permanentemente a <strong>${esc(name)}</strong>.
            </p>
            <p style="margin:0; opacity:.85">
              Esta acción no se puede deshacer.
            </p>
          </div>
        `,
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

  // (Tu modal custom sigue funcionando si lo necesitas para /encargado/captura)
})();