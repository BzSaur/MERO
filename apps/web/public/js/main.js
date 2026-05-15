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

  // Limpieza defensiva al entrar a cada vista
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  if (sidebar) sidebar.classList.remove('show');
  if (sidebarOverlay) sidebarOverlay.classList.remove('show');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('show');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
    // No bloquear body aquí, porque rompe el scroll de la vista
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('show');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

   // ============================================================
  // MOBILE SWIPE FOR SIDEBAR
  // ============================================================
  let touchStartX = 0;
  let touchStartY = 0;
  let startScrollY = 0;
  let isTrackingSwipe = false;
  let isVerticalScroll = false;
  let swipeStartedInsideSidebar = false;

  const MIN_SWIPE = 54;
  const VERTICAL_TOLERANCE = 56;
  const HORIZONTAL_RATIO = 1.15;
  const EDGE_SWIPE_ZONE = 72; // más ancho para que no compita con el gesto del navegador

  function isInteractiveElement(target) {
    return !!target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], .modal, .dropdown-menu'
    );
  }

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  document.addEventListener('touchstart', function (e) {
    if (!e.changedTouches || !e.changedTouches.length) return;
    if (window.innerWidth >= 992) return;

    const touch = e.changedTouches[0];
    const target = e.target;
    const isOpen = sidebar && sidebar.classList.contains('show');

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    startScrollY = getScrollTop();
    isVerticalScroll = false;
    isTrackingSwipe = false;
    swipeStartedInsideSidebar = !!target.closest('#sidebar, #sidebarOverlay');

    // CERRADO: permitir abrir desde una franja izquierda más cómoda
    if (!isOpen) {
      if (touchStartX <= EDGE_SWIPE_ZONE) {
        isTrackingSwipe = true;
      }
      return;
    }

    // ABIERTO: permitir cerrar si el gesto comenzó en el sidebar o en el overlay
    if (swipeStartedInsideSidebar) {
      isTrackingSwipe = true;
      return;
    }

    // Si empezó fuera y sobre un control interactivo, no tomar el gesto
    if (isInteractiveElement(target)) {
      isTrackingSwipe = false;
      return;
    }

    isTrackingSwipe = true;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!isTrackingSwipe || !e.changedTouches || !e.changedTouches.length) return;

    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;

    const diffX = Math.abs(currentX - touchStartX);
    const diffY = Math.abs(currentY - touchStartY);

    // Si claramente va en vertical, soltamos el gesto
    if (diffY > 10 && diffY > diffX * 1.05) {
      isVerticalScroll = true;
      isTrackingSwipe = false;
    }
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!isTrackingSwipe || !e.changedTouches || !e.changedTouches.length) return;
    if (window.innerWidth >= 992) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const absX = Math.abs(diffX);
    const absY = Math.abs(touchEndY - touchStartY);
    const scrollMoved = Math.abs(getScrollTop() - startScrollY);
    const isOpen = sidebar && sidebar.classList.contains('show');

    isTrackingSwipe = false;

    if (isVerticalScroll) return;
    if (scrollMoved > 10) return;
    if (absY > VERTICAL_TOLERANCE) return;
    if (absX < MIN_SWIPE) return;
    if (absX <= absY * HORIZONTAL_RATIO) return;

    // Abrir
    if (!isOpen && diffX > 0) {
      openSidebar();
      return;
    }

    // Cerrar
    if (isOpen && diffX < 0) {
      closeSidebar();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', function () {
    isTrackingSwipe = false;
    isVerticalScroll = false;
    swipeStartedInsideSidebar = false;
  }, { passive: true });

  // ============================================================
  // PULL-TO-REFRESH INDICATOR
  // ============================================================
  (function () {
    const THRESHOLD   = 72;   // px que hay que jalar para activar la recarga
    const MAX_PULL    = 100;  // límite visual de arrastre
    const NAVBAR_H    = 64;   // altura del navbar (--navbar-height)

    // Crear el elemento indicador
    const ptr = document.createElement('div');
    ptr.id = 'ptr-indicator';
    ptr.innerHTML = '<div class="ptr-inner">' +
      '<svg class="ptr-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<span class="ptr-text">Jala para recargar</span>' +
      '</div>';
    document.body.prepend(ptr);

    let ptrStartY    = 0;
    let ptrPulling   = false;
    let ptrTriggered = false;
    let ptrActive    = false;

    function setPull(dist) {
      const clamped = Math.min(dist, MAX_PULL);
      const ratio   = Math.min(clamped / THRESHOLD, 1);
      const ready   = clamped >= THRESHOLD;

      ptr.style.transform = 'translateY(' + clamped + 'px)';
      ptr.style.opacity   = Math.min(ratio * 1.4, 1);
      ptr.querySelector('.ptr-icon').style.transform = 'rotate(' + (ratio * 220) + 'deg)';
      ptr.querySelector('.ptr-text').textContent = ready ? '¡Suelta para recargar!' : 'Jala para recargar';
      ptr.classList.toggle('ptr-ready', ready);
    }

    function resetPull(reload) {
      ptrPulling   = false;
      ptrTriggered = false;
      ptrActive    = false;

      if (reload) {
        ptr.classList.add('ptr-loading');
        ptr.style.transform  = 'translateY(' + THRESHOLD + 'px)';
        ptr.style.opacity    = '1';
        ptr.querySelector('.ptr-text').textContent = 'Recargando…';
        ptr.querySelector('.ptr-icon').style.animation = 'ptr-spin 0.7s linear infinite';
        setTimeout(function() { window.location.reload(); }, 500);
      } else {
        ptr.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        ptr.style.transform  = 'translateY(0)';
        ptr.style.opacity    = '0';
        setTimeout(function() { ptr.style.transition = ''; }, 320);
      }
    }

    document.addEventListener('touchstart', function (e) {
      if (window.innerWidth >= 992) return;
      if (!e.changedTouches.length) return;
      // Solo activar si estamos en la parte superior de la página
      if (window.scrollY > 4) return;
      ptrStartY    = e.changedTouches[0].clientY;
      ptrPulling   = true;
      ptrTriggered = false;
      ptrActive    = false;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!ptrPulling) return;
      if (window.scrollY > 4) { ptrPulling = false; return; }

      const currentY = e.changedTouches[0].clientY;
      const diffY    = currentY - ptrStartY;

      if (diffY <= 0) return;

      ptrActive = true;
      setPull(diffY * 0.45); // factor de resistencia
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!ptrPulling || !ptrActive) { ptrPulling = false; return; }

      const endY = e.changedTouches[0].clientY;
      const dist = (endY - ptrStartY) * 0.45;

      resetPull(dist >= THRESHOLD);
    }, { passive: true });
  })();

  // Toggle button
  if (navbarToggle) {
    navbarToggle.addEventListener('click', function () {
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

  // Cierra al pasar a desktop
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 992) {
      closeSidebar();
    }
  });

  // Limpia estado al restaurar/navegar entre vistas
  window.addEventListener('pageshow', function () {
    closeSidebar();
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
      closeSidebar();
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
      if (window.bootstrap && window.bootstrap.Alert) {
        var bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
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
  if (tooltipList.length > 0 && window.bootstrap && window.bootstrap.Tooltip) {
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

    // Skip forms that handle their own AJAX flow (captura, rechazo, etc.)
    if (form.matches('.js-form-captura, .js-form-rechazo, [data-skip-loading]')) return;

    form.addEventListener('submit', function () {
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
(function() {
  var toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  var KEY = 'mero_theme';
  function applyTheme(mode) {
    document.documentElement.dataset.theme = mode;
  }

  var saved = localStorage.getItem(KEY);
  if (saved) {
    applyTheme(saved);
    toggle.checked = saved === 'dark';
  }

  toggle.addEventListener('change', function() {
    var mode = toggle.checked ? 'dark' : 'light';
    applyTheme(mode);
    localStorage.setItem(KEY, mode);
  });
}());