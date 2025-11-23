// src/public/js/ajustes.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);

  const form      = $("#form-user");
  const tbody     = document.querySelector("table.table tbody");

  // Modal cambiar contraseña (Bootstrap)
  const modalEl   = $("#modalPass");
  const passId    = $("#pass-user-id");
  const passNew   = $("#pass-new");
  const passConf  = $("#pass-confirm");
  const passError = $("#pass-error");
  const btnSave   = $("#btn-save-pass");

  let modal = null;
  if (modalEl && window.bootstrap?.Modal) {
    modal = new bootstrap.Modal(modalEl);
  }

  // Helper para llamadas al backend
  async function api(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) {
      try {
        const data = await res.json();
        throw new Error(data?.error || "Error en la solicitud");
      } catch (e) {
        if (e instanceof SyntaxError) {
          // No venía JSON
          throw new Error("Error en la solicitud");
        }
        throw e;
      }
    }
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  /* =========================================================
   *   CREAR USUARIO
   * =======================================================*/
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries()); // {nombre, username, password, rol}

    if (!payload.nombre || !payload.username || !payload.password) {
      alert("Todos los campos son obligatorios.");
      return;
    }
    if (payload.password.length < 4) {
      alert("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    try {
      await api("/ajustes/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",        // 👈 ahora mandamos JSON
        },
        body: JSON.stringify(payload),
      });

      alert("Usuario creado correctamente.");
      // Recargamos para que la tabla se actualice con el nuevo usuario
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al crear usuario.");
    }
  });

  /* =========================================================
   *   ELIMINAR USUARIO
   * =======================================================*/
  tbody?.addEventListener("click", async (e) => {
    const btnDel = e.target.closest(".btn-eliminar");
    const btnPass = e.target.closest(".btn-pass");

    // ---- Eliminar usuario ----
    if (btnDel) {
      const id = btnDel.dataset.id;
      if (!id) return;

      const ok = confirm("¿Seguro que deseas eliminar este usuario?");
      if (!ok) return;

      try {
        await api(`/ajustes/usuarios/${id}`, { method: "DELETE" });
        alert("Usuario eliminado.");
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert(err.message || "Error al eliminar usuario.");
      }
      return;
    }

    // ---- Abrir modal cambiar contraseña ----
    if (btnPass) {
      const id = btnPass.dataset.id;
      const username = btnPass.dataset.username;

      if (!id || !modal) return;

      passId.value = id;
      passNew.value = "";
      passConf.value = "";
      passError.classList.add("d-none");
      passError.textContent = "Las contraseñas no coinciden.";

      // Si quieres mostrar a quién le cambias la pass, puedes usar el username
      modal.show();
      return;
    }
  });

  /* =========================================================
   *   GUARDAR NUEVA CONTRASEÑA
   * =======================================================*/
  btnSave?.addEventListener("click", async () => {
    const id  = passId.value.trim();
    const p1  = passNew.value.trim();
    const p2  = passConf.value.trim();

    if (!id) return;

    if (p1.length < 4) {
      passError.textContent = "La contraseña debe tener al menos 4 caracteres.";
      passError.classList.remove("d-none");
      return;
    }

    if (p1 !== p2) {
      passError.textContent = "Las contraseñas no coinciden.";
      passError.classList.remove("d-none");
      return;
    }

    passError.classList.add("d-none");

    try {
      await api(`/ajustes/usuarios/${id}/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: p1 }),
      });

      alert("Contraseña actualizada correctamente.");
      if (modal) modal.hide();
    } catch (err) {
      console.error(err);
      passError.textContent = err.message || "Error al actualizar la contraseña.";
      passError.classList.remove("d-none");
    }
  });
})();
