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