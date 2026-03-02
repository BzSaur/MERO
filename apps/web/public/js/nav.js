(function () {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", function (e) {
    e.preventDefault();
    const href = logoutBtn.getAttribute("href") || "/logout";

    // Fallback si SweetAlert2 no cargó
    if (typeof Swal === "undefined") {
      const ok = confirm("¿Deseas cerrar sesión?");
      if (ok) {
        alert("Sesión cerrada.");
        window.location.href = href;
      }
      return;
    }

    Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Se cerrará tu sesión actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: "mero-swal mero-swal--light",
        confirmButton: "mero-swal-confirm",
        cancelButton: "mero-swal-cancel",
      },
    }).then((result) => {
      if (!result.isConfirmed) return;

      // ✅ Segunda alerta (éxito) y luego redirect
      Swal.fire({
        title: "Sesión cerrada",
        text: "Has salido correctamente.",
        icon: "success",
        timer: 1100,
        showConfirmButton: false,
        buttonsStyling: false,
        customClass: {
          popup: "mero-swal mero-swal--light",
        },
      }).then(() => {
        window.location.href = href;
      });
    });
  });
})();
  // Función para toggle del menú de usuario
  function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.classList.toggle('show');
  }

  // Función para manejar el logout
  function handleLogout(event) {
    event.preventDefault();
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      window.location.href = '/auth/logout';
    }
  }

  // Cerrar el menú cuando se hace clic fuera
  document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userDropdown');
    const menu = document.getElementById('userMenu');
    
    if (dropdown && menu && !dropdown.contains(event.target) && menu.classList.contains('show')) {
      menu.classList.remove('show');
    }
  });

  // Función para toggle del sidebar
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    
    // Guardar preferencia en localStorage
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }

  // Inicializar el estado del sidebar al cargar la página
  document.addEventListener('DOMContentLoaded', function() {
    // Cargar preferencia del sidebar desde localStorage
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    // Aplicar la clase si es necesario (por defecto viene cerrado)
    if (sidebarCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    }
    
    // Agregar event listener al botón de hamburguesa
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Cerrar sidebar al hacer clic en el overlay (si existe)
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', function() {
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', true);
      });
    }
    
    // Cerrar sidebar con el botón X si existe
    const sidebarClose = document.getElementById('sidebarClose');
    if (sidebarClose) {
      sidebarClose.addEventListener('click', function() {
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', true);
      });
    }
  });

  // Para dispositivos móviles: cerrar sidebar al navegar
  if (window.innerWidth <= 768) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        document.body.classList.add('sidebar-collapsed');
      });
    });
  }

  // Función para toggle del sidebar - VERSIÓN SIMPLIFICADA
  function toggleSidebar() {
    // Alternar clase en el body
    document.body.classList.toggle('sidebar-collapsed');
    
    // Guardar preferencia
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
  }

  // Inicializar al cargar la página
  document.addEventListener('DOMContentLoaded', function() {
    // Por defecto, sidebar cerrado (con clase sidebar-collapsed)
    const savedState = localStorage.getItem('sidebarState');
    
    if (savedState === 'expanded') {
      // Si el usuario lo había expandido antes, lo abrimos
      document.body.classList.remove('sidebar-collapsed');
    } else {
      // Por defecto, siempre cerrado
      document.body.classList.add('sidebar-collapsed');
    }
    
    // Agregar evento al botón de hamburguesa
    const sidebarToggle = document.getElementById('sidebarToggle') || document.getElementById('navbarSidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function(e) {
        e.preventDefault();
        toggleSidebar();
      });
    }
    
    // Cerrar sidebar al hacer clic en overlay (si existe)
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
      overlay.addEventListener('click', function() {
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarState', 'collapsed');
      });
    }
  });

  // Función para toggle del menú de usuario
  function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    if (menu) {
      menu.classList.toggle('show');
    }
  }

  // Función para logout
  function handleLogout(event) {
    event.preventDefault();
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      window.location.href = '/auth/logout';
    }
  }

  // Cerrar menú usuario al hacer clic fuera
  document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userDropdown');
    const menu = document.getElementById('userMenu');
    
    if (dropdown && menu && !dropdown.contains(event.target) && menu.classList.contains('show')) {
      menu.classList.remove('show');
    }
  });
