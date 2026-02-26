(() => {
  const modal = document.getElementById('appModal');
  if (!modal) return;

  const titleEl = document.getElementById('appModalTitle');
  const bodyEl  = document.getElementById('appModalBody');
  const footEl  = document.getElementById('appModalFooter');

  const openModal = ({ title = 'Aviso', bodyHTML = '', actions = [] }) => {
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHTML;

    footEl.innerHTML = '';
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = a.className || 'btn btn--primary';
      btn.textContent = a.label || 'OK';
      btn.addEventListener('click', () => a.onClick && a.onClick());
      footEl.appendChild(btn);
    });

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Focus al primer botón (mejor UX)
    const firstBtn = footEl.querySelector('button');
    if (firstBtn) firstBtn.focus();
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));

  // 1) Si hay flash messages del server, pásalos a modal
  const flashEls = Array.from(document.querySelectorAll('.flash'));
  const errMsgs = flashEls
    .filter(f => f.classList.contains('flash--error'))
    .map(f => f.textContent.trim())
    .filter(Boolean);

  const okMsgs = flashEls
    .filter(f => f.classList.contains('flash--success'))
    .map(f => f.textContent.trim())
    .filter(Boolean);

  if (errMsgs.length) {
    openModal({
      title: 'Revisa los datos',
      bodyHTML: `<ul class="modal__list">${errMsgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`,
      actions: [{ label: 'Entendido', className: 'btn btn--primary', onClick: closeModal }]
    });

    // opcional: ocultar la lista visual del flash para que no se vea duplicado
    const flashList = document.querySelector('.flash-list');
    if (flashList) flashList.style.display = 'none';
  } else if (okMsgs.length) {
    openModal({
      title: 'Listo',
      bodyHTML: `<ul class="modal__list">${okMsgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`,
      actions: [{ label: 'OK', className: 'btn btn--primary', onClick: closeModal }]
    });

    const flashList = document.querySelector('.flash-list');
    if (flashList) flashList.style.display = 'none';
  }

  // 2) Confirmación antes de enviar el form
  const form = document.querySelector('form[action="/encargado/captura"]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    if (form.dataset.confirmed === '1') return; // ya confirmado, deja enviar

    e.preventDefault();

    const asignSel = form.querySelector('#asignacionId');
    const slotSel  = form.querySelector('#slotHora');
    const qtyInp   = form.querySelector('#cantidad');

    const errs = [];
    if (!asignSel?.value) errs.push('Selecciona una asignación activa.');
    if (!slotSel?.value)  errs.push('Selecciona un slot horario.');

    const raw = (qtyInp?.value || '').trim();
    const qty = Number(raw);

    if (raw === '') errs.push('Ingresa la cantidad producida.');
    else if (!Number.isFinite(qty) || !Number.isInteger(qty)) errs.push('La cantidad debe ser un número entero.');
    else if (qty < 0) errs.push('La cantidad no puede ser negativa.');

    if (errs.length) {
      openModal({
        title: 'Faltan datos',
        bodyHTML: `<ul class="modal__list">${errs.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`,
        actions: [{ label: 'OK', className: 'btn btn--primary', onClick: closeModal }]
      });
      return;
    }

    const asignText = asignSel.options[asignSel.selectedIndex]?.text || '';
    const slotText  = slotSel.options[slotSel.selectedIndex]?.text || '';

    openModal({
      title: 'Confirmar captura',
      bodyHTML: `
        <div class="kv">
          <div class="kv__row"><span>Asignación</span><strong>${esc(asignText)}</strong></div>
          <div class="kv__row"><span>Slot</span><strong>${esc(slotText)}</strong></div>
          <div class="kv__row"><span>Cantidad</span><strong>${esc(qty)}</strong></div>
        </div>
        <p class="modal__hint">¿Confirmas que estos datos son correctos?</p>
      `,
      actions: [
        { label: 'Cancelar', className: 'btn btn--ghost', onClick: closeModal },
        {
          label: 'Confirmar',
          className: 'btn btn--primary',
          onClick: () => {
            form.dataset.confirmed = '1';
            closeModal();
            form.submit();
          }
        }
      ]
    });
  });
})();