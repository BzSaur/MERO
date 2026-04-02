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

    document.addEventListener('DOMContentLoaded', function () {
  
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