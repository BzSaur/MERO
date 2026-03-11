(function () {
  // ============================================================
  // USER MENU
  // ============================================================
  function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) {
      menu.classList.toggle('show');
    }
  }

  // ============================================================
  // LOGOUT CON SWEETALERT
  // ============================================================
  function handleLogout(event) {
    event.preventDefault();

    const logoutBtn = event.currentTarget;
    const href = logoutBtn.getAttribute('href') || '/auth/logout';

    // Fallback si SweetAlert2 no cargó
    if (typeof Swal === 'undefined') {
      const ok = confirm('¿Está seguro de cerrar sesión?');
      if (ok) {
        alert('Sesión cerrada');
        window.location.href = href;
      }
      return;
    }

    Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Está seguro de cerrar sesión?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'mero-swal mero-swal--light',
        confirmButton: 'btn btn--success',
        cancelButton: 'btn btn--danger',
      },
    }).then((result) => {
      if (!result.isConfirmed) return;

      Swal.fire({
        title: 'Sesión cerrada',
        text: 'Has cerrado sesión correctamente.',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: {
          popup: 'mero-swal mero-swal--light',
        },
      }).then(() => {
        window.location.href = href;
      });
    });
  }

  // ============================================================
  // SIDEBAR
  // ============================================================
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');

    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
  }

  document.addEventListener('DOMContentLoaded', function () {
    // SIEMPRE iniciar cerrado
    document.body.classList.add('sidebar-collapsed');
    localStorage.setItem('sidebarState', 'collapsed');

    // Botón hamburguesa
    const sidebarToggle =
      document.getElementById('sidebarToggle') ||
      document.getElementById('navbarSidebarToggle');

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidebar();
      });
    }

    // Overlay del sidebar
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarState', 'collapsed');
      });
    }

    // Botón cerrar sidebar
    const sidebarClose = document.getElementById('sidebarClose');
    if (sidebarClose) {
      sidebarClose.addEventListener('click', function () {
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarState', 'collapsed');
      });
    }

    // Cerrar sidebar en móvil al navegar
    if (window.innerWidth <= 768) {
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach((link) => {
        link.addEventListener('click', function () {
          document.body.classList.add('sidebar-collapsed');
          localStorage.setItem('sidebarState', 'collapsed');
        });
      });
    }

    // Botón del menú de usuario
    const userDropdownToggle =
      document.getElementById('userDropdownToggle') ||
      document.querySelector('.user-dropdown-toggle') ||
      document.getElementById('userDropdown');

    if (userDropdownToggle) {
      userDropdownToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleUserMenu();
      });
    }

    // Botón logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  });

  // Cerrar menú usuario al hacer clic fuera
  document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('userDropdown');
    const menu = document.getElementById('userMenu');

    if (dropdown && menu && !dropdown.contains(event.target) && menu.classList.contains('show')) {
      menu.classList.remove('show');
    }
  });
})();