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

  function getCookie(name) {
    const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }

  function showWelcomeAlert() {
    const welcomeName = getCookie('mero_welcome');
    if (!welcomeName || typeof Swal === 'undefined') return;

    deleteCookie('mero_welcome');

    Swal.fire({
      title: 'Bienvenido',
      text: `Hola, ${welcomeName}. Has iniciado sesión correctamente.`,
      icon: 'success',
      timer: 1600,
      showConfirmButton: false,
      buttonsStyling: false,
      customClass: {
        popup: 'mero-swal mero-swal--light',
      },
    });
  }

  // ============================================================
  // LOGOUT CON SWEETALERT
  // ============================================================
  function handleLogout(event) {
    event.preventDefault();

    const logoutBtn = event.currentTarget;
    const href = logoutBtn.getAttribute('href') || '/auth/logout';

    if (typeof Swal === 'undefined') {
      const ok = confirm('¿Seguro que quieres salir?');
      if (ok) {
        window.location.href = href;
      }
      return;
    }

    Swal.fire({
      title: '¿Seguro que quieres salir?',
      text: 'Se cerrará tu sesión actual.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
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
      window.location.href = href;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Bienvenida al iniciar sesión
    showWelcomeAlert();

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