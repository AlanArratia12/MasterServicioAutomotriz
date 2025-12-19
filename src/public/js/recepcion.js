// src/public/js/recepcion.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);

  const form      = $("#form-recepcion");
  const btnClear  = $("#btn-limpiar");
  const msg       = $("#msg-orden");
  const tpl       = $("#tpl-fila");

  const tbodyHoy        = $("#tabla-lista");
  const tbodyPendientes = $("#tbody-pendientes");

  const cardLista    = $("#card-lista-hoy");
  const btnFullLista = $("#btn-fullscreen-hoy");

  const cardPend    = $("#card-pendientes");
  const btnFullPend = $("#btn-fullscreen-pendientes");

  const CAM = new Map();

  const ESTADOS = [
    "Recibido",
    "Diagnóstico",
    "En espera de refacciones",
    "Reparación",
    "Listo",
    "Entregado",
  ];

  // Pendientes incluye Recibido, PERO SOLO si NO es hoy
  const ESTADOS_PEND = [
    "Recibido",
    "Diagnóstico",
    "En espera de refacciones",
    "Reparación",
    "Listo",
  ];

  const API = {
    crear: async (fd) => {
      const res = await fetch("/api/ordenes", { method: "POST", body: fd });
      if (!res.ok) throw await parseError(res);
      return res.json();
    },
    hoy: async () => {
      const res = await fetch("/api/ordenes/hoy");
      if (!res.ok) throw await parseError(res);
      return res.json();
    },
    patch: async (id, body) => {
      const res = await fetch(`/api/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await parseError(res);
      return res.json();
    },
    delete: async (id) => {
      const res = await fetch(`/api/ordenes/${id}`, { method: "DELETE" });
      if (!res.ok) throw await parseError(res);
      try { return await res.json(); } catch { return {}; }
    },
    fotos: {
      list: async (ordenId) => {
        const res = await fetch(`/api/ordenes/${ordenId}/fotos`);
        if (!res.ok) throw await parseError(res);
        return res.json();
      },
      upload: async (ordenId, filesOrBlobs) => {
        const fd = new FormData();
        for (const f of filesOrBlobs) fd.append("fotos", f, f.name || `foto-${Date.now()}.jpg`);
        const res = await fetch(`/api/ordenes/${ordenId}/fotos`, { method: "POST", body: fd });
        if (!res.ok) throw await parseError(res);
        return res.json();
      },
      remove: async (fotoId) => {
        const res = await fetch(`/api/ordenes/fotos/${fotoId}`, { method: "DELETE" });
        if (!res.ok) throw await parseError(res);
        return res.json();
      },
    },
  };

  async function parseError(res) {
    try {
      const data = await res.json();
      return new Error(data?.error || `Error ${res.status}`);
    } catch {
      return new Error(`Error ${res.status}`);
    }
  }

  function setMsg(text, ok = true) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = ok ? "#0a7" : "#c00";
    if (text) setTimeout(() => { msg.textContent = ""; }, 3000);
  }

  function fill(el, text) { if (el) el.value !== undefined ? (el.value = text ?? "") : (el.textContent = text ?? ""); }

  function autoText(r) {
    const anio  = (r.anio ?? "").toString();
    const color = r.color || "";
    return `${r.marca || ""} ${r.modelo || ""} ${anio} — ${color}`.trim();
  }

  function mapEstatus(id) {
    const num = Number(id);
    if (!isNaN(num) && num > 0) {
      const m = { 1:"Recibido", 2:"Diagnóstico", 3:"En espera de refacciones", 4:"Reparación", 5:"Listo", 6:"Entregado" };
      return m[num] || "Recibido";
    }
    return id || "Recibido";
  }

  function getEstatusStyles(id) {
    let s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" };
    const num = Number(id);
    const text = String(id).toLowerCase();
    if ((!isNaN(num) && num === 1) || text.includes("recibido")) {
      s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" };
    } else if ((!isNaN(num) && [2,3,4].includes(num)) || text.match(/diagn|espera|repara/)) {
      s = { bg: "#fef3c7", fg: "#78350f", br: "#fde68a" };
    } else if ((!isNaN(num) && num === 5) || text.includes("listo")) {
      s = { bg: "#dcfce7", fg: "#14532d", br: "#bbf7d0" };
    } else if ((!isNaN(num) && num === 6) || text.includes("entregado")) {
      s = { bg: "#f3f4f6", fg: "#111827", br: "#d1d5db" };
    }
    return s;
  }

  function createBadgeElement(texto, idOTextoOrigen) {
    const estilo = getEstatusStyles(idOTextoOrigen);
    const badge = document.createElement("span");
    badge.textContent = texto;
    badge.style.display = "inline-block";
    badge.style.padding = "5px 12px";
    badge.style.borderRadius = "50px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "800";
    badge.style.textTransform = "uppercase";
    badge.style.whiteSpace = "nowrap";
    badge.style.backgroundColor = estilo.bg;
    badge.style.color = estilo.fg;
    badge.style.border = "1px solid " + estilo.br;
    return badge;
  }

  // ========= TELÉFONO =========
  function soloDigitos(v) { return String(v || "").replace(/\D/g, "").slice(0, 10); }

  function formatTelefono(value) {
    const nums = soloDigitos(value);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0,3)}-${nums.slice(3)}`;
    return `${nums.slice(0,3)}-${nums.slice(3,6)}-${nums.slice(6)}`;
  }

  // Formateo en inputs del formulario principal
  ["#telefono1", "#telefono2"].forEach(sel => {
    const input = document.querySelector(sel);
    if (!input) return;
    input.addEventListener("input", () => { input.value = formatTelefono(input.value); });
  });

  // Formateo en inputs de edición (delegación)
  function onTelefonoEditInput(e) {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains("edit-tel1") || t.classList.contains("edit-tel2")) {
      t.value = formatTelefono(t.value);
    }
  }

  // ========= FECHAS =========
  function getRawFecha(r) {
    return r?.fecha_ingreso || r?.created_at || r?.fecha || r?.fechaIngreso || "";
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayKeyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function dateKeyFromRaw(raw) {
    if (!raw) return "";
    const s = String(raw);

    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    return "";
  }
  function getFechaTexto(r) {
    const raw = getRawFecha(r);
    const key = dateKeyFromRaw(raw);
    if (key) {
      const [y, mo, da] = key.split("-");
      return `${da}/${mo}/${y}`;
    }
    return raw ? String(raw).slice(0, 16) : "-";
  }

  function getTS(r) {
    const key = dateKeyFromRaw(getRawFecha(r));
    if (key) {
      const [y, mo, da] = key.split("-").map(Number);
      return Date.UTC(y, mo - 1, da);
    }
    const id = Number(r?.id_orden || 0);
    return id || 0;
  }

  function sortAsc(rows) {
    return (rows || []).slice().sort((a, b) => {
      const ta = getTS(a), tb = getTS(b);
      if (ta !== tb) return ta - tb;
      const ia = Number(a?.id_orden || 0), ib = Number(b?.id_orden || 0);
      return ia - ib;
    });
  }

  // ✅ Regla: HOY (cualquier estado) siempre en HOY, nunca en pendientes.
  // ✅ Pendientes: NO es hoy y NO entregado y estado en ESTADOS_PEND (incluye Recibido).
  function splitHoyPend(rows) {
    const hoy = [];
    const pend = [];
    const hoyKey = todayKeyLocal();

    (rows || []).forEach(r => {
      const est = mapEstatus(r.id_estatus);
      const key = dateKeyFromRaw(getRawFecha(r));

      if (!key || key === hoyKey) {
        hoy.push(r);
        return;
      }

      if (est !== "Entregado" && ESTADOS_PEND.includes(est)) {
        pend.push(r);
      }
    });

    return { hoy: sortAsc(hoy), pend: sortAsc(pend) };
  }

  // ========= RENDER =========
  function buildFila(r, idx) {
    const frag = tpl.content.cloneNode(true);
    const estTexto = mapEstatus(r.id_estatus);

    fill(frag.querySelector(".slot-idx"), String(idx));
    fill(frag.querySelector(".slot-cliente"), r.cliente || "");
    fill(frag.querySelector(".slot-auto"), autoText(r));
    fill(frag.querySelector(".slot-falla"), r.falla || "");

    const estadoSlot = frag.querySelector(".slot-estado");
    if (estadoSlot) {
      estadoSlot.textContent = "";
      estadoSlot.appendChild(createBadgeElement(estTexto, r.id_estatus || estTexto));
    }

    frag.querySelectorAll("[data-id='__ID__']").forEach(n => n.setAttribute("data-id", r.id_orden));
    const panel = frag.querySelector(".details");
    panel?.setAttribute("data-id", r.id_orden);

    // Fecha
    const spanFecha = frag.querySelector(".slot-det-fecha");
    if (spanFecha) spanFecha.textContent = getFechaTexto(r);

    // VIN
    const vinValor = (r.VIN ?? r.vin ?? "").toString();
    const spanVin = frag.querySelector(".slot-det-vin");
    if (spanVin) spanVin.textContent = vinValor || "-";
    const vinInput = frag.querySelector(".vin-input");
    if (vinInput) { vinInput.value = vinValor || ""; vinInput.dataset.id = r.id_orden; }

    // Seguimiento
    const mecValor = (r.mecanico ?? "").toString();
    const mecInput = frag.querySelector(".mecanico-input");
    if (mecInput) { mecInput.value = mecValor || ""; mecInput.dataset.id = r.id_orden; }

    const cobroValor = (r.cobro ?? "").toString();
    const cobroInput = frag.querySelector(".cobro-input");
    if (cobroInput) { cobroInput.value = cobroValor || ""; cobroInput.dataset.id = r.id_orden; }

    // Estado en detalle
    const detEstadoSlot = frag.querySelector(".details .slot-estado");
    if (detEstadoSlot) {
      detEstadoSlot.textContent = "";
      detEstadoSlot.appendChild(createBadgeElement(estTexto, r.id_estatus || estTexto));
    }

    const sel = frag.querySelector(".estado-select");
    if (sel) {
      sel.innerHTML = ESTADOS.map(o => `<option ${o === estTexto ? "selected" : ""}>${o}</option>`).join("");
      sel.dataset.id = r.id_orden;
    }

    // ✅ Inputs de edición (admin)
    const editCliente = frag.querySelector(".edit-cliente");
    const editTel1    = frag.querySelector(".edit-tel1");
    const editTel2    = frag.querySelector(".edit-tel2");
    const editMarca   = frag.querySelector(".edit-marca");
    const editModelo  = frag.querySelector(".edit-modelo");
    const editAnio    = frag.querySelector(".edit-anio");
    const editColor   = frag.querySelector(".edit-color");
    const editFalla   = frag.querySelector(".edit-falla");

    if (editCliente) editCliente.value = r.cliente || "";
    if (editTel1) editTel1.value = r.telefono1 ? formatTelefono(r.telefono1) : "";
    if (editTel2) editTel2.value = r.telefono2 ? formatTelefono(r.telefono2) : "";
    if (editMarca) editMarca.value = r.marca || "";
    if (editModelo) editModelo.value = r.modelo || "";
    if (editAnio) editAnio.value = (r.anio ?? "").toString();
    if (editColor) editColor.value = r.color || "";
    if (editFalla) editFalla.value = r.falla || "";

    return frag;
  }

  function renderHoy(rows) {
    if (!tbodyHoy) return;
    tbodyHoy.innerHTML = "";
    if (!rows?.length) return;
    rows.forEach((r, i) => tbodyHoy.appendChild(buildFila(r, i + 1)));
  }

  function renderPendientes(rows) {
    if (!tbodyPendientes) return;
    tbodyPendientes.innerHTML = "";
    if (!rows?.length) return;
    rows.forEach((r, i) => tbodyPendientes.appendChild(buildFila(r, i + 1)));
  }

  async function cargarRecepcion() {
    try {
      const rows = await API.hoy();
      const { hoy, pend } = splitHoyPend(rows);
      renderHoy(hoy);
      renderPendientes(pend);
    } catch (e) {
      console.error("Error cargando /api/ordenes/hoy:", e);
      setMsg("No se pudo cargar la recepción", false);
      renderHoy([]);
      renderPendientes([]);
    }
  }

  // ========= FOTOS =========
  async function cargarFotos(ordenId) {
    const grid = $(`.fotos-grid[data-id="${ordenId}"]`);
    if (!grid) return;
    grid.innerHTML = "<div class='small'>Cargando fotos…</div>";
    try {
      const fotos = await API.fotos.list(ordenId);
      if (!fotos.length) {
        grid.innerHTML = "<div class='small'>Sin fotos aún.</div>";
        return;
      }

      const frag = document.createDocumentFragment();
      fotos.forEach(f => {
        const card = document.createElement("div");
        card.className = "foto-item";
        card.style.display = "inline-block";
        card.style.margin = "6px";
        card.style.position = "relative";

        const img = document.createElement("img");
        const ruta = String(f.ruta_archivo || "");
        const src = /^https?:\/\//i.test(ruta) show ? ruta : "/" + ruta.replace(/^\/+/, "");
        img.src = src;
        img.alt = f.nombre_original || "foto";
        img.style.width = "120px";
        img.style.height = "90px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.loading = "lazy";

        const del = document.createElement("button");
        del.className = "btn btn-danger btn-xs del-foto";
        del.textContent = "✕";
        del.dataset.fotoId = f.id;
        del.style.position = "absolute";
        del.style.top = "2px";
        del.style.right = "2px";
        del.style.padding = "2px 6px";

        card.appendChild(img);
        card.appendChild(del);
        frag.appendChild(card);
      });

      grid.innerHTML = "";
      grid.appendChild(frag);
    } catch (e) {
      console.error("No se pudieron cargar fotos:", e);
      grid.innerHTML = "<div class='small text-danger'>Error al cargar fotos.</div>";
    }
  }

  // ========= FORM =========
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    try {
      const fd = new FormData(form);

      // Mandar SOLO dígitos al backend
      const tel1Input = $("#telefono1");
      const tel2Input = $("#telefono2");
      if (tel1Input) fd.set("telefono1", soloDigitos(tel1Input.value));
      if (tel2Input) fd.set("telefono2", soloDigitos(tel2Input.value));

      await API.crear(fd);

      setMsg("Orden creada correctamente");
      form.reset();
      $("#clienteNombre")?.focus();
      await cargarRecepcion();
    } catch (err) {
      console.error("Error creando orden:", err);
      setMsg(err.message || "No se pudo crear la orden", false);
    }
  });

  // Limpiar con confirmación
  btnClear?.addEventListener("click", () => {
    if (!form) return;
    const seguro = confirm("⚠️ ¿Seguro que deseas limpiar el formulario?\n\nLos datos capturados se perderán.");
    if (!seguro) return;
    form.reset();
    $("#clienteNombre")?.focus();
  });

  // ========= INTERACCIONES (HOY y PENDIENTES) =========
  async function handleTableClick(e) {
    const btnToggle  = e.target.closest(".toggle-detalle");
    const btnGuardar = e.target.closest(".guardar-cambios");
    const btnDelFoto = e.target.closest(".del-foto");
    const btnBorrar  = e.target.closest(".borrar");
    const btnEditar  = e.target.closest(".btn-editar");
    const btnCancelarEd = e.target.closest(".btn-cancelar-edicion");

    const btnCamOn   = e.target.closest(".cam-abrir");
    const btnShot    = e.target.closest(".cam-foto");
    const btnCancel  = e.target.closest(".cam-cancel");

    // ====== MÁS INFO ======
    if (btnToggle) {
      const id = btnToggle.dataset.id;
      const trPrincipal = btnToggle.closest("tr");
      const trDetalle   = trPrincipal?.nextElementSibling;
      const panel = trDetalle?.querySelector(".details");
      if (!panel || !trDetalle) return;

      const hidden = trDetalle.hasAttribute("hidden") || trDetalle.style.display === "none";
      if (hidden) {
        trDetalle.removeAttribute("hidden");
        trDetalle.style.display = "table-row";
        panel.removeAttribute("hidden");
        btnToggle.textContent = "Menos info";

        if (!CAM.has(id)) CAM.set(id, { stream: null, captures: [] });
        await cargarFotos(id);
      } else {
        trDetalle.setAttribute("hidden", "");
        trDetalle.style.display = "none";
        panel.setAttribute("hidden", "");
        btnToggle.textContent = "Más info";

        const S = CAM.get(id);
        if (S?.stream) { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
        const v = $(`video.cam-preview[data-id="${id}"]`);
        if (v) { v.srcObject = null; v.style.display = "none"; }
        const shotBtn = $(`.cam-foto[data-id="${id}"]`);
        if (shotBtn) shotBtn.disabled = true;
        const cancelBtn = $(`.cam-cancel[data-id="${id}"]`);
        if (cancelBtn) cancelBtn.disabled = true;
        const camOnBtn = $(`.cam-abrir[data-id="${id}"]`);
        if (camOnBtn) camOnBtn.disabled = false;
      }
      return;
    }

    // ====== EDITAR (habilita inputs) ======
    if (btnEditar) {
      const id = btnEditar.dataset.id;
      const panel = $(`.details[data-id="${id}"]`);
      if (!panel) return;

      panel.dataset.editing = "1";

      const inputs = panel.querySelectorAll(
        ".edit-cliente,.edit-tel1,.edit-tel2,.edit-marca,.edit-modelo,.edit-anio,.edit-color,.edit-falla"
      );

      inputs.forEach(inp => {
        inp.dataset.orig = inp.value ?? "";
        inp.disabled = false;
      });

      const btnCancel = panel.querySelector(".btn-cancelar-edicion");
      if (btnCancel) btnCancel.hidden = false;

      btnEditar.disabled = true;
      return;
    }

    // ====== CANCELAR EDICIÓN ======
    if (btnCancelarEd) {
      const id = btnCancelarEd.dataset.id;
      const panel = $(`.details[data-id="${id}"]`);
      if (!panel) return;

      panel.dataset.editing = "0";

      const inputs = panel.querySelectorAll(
        ".edit-cliente,.edit-tel1,.edit-tel2,.edit-marca,.edit-modelo,.edit-anio,.edit-color,.edit-falla"
      );

      inputs.forEach(inp => {
        inp.value = inp.dataset.orig ?? inp.value ?? "";
        inp.disabled = true;
      });

      const btnEdit = panel.querySelector(".btn-editar");
      if (btnEdit) btnEdit.disabled = false;

      btnCancelarEd.hidden = true;
      return;
    }

    // ====== ABRIR CÁMARA ======
    if (btnCamOn) {
      const id = btnCamOn.dataset.id;
      const v = $(`video.cam-preview[data-id="${id}"]`);
      const shotBtn = $(`.cam-foto[data-id="${id}"]`);
      const cancelBtn = $(`.cam-cancel[data-id="${id}"]`);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (v) { v.srcObject = stream; v.style.display = "block"; }
        if (shotBtn) shotBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        btnCamOn.disabled = true;

        const S = CAM.get(id) || { stream: null, captures: [] };
        if (S.stream) S.stream.getTracks().forEach(t => t.stop());
        S.stream = stream;
        CAM.set(id, S);
      } catch (err) {
        console.error(err);
        alert("No se pudo abrir la cámara");
      }
      return;
    }

    // ====== TOMAR FOTO ======
    if (btnShot) {
      const id = btnShot.dataset.id;
      const v = $(`video.cam-preview[data-id="${id}"]`);
      if (!v?.videoWidth) return;

      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);

      c.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });

        const S = CAM.get(id) || { stream: null, captures: [] };
        S.captures.push(file);
        CAM.set(id, S);

        const grid = $(`.fotos-grid[data-id="${id}"]`);
        if (grid) {
          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          img.style.width = "120px";
          img.style.height = "90px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "8px";
          img.style.margin = "6px";
          grid.appendChild(img);
        }
      }, "image/jpeg", 0.92);
      return;
    }

    // ====== CANCELAR CÁMARA ======
    if (btnCancel) {
      const id = btnCancel.dataset.id;
      const v = $(`video.cam-preview[data-id="${id}"]`);
      const S = CAM.get(id);

      if (S?.stream) {
        S.stream.getTracks().forEach(t => t.stop());
        S.stream = null;
        CAM.set(id, S);
      }

      if (v) {
        v.srcObject = null;
        v.style.display = "none";
      }

      const shotBtn = $(`.cam-foto[data-id="${id}"]`);
      if (shotBtn) shotBtn.disabled = true;

      const camOnBtn = $(`.cam-abrir[data-id="${id}"]`);
      if (camOnBtn) camOnBtn.disabled = false;

      btnCancel.disabled = true;
      return;
    }

    // ====== GUARDAR ======
    if (btnGuardar) {
      const id = btnGuardar.dataset.id;
      const panel = $(`.details[data-id="${id}"]`);
      if (!panel) return;

      const sel = panel.querySelector(".estado-select");
      const vinEl = panel.querySelector(".vin-input");
      const cobroEl = panel.querySelector(".cobro-input");
      const mecanicoEl = panel.querySelector(".mecanico-input");

      // edición (solo si está en modo edición)
      const editing = panel.dataset.editing === "1";
      const editCliente = panel.querySelector(".edit-cliente");
      const editTel1    = panel.querySelector(".edit-tel1");
      const editTel2    = panel.querySelector(".edit-tel2");
      const editMarca   = panel.querySelector(".edit-marca");
      const editModelo  = panel.querySelector(".edit-modelo");
      const editAnio    = panel.querySelector(".edit-anio");
      const editColor   = panel.querySelector(".edit-color");
      const editFalla   = panel.querySelector(".edit-falla");

      const fotosInput = panel.querySelector(`.fotos-input[data-id="${id}"]`);
      const okSpan  = panel.querySelector(".save-ok");
      const errSpan = panel.querySelector(".save-err");

      try {
        const payload = {};

        // siempre
        if (sel?.value) payload.estado = sel.value;
        if (vinEl) payload.vin = (vinEl.value || "").trim();
        if (cobroEl) payload.cobro = (cobroEl.value || "").trim();
        if (mecanicoEl) payload.mecanico = (mecanicoEl.value || "").trim();

        // solo si editar está activo
        if (editing) {
          if (editCliente) payload.clienteNombre = (editCliente.value || "").trim();
          if (editTel1) payload.telefono1 = soloDigitos(editTel1.value);
          if (editTel2) payload.telefono2 = soloDigitos(editTel2.value);
          if (editMarca) payload.marca = (editMarca.value || "").trim();
          if (editModelo) payload.modelo = (editModelo.value || "").trim();
          if (editAnio) payload.anio = (editAnio.value || "").trim();
          if (editColor) payload.color = (editColor.value || "").trim();
          if (editFalla) payload.falla = (editFalla.value || "").trim();
        }

        await API.patch(id, payload);

        // Fotos
        const S = CAM.get(id) || { captures: [] };
        const bag = [];
        if (fotosInput?.files?.length) bag.push(...fotosInput.files);
        if (S.captures?.length) bag.push(...S.captures);

        if (bag.length) {
          await API.fotos.upload(id, bag);
          if (fotosInput) fotosInput.value = "";
          S.captures = [];
          CAM.set(id, S);
          await cargarFotos(id);
        }

        // salir de modo edición (si estaba)
        if (editing) {
          panel.dataset.editing = "0";
          const inputs = panel.querySelectorAll(
            ".edit-cliente,.edit-tel1,.edit-tel2,.edit-marca,.edit-modelo,.edit-anio,.edit-color,.edit-falla"
          );
          inputs.forEach(inp => { inp.disabled = true; });
          const btnEdit = panel.querySelector(".btn-editar");
          const btnCancel = panel.querySelector(".btn-cancelar-edicion");
          if (btnEdit) btnEdit.disabled = false;
          if (btnCancel) btnCancel.hidden = true;
        }

        okSpan?.classList.remove("d-none");
        errSpan?.classList.add("d-none");
        setTimeout(() => okSpan?.classList.add("d-none"), 1500);

        await cargarRecepcion();
      } catch (err) {
        console.error("Error guardando:", err);
        okSpan?.classList.add("d-none");
        errSpan?.classList.remove("d-none");
        setTimeout(() => errSpan?.classList.add("d-none"), 2500);
      }
      return;
    }

    // ====== BORRAR FOTO ======
    if (btnDelFoto) {
      const fotoId = btnDelFoto.dataset.fotoId;
      const grid = btnDelFoto.closest(".fotos-grid");
      const ordenId = grid?.dataset.id;

      try {
        await API.fotos.remove(fotoId);
        if (ordenId) await cargarFotos(ordenId);
      } catch (err) {
        console.error("No se pudo borrar foto:", err);
      }
      return;
    }

    // ====== BORRAR ORDEN ======
    if (btnBorrar) {
      const id = btnBorrar.dataset.id;
      if (!id) return;
      if (!confirm("¿Seguro borrar esta orden?")) return;

      try {
        await API.delete(id);
        setMsg("Registro borrado.");
        await cargarRecepcion();
      } catch (err) {
        console.error("No se pudo borrar:", err);
        setMsg(err.message || "No se pudo borrar", false);
      }
      return;
    }
  }

  // Delegación
  tbodyHoy?.addEventListener("click", handleTableClick);
  tbodyPendientes?.addEventListener("click", handleTableClick);

  // Formateo teléfonos en edición
  tbodyHoy?.addEventListener("input", onTelefonoEditInput);
  tbodyPendientes?.addEventListener("input", onTelefonoEditInput);

  // Change estado → badge en vivo
  function handleChange(e) {
    const sel = e.target.closest(".estado-select");
    if (!sel) return;
    const id = sel.dataset.id;
    const detEstadoSlot = $(`.details[data-id="${id}"] .slot-estado`);
    if (detEstadoSlot) {
      detEstadoSlot.textContent = "";
      detEstadoSlot.appendChild(createBadgeElement(sel.value, sel.value));
    }
  }
  tbodyHoy?.addEventListener("change", handleChange);
  tbodyPendientes?.addEventListener("change", handleChange);

  // ====== Fullscreen ======
  function entrarPantallaCompleta(card, btn) {
    if (!card) return;
    card.dataset.full = "1";
    card.style.position = "fixed";
    card.style.top = "0";
    card.style.left = "0";
    card.style.width = "100vw";
    card.style.height = "100vh";
    card.style.zIndex = "99999";
    card.style.background = "#fff";
    card.style.overflowY = "auto";
    card.style.paddingBottom = "250px";
    document.body.style.overflow = "hidden";
    if (btn) btn.textContent = "⤢ SALIR";
  }

  function salirPantallaCompleta(card, btn) {
    if (!card) return;
    delete card.dataset.full;
    card.style.position = "";
    card.style.top = "";
    card.style.left = "";
    card.style.width = "";
    card.style.height = "";
    card.style.zIndex = "";
    card.style.background = "";
    card.style.overflowY = "";
    card.style.paddingBottom = "";
    document.body.style.overflow = "";
    if (btn) btn.textContent = "⛶";
  }

  function togglePantallaCompleta(card, btn) {
    if (!card) return;
    if (card.dataset.full === "1") salirPantallaCompleta(card, btn);
    else entrarPantallaCompleta(card, btn);
  }

  btnFullLista?.addEventListener("click", () => togglePantallaCompleta(cardLista, btnFullLista));
  btnFullPend?.addEventListener("click", () => togglePantallaCompleta(cardPend, btnFullPend));

  // INICIO
  cargarRecepcion();
})();
