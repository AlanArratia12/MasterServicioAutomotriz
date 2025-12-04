// src/public/js/ajustes.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);

  const form  = $("#form-user");
  const tbody = document.querySelector("table.table tbody");

  // Modal cambiar contraseña (Bootstrap)
  const modalEl   = $("#modalPass");
  const passId    = $("#pass-user-id");
  const passNew   = $("#pass-new");
  const passConf  = $("#pass-confirm");
  const passError = $("#pass-error");
  const btnSave   = $("#btn-save-pass");

  let modal = null;
  if (modalEl && window.bootstrap) {
    modal = new bootstrap.Modal(modalEl);
  }

  // Construir una fila de usuario para la tabla
  function crearFila(usuario) {
    const tr = document.createElement("tr");
    tr.dataset.id = usuario.id;

    tr.innerHTML = `
      <td>${usuario.id}</td>
      <td>${usuario.nombre}</td>
      <td>${usuario.username}</td>
      <td>
        <select class="form-select form-select-sm sel-role">
          <option value="admin" ${usuario.role === "admin" ? "selected" : ""}>Admin</option>
          <option value="capturista" ${usuario.role === "capturista" ? "selected" : ""}>Capturista</option>
          <option value="empleado" ${usuario.role === "empleado" ? "selected" : ""}>Empleado</option>
          <option value="consulta" ${usuario.role === "consulta" ? "selected" : ""}>Consulta</option>
        </select>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary btn-pass">Cambiar pass</button>
        <button class="btn btn-sm btn-outline-danger ms-2 btn-del">Eliminar</button>
      </td>
    `;

    return tr;
  }

  // ==============================
  //   CREAR NUEVO USUARIO
  // ==============================
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre   = form.nombre?.value.trim();
    const username = form.username?.value.trim();
    const password = form.password?.value.trim();
    const role     = form.role?.value.trim();

    if (!nombre || !username || !password || !role) {
      alert("Todos los campos son obligatorios.");
      return;
    }

    try {
      const res = await fetch("/ajustes/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ nombre, username, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error al crear usuario.");
        return;
      }

      if (tbody && data.usuario) {
        tbody.appendChild(crearFila(data.usuario));
      }

      form.reset();
      alert("Usuario creado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error de red al crear usuario.");
    }
  });

  // ==============================
  //   CAMBIAR ROL DESDE LA TABLA
  // ==============================
  tbody?.addEventListener("change", async (e) => {
    const sel = e.target.closest(".sel-role");
    if (!sel) return;

    const tr = sel.closest("tr");
    const id = tr?.dataset.id;
    const role = sel.value;

    if (!id) return;

    try {
      const res = await fetch(`/ajustes/usuarios/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo actualizar el rol.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al actualizar el rol.");
    }
  });

  // ==============================
  //   BOTONES ELIMINAR / CAMBIAR PASS
  // ==============================
  tbody?.addEventListener("click", async (e) => {
    const btnDel  = e.target.closest(".btn-del");
    const btnPass = e.target.closest(".btn-pass");
    const tr      = e.target.closest("tr");
    const id      = tr?.dataset.id;

    if (!id) return;

    // Eliminar usuario
    if (btnDel) {
      if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

      try {
        const res  = await fetch(`/ajustes/usuarios/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "No se pudo eliminar el usuario.");
          return;
        }
        tr.remove();
      } catch (err) {
        console.error(err);
        alert("Error de red al eliminar usuario.");
      }
    }

    // Abrir modal cambiar contraseña
    if (btnPass) {
      passId.value = id;
      passNew.value = "";
      passConf.value = "";
      passError.classList.add("d-none");
      passError.textContent = "";
      if (modal) modal.show();
    }
  });

  // ==============================
  //   GUARDAR NUEVA CONTRASEÑA
  // ==============================
  btnSave?.addEventListener("click", async () => {
    const id = passId.value.trim();
    const p1 = passNew.value.trim();
    const p2 = passConf.value.trim();

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

    try {
      const res = await fetch(`/ajustes/usuarios/${id}/pass`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: p1 }),
      });

      const data = await res.json();
      if (!res.ok) {
        passError.textContent = data.error || "Error al actualizar la contraseña.";
        passError.classList.remove("d-none");
        return;
      }

      alert("Contraseña actualizada correctamente.");
      if (modal) modal.hide();
    } catch (err) {
      console.error(err);
      passError.textContent = err.message || "Error al actualizar la contraseña.";
      passError.classList.remove("d-none");
    }
  });
})();
