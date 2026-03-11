(function () {
  // Toggle menú de usuario
  function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) {
      menu.classList.toggle('show');
    }
  }

  // Logout directo, sin alerta ni confirmación
  function handleLogout(event) {
    event.preventDefault();

    const logoutBtn = event.currentTarget;
    const href = logoutBtn.getAttribute('href') || '/logout';

    window.location.href = href;
  }

  // Toggle del sidebar
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
      document.querySelector('.user-dropdown-toggle');

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