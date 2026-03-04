/**
 * MERO / VITA - JavaScript Principal (Sidebar + UI)
 */
document.addEventListener('DOMContentLoaded', function () {

  // ============================================================
  // SIDEBAR DRAWER
  // ============================================================
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // Soporta ambos IDs (viejo y nuevo)
  const navbarToggle =
    document.getElementById('sidebarToggle') ||
    document.getElementById('navbarSidebarToggle');

  const sidebarClose = document.getElementById('sidebarClose');

  // Start collapsed (drawer hidden)
  if (!document.body.classList.contains('sidebar-collapsed')) {
    document.body.classList.add('sidebar-collapsed');
  }

  function openSidebar() {
    if (sidebar) sidebar.classList.add('show');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('show');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // Toggle button
  if (navbarToggle) {
    navbarToggle.addEventListener('click', function () {
      // si está abierto, cierra; si está cerrado, abre
      const isOpen = sidebar && sidebar.classList.contains('show');
      if (isOpen) closeSidebar();
      else openSidebar();
    });
  }

  // Close button
  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeSidebar);
  }

  // Overlay click
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('show')) {
      closeSidebar();
    }
  });

  // Cierra al pasar a desktop (normalmente ya no ocupas overlay)
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 992) {
      closeSidebar();
    }
  });

  // ============================================================
  // SIDEBAR SUBMENUS
  // ============================================================
  const submenuToggles = document.querySelectorAll('.submenu-toggle');
  submenuToggles.forEach(function (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();

      const parent = this.closest('.nav-item');
      if (!parent) return;

      const submenu = parent.querySelector('.sidebar-submenu');
      const arrow = this.querySelector('.submenu-arrow');

      if (submenu) {
        submenu.classList.toggle('show');
        if (arrow) {
          arrow.style.transform = submenu.classList.contains('show')
            ? 'rotate(180deg)'
            : 'rotate(0deg)';
        }
      }
    });
  });

  // Init open submenu arrows
  document.querySelectorAll('.sidebar-submenu.show').forEach(function (submenu) {
    const arrow = submenu.previousElementSibling
      ? submenu.previousElementSibling.querySelector('.submenu-arrow')
      : null;
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  });

  // Close drawer when clicking a nav link (not submenu toggle)
  document.querySelectorAll('.sidebar-nav a:not(.submenu-toggle)').forEach(function (link) {
    link.addEventListener('click', function () {
      // Solo cerrar en mobile (en desktop no estorba)
      if (window.innerWidth < 992) closeSidebar();
    });
  });

  // ============================================================
  // CONFIRM DELETE
  // ============================================================
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      const message = this.dataset.confirm || '¿Estás seguro de realizar esta acción?';
      if (!confirm(message)) e.preventDefault();
    });
  });

  // ============================================================
  // AUTO-HIDE ALERTS
  // ============================================================
  document.querySelectorAll('.alert-dismissible').forEach(function (alert) {
    setTimeout(function () {
      if (window.bootstrap?.Alert) {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
        if (bsAlert) bsAlert.close();
      }
    }, 5000);
  });

  // ============================================================
  // FORMAT CURRENCY INPUTS
  // ============================================================
  document.querySelectorAll('input[data-currency]').forEach(function (input) {
    input.addEventListener('blur', function () {
      if (this.value) {
        const n = parseFloat(this.value);
        if (!Number.isNaN(n)) this.value = n.toFixed(2);
      }
    });
  });

  // ============================================================
  // TOOLTIPS
  // ============================================================
  const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  if (tooltipList.length > 0 && window.bootstrap?.Tooltip) {
    Array.from(tooltipList).forEach(function (el) {
      new bootstrap.Tooltip(el);
    });
  }

  // ============================================================
  // DATE DEFAULTS
  // ============================================================
  document.querySelectorAll('input[type="date"][data-default-today]').forEach(function (input) {
    if (!input.value) {
      input.value = new Date().toISOString().split('T')[0];
    }
  });

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  document.querySelectorAll('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });

  // ============================================================
  // LOADING STATE FOR SUBMIT BUTTONS
  // ============================================================
  document.querySelectorAll('button[type="submit"]').forEach(function (button) {
    const form = button.closest('form');
    if (!form) return;

    form.addEventListener('submit', function () {
      // evita doble-loading si el form no es válido
      if (form.matches('[data-validate]') && !form.checkValidity()) return;

      button.disabled = true;
      const originalText = button.innerHTML;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

      setTimeout(function () {
        button.disabled = false;
        button.innerHTML = originalText;
      }, 5000);
    });
  });

  // ============================================================
  // SEARCH HIGHLIGHT
  // ============================================================
  const urlParams = new URLSearchParams(window.location.search);
  const searchTerm = urlParams.get('buscar');

  if (searchTerm) {
    const tableBody = document.querySelector('table tbody');
    if (tableBody) {
      const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('(' + safe + ')', 'gi');

      tableBody.querySelectorAll('td').forEach(function (cell) {
        if (cell.querySelector('a, button, input, select')) return;
        if (cell.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
          cell.innerHTML = cell.innerHTML.replace(regex, '<mark>$1</mark>');
        }
      });
    }
  }

});


/* ============================================================*/
(() => {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const KEY = 'mero_theme';
  const apply = (mode) => {
    document.documentElement.dataset.theme = mode; // "dark" | "light"
  };

  const saved = localStorage.getItem(KEY);
  if (saved) {
    apply(saved);
    toggle.checked = saved === 'dark';
  }

  toggle.addEventListener('change', () => {
    const mode = toggle.checked ? 'dark' : 'light';
    apply(mode);
    localStorage.setItem(KEY, mode);
  });
})();