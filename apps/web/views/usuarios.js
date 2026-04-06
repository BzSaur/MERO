//Filtrar por administrador, consultor, encargado, por mas reciente y mas antiguo

(() => {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;

  const roleSel  = document.getElementById('rolFilter');
  const sortSel  = document.getElementById('sortFilter');
  const resetBtn = document.getElementById('resetFilters');
  const countEl  = document.getElementById('usersCount');

  const allRows = Array.from(tbody.querySelectorAll('tr'));

  const getCreated = (tr) => {
    const n = Number(tr.getAttribute('data-created'));
    return Number.isFinite(n) ? n : 0;
  };

  const getRole = (tr) => (tr.getAttribute('data-rol') || '').toUpperCase();

  const applySort = () => {
    const mode = (sortSel?.value || 'NEW').toUpperCase();
    const sorted = [...allRows].sort((a, b) => {
      const da = getCreated(a);
      const db = getCreated(b);
      return mode === 'OLD' ? (da - db) : (db - da);
    });

    // Reinsertar en el DOM en el orden nuevo (sin recrear elementos)
    const frag = document.createDocumentFragment();
    sorted.forEach(tr => frag.appendChild(tr));
    tbody.appendChild(frag);
  };

  const applyFilter = () => {
    const role = (roleSel?.value || 'ALL').toUpperCase();
    let visible = 0;

    allRows.forEach(tr => {
      const r = getRole(tr);
      const ok = (role === 'ALL') || (r === role);
      tr.style.display = ok ? '' : 'none';
      if (ok) visible++;
    });

    if (countEl) countEl.textContent = `${visible} usuarios`;
  };

  const applyAll = () => {
    applySort();
    applyFilter();
  };

  roleSel?.addEventListener('change', applyAll);
  sortSel?.addEventListener('change', applyAll);

  resetBtn?.addEventListener('click', () => {
    if (roleSel) roleSel.value = 'ALL';
    if (sortSel) sortSel.value = 'NEW';
    applyAll();
  });

  // Inicial
  applyAll();
})();