// src/public/js/recepcion.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const form      = $("#form-recepcion");
  const btnClear  = $("#btn-limpiar");
  const tbody     = $("#tabla-lista");
  const msg       = $("#msg-orden");
  const tpl       = $("#tpl-fila");

  const cardLista = $("#card-lista-hoy");
  const btnFull   = $("#btn-fullscreen-hoy");

  // Tabla de pendientes
  const tbodyPendientes = $("#tbody-pendientes");

  const CAM = new Map(); 

  const ESTADOS = [
    "Recibido",
    "Diagnóstico",
    "En espera de refacciones",
    "Reparación",
    "Listo",
    "Entregado",
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
        for (const f of filesOrBlobs) {
          fd.append("fotos", f, f.name || `foto-${Date.now()}.jpg`);
        }
        const res = await fetch(`/api/ordenes/${ordenId}/fotos`, {
          method: "POST",
          body: fd,
        });
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

  function autoText(r) {
    const anio  = (r.anio ?? "").toString();
    const color = r.color || "";
    return `${r.marca || ""} ${r.modelo || ""} ${anio} — ${color}`.trim();
  }

  function mapEstatus(id) {
    const num = Number(id);
    if (!isNaN(num) && num > 0) {
      const m = {
        1: "Recibido",
        2: "Diagnóstico",
        3: "En espera de refacciones",
        4: "Reparación",
        5: "Listo",
        6: "Entregado",
      };
      return m[num] || "Recibido";
    }
    return id || "Recibido";
  }

  // LOGICA DE ESTILOS (Colores Hexadecimales Directos)
  function getEstatusStyles(id) {
    let s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" }; // Azul (Recibido)

    const num = Number(id);
    const text = String(id).toLowerCase();

    if ((!isNaN(num) && num === 1) || text.includes("recibido")) {
      s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" }; // Azul
    } else if ((!isNaN(num) && [2, 3, 4].includes(num)) || text.match(/diagn|espera|repara/)) {
      s = { bg: "#fef3c7", fg: "#78350f", br: "#fde68a" }; // Ámbar/Naranja
    } else if ((!isNaN(num) && num === 5) || text.includes("listo")) {
      s = { bg: "#dcfce7", fg: "#14532d", br: "#bbf7d0" }; // Verde
    } else if ((!isNaN(num) && num === 6) || text.includes("entregado")) {
      s = { bg: "#f3f4f6", fg: "#111827", br: "#d1d5db" }; // Gris
    }

    return s;
  }

  // Helper para crear el badge visualmente (usado en lista y en detalles)
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

  function fill(el, text) {
    if (el) el.textContent = text ?? "";
  }

  // Fecha de ingreso: evita el problema de que se recorra un día
  function getFechaTexto(r) {
    const raw =
      r.fecha_ingreso || r.created_at || r.fecha || r.fechaIngreso;
    if (!raw) return "-";

    const str = String(raw);

    // Si viene como 2025-12-04T00:00:00.000Z → tomamos solo la parte de fecha
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, y, mo, d] = m;
      return `${d}/${mo}/${y}`; // 04/12/2025
    }

    // Fallback por si viene en otro formato
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    return str.slice(0, 16);
  }

  // ========= PINTAR LISTA PRINCIPAL =========
  function renderLista(rows) {
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!rows?.length) {
      renderPendientes([]);
      return;
    }

    rows.forEach((r, idx) => {
      const frag = tpl.content.cloneNode(true);

      fill(frag.querySelector(".slot-idx"), String(idx + 1));
      fill(frag.querySelector(".slot-cliente"), r.cliente || "");
      fill(frag.querySelector(".slot-auto"), autoText(r));
      fill(frag.querySelector(".slot-falla"), r.falla || "");

      // Estado en la fila principal
      const estadoSlot = frag.querySelector(".slot-estado");
      if (estadoSlot) {
        estadoSlot.textContent = "";
        const texto = mapEstatus(r.id_estatus);
        estadoSlot.appendChild(
          createBadgeElement(texto, r.id_estatus || texto)
        );
      }

      frag
        .querySelectorAll("[data-id='__ID__']")
        .forEach((n) => n.setAttribute("data-id", r.id_orden));
      const det = frag.querySelector(".details");
      det?.setAttribute("data-id", r.id_orden);

      fill(frag.querySelector(".slot-det-cliente"), r.cliente || "");
      fill(frag.querySelector(".slot-det-tel1"), r.telefono1 || "");
      fill(frag.querySelector(".slot-det-tel2"), r.telefono2 || "-");
      fill(frag.querySelector(".slot-det-marca"), r.marca || "");
      fill(frag.querySelector(".slot-det-modelo"), r.modelo || "");
      fill(frag.querySelector(".slot-det-anio"), r.anio ?? "");
      fill(frag.querySelector(".slot-det-color"), r.color || "");
      fill(frag.querySelector(".slot-det-vin"), r.VIN || "-");
      fill(frag.querySelector(".slot-det-falla"), r.falla || "");
      fill(frag.querySelector(".slot-det-mecanico"), r.mecanico || "-");

      // Fecha de ingreso en el detalle
      const fechaTxt = getFechaTexto(r);
      fill(frag.querySelector(".slot-det-fecha"), fechaTxt);

      const cobroInput = frag.querySelector(".cobro-input");
      if (cobroInput) {
        cobroInput.value = r.cobro || "";
        cobroInput.dataset.id = r.id_orden;
      }

      const vinInput = frag.querySelector(".vin-input");
      if (vinInput) {
        vinInput.value = r.VIN || "";
        vinInput.dataset.id = r.id_orden;
      }

      const mecInput = frag.querySelector(".mecanico-input");
      if (mecInput) {
        mecInput.value = r.mecanico || "";
        mecInput.dataset.id = r.id_orden;
      }

      // Estado en el detalle
      const detEstadoSlot = frag.querySelector(".details .slot-estado");
      if (detEstadoSlot) {
        detEstadoSlot.textContent = "";
        const texto = mapEstatus(r.id_estatus);
        detEstadoSlot.appendChild(
          createBadgeElement(texto, r.id_estatus || texto)
        );
      }

      const sel = frag.querySelector(".estado-select");
      if (sel) {
        sel.innerHTML = ESTADOS.map(
          (o) =>
            `<option ${
              o === mapEstatus(r.id_estatus) ? "selected" : ""
            }>${o}</option>`
        ).join("");
        sel.dataset.id = r.id_orden;
      }

      tbody.appendChild(frag);
    });

    // También pintar tabla de pendientes
    renderPendientes(rows);
  }

  // ========= PINTAR TABLA PENDIENTES =========
  function renderPendientes(rows) {
    if (!tbodyPendientes) return;
    tbodyPendientes.innerHTML = "";
    if (!rows?.length) return;

    const EST_PEND = [
      "Diagnóstico",
      "En espera de refacciones",
      "Reparación",
      "Listo",
    ];

    let idx = 1;
    rows.forEach((r) => {
      const estTexto = mapEstatus(r.id_estatus);
      if (!EST_PEND.includes(estTexto)) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx++}</td>
        <td>${r.cliente || ""}</td>
        <td><strong>${autoText(r)}</strong></td>
        <td>${r.falla || ""}</td>
        <td class="td-estado"></td>
        <td class="actions-row">
          <button class="btn secondary btn-sm pend-mas-info" data-id="${r.id_orden}">Más info</button>
          <button class="btn btn-danger btn-sm ms-2 pend-borrar" data-id="${r.id_orden}">Borrar</button>
        </td>
      `;

      const tdEstado = tr.querySelector(".td-estado");
      tdEstado.appendChild(
        createBadgeElement(estTexto, r.id_estatus || estTexto)
      );

      tbodyPendientes.appendChild(tr);
    });
  }

  async function cargarHoy() {
    try {
      const rows = await API.hoy();
      renderLista(rows);
    } catch (e) {
      console.error("Error cargando /api/ordenes/hoy:", e);
      setMsg("No se pudo cargar la lista de hoy", false);
      renderPendientes([]);
    }
  }

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
      fotos.forEach((f) => {
        const card = document.createElement("div");
        card.className = "foto-item";
        card.style.display = "inline-block";
        card.style.margin = "6px";
        card.style.position = "relative";

        const img = document.createElement("img");
        const ruta = String(f.ruta_archivo || "");
        const src = /^https?:\/\//i.test(ruta)
          ? ruta
          : "/" + ruta.replace(/^\/+/, "");
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
      grid.innerHTML =
        "<div class='small text-danger'>Error al cargar fotos.</div>";
    }
  }

  // ====== FORMULARIO ======
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const fd = new FormData(form);
      await API.crear(fd);
      setMsg("Orden creada correctamente");
      form.reset();
      $("#clienteNombre")?.focus();
      await cargarHoy();
    } catch (err) {
      console.error("Error creando orden:", err);
      setMsg(err.message || "No se pudo crear la orden", false);
    }
  });

  btnClear?.addEventListener("click", () => {
    form?.reset();
    $("#clienteNombre")?.focus();
  });

  // ====== INTERACCIÓN EN TABLA PRINCIPAL ======
  tbody?.addEventListener("click", async (e) => {
    const btnToggle  = e.target.closest(".toggle-detalle");
    const btnGuardar = e.target.closest(".guardar-cambios");
    const btnDelFoto = e.target.closest(".del-foto");
    const btnBorrar  = e.target.closest(".borrar");
    const btnCamOn   = e.target.closest(".cam-abrir");
    const btnShot    = e.target.closest(".cam-foto");
    const btnCancel  = e.target.closest(".cam-cancel");

    if (btnToggle) {
      const id = btnToggle.dataset.id;
      const trPrincipal = btnToggle.closest("tr");
      const trDetalle   = trPrincipal.nextElementSibling;

      const panel = trDetalle?.querySelector(".details");
      if (!panel || !trDetalle) return;

      const fallaTxt  = trPrincipal.querySelector(".slot-falla")?.textContent || "";
      const fallaSpan = panel.querySelector(".slot-det-falla");
      if (fallaSpan) fallaSpan.textContent = fallaTxt;

      const hidden = trDetalle.hasAttribute("hidden") || trDetalle.style.display === "none";
      if (hidden) {
        trDetalle.removeAttribute("hidden");
        trDetalle.style.display = "table-row";
        panel.removeAttribute("hidden");
        btnToggle.textContent = "Menos info";
        if (!CAM.has(id)) CAM.set(id, { stream:null, captures:[] });
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

    if (btnCamOn) {
      const id = btnCamOn.dataset.id;
      const v = $(`video.cam-preview[data-id="${id}"]`);
      const shotBtn = $(`.cam-foto[data-id="${id}"]`);
      const cancelBtn = $(`.cam-cancel[data-id="${id}"]`);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        v.srcObject = stream;
        v.style.display = "block";
        if (shotBtn) shotBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        btnCamOn.disabled = true;

        const S = CAM.get(id) || { stream:null, captures:[] };
        if (S.stream) S.stream.getTracks().forEach(t => t.stop());
        S.stream = stream; CAM.set(id, S);
      } catch (err) {
        console.error(err);
        alert("No se pudo abrir la cámara");
      }
      return;
    }

    if (btnShot) {
      const id = btnShot.dataset.id;
      const v = $(`video.cam-preview[data-id="${id}"]`);
      if (!v?.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type:"image/jpeg" });
        const S = CAM.get(id) || { stream:null, captures:[] };
        S.captures.push(file); CAM.set(id, S);
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

    if (btnGuardar) {
      const id    = btnGuardar.dataset.id;
      const panel = $(`.details[data-id="${id}"]`);
      const sel        = panel?.querySelector(".estado-select");
      const vinEl      = panel?.querySelector(".vin-input");
      const cobroEl    = panel?.querySelector(".cobro-input");
      const mecanicoEl = panel?.querySelector(".mecanico-input");

      const fotosInput = panel?.querySelector(`.fotos-input[data-id="${id}"]`);
      const okSpan  = panel?.querySelector(`.save-ok`);
      const errSpan = panel?.querySelector(`.save-err`);

      try {
        const payload = {};
        if (sel?.value) payload.estado = sel.value;
        if (vinEl) payload.vin = (vinEl.value || "").trim();
        if (cobroEl) { payload.cobro = (cobroEl.value || "").trim(); }
        if (mecanicoEl) { payload.mecanico = (mecanicoEl.value || "").trim(); }

        await API.patch(id, payload);

        const S = CAM.get(id) || { captures:[] };
        const bag = [];
        if (fotosInput?.files?.length) bag.push(...fotosInput.files);
        if (S.captures?.length)       bag.push(...S.captures);
        if (bag.length) {
          await API.fotos.upload(id, bag);
          if (fotosInput) fotosInput.value = "";
          S.captures = []; CAM.set(id, S);
          await cargarFotos(id);
        }
        okSpan?.classList.remove("d-none"); errSpan?.classList.add("d-none");
        await cargarHoy(); // recarga lista + pendientes
        setTimeout(() => okSpan?.classList.add("d-none"), 1500);
      } catch (err) {
        console.error("Error guardando:", err);
        okSpan?.classList.add("d-none"); errSpan?.classList.remove("d-none");
        setTimeout(() => errSpan?.classList.add("d-none"), 2000);
      }
      return;
    }

    if (btnDelFoto) {
      const fotoId  = btnDelFoto.dataset.fotoId;
      const grid    = btnDelFoto.closest(".fotos-grid");
      const ordenId = grid?.dataset.id;
      try {
        await API.fotos.remove(fotoId);
        await cargarFotos(ordenId);
      } catch (err) {
        console.error("No se pudo borrar:", err);
      }
      return;
    }

    if (btnBorrar) {
      const id = btnBorrar.dataset.id;
      if (!id) return;
      if (!confirm("¿Seguro borrar esta orden?")) return;
      try {
        await API.delete(id);
        const tr = btnBorrar.closest("tr");
        const next = tr?.nextElementSibling;
        if (next && next.classList.contains("row-details")) next.remove();
        if (tr) tr.remove();
        $$("#tabla-lista > tr:not(.row-details) .slot-idx").forEach(
          (td, i) => (td.textContent = String(i + 1))
        );
        setMsg("Registro borrado.");
        await cargarHoy(); // refresca también pendientes
      } catch (err) {
        console.error(err);
        setMsg(err.message || "No se pudo borrar", false);
      }
      return;
    }
  });

  // Cambio de estado → actualizar badge en detalle
  tbody?.addEventListener("change", (e) => {
    const sel = e.target.closest(".estado-select");
    if (!sel) return;
    const id = sel.dataset.id;
    const detEstadoSlot = $(`.details[data-id="${id}"] .slot-estado`);

    if (detEstadoSlot) {
      detEstadoSlot.textContent = "";
      detEstadoSlot.appendChild(
        createBadgeElement(sel.value, sel.value)
      );
    }
  });

  // ====== INTERACCIÓN EN TABLA PENDIENTES ======
  tbodyPendientes?.addEventListener("click", (e) => {
    const btnInfo = e.target.closest(".pend-mas-info");
    const btnDel  = e.target.closest(".pend-borrar");

    if (btnInfo) {
      const id = btnInfo.dataset.id;
      const btnMain = $(`.toggle-detalle[data-id="${id}"]`);
      if (btnMain) {
        if (btnMain.textContent.trim() === "Más info") {
          btnMain.click();
        }
        btnMain.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (btnDel) {
      const id = btnDel.dataset.id;
      const btnMainDel = $(`#tabla-vehiculos .borrar[data-id="${id}"]`);
      if (btnMainDel) {
        btnMainDel.click(); // reutiliza toda la lógica de borrado y recarga
      }
      return;
    }
  });

  // ====== PANTALLA COMPLETA ======
  function entrarPantallaCompleta() {
    if (!cardLista) return;
    cardLista.dataset.full = "1";
    cardLista.style.position = "fixed";
    cardLista.style.top      = "0";
    cardLista.style.left     = "0";
    cardLista.style.width    = "100vw";
    cardLista.style.height   = "100vh";
    cardLista.style.zIndex   = "99999";
    cardLista.style.background = "#fff";
    cardLista.style.overflowY = "auto";
    cardLista.style.paddingBottom = "250px";
    document.body.style.overflow = "hidden";
    if (btnFull) btnFull.textContent = "⤢ SALIR";
  }

  function salirPantallaCompleta() {
    if (!cardLista) return;
    delete cardLista.dataset.full;
    cardLista.style.position = "";
    cardLista.style.top      = "";
    cardLista.style.left     = "";
    cardLista.style.width    = "";
    cardLista.style.height   = "";
    cardLista.style.zIndex   = "";
    cardLista.style.background = "";
    cardLista.style.overflowY = "";
    cardLista.style.paddingBottom = "";
    document.body.style.overflow = "";
    if (btnFull) btnFull.textContent = "⛶";
  }

  function togglePantallaCompleta() {
    if (!cardLista) return;
    if (cardLista.dataset.full === "1") {
      salirPantallaCompleta();
    } else {
      entrarPantallaCompleta();
    }
  }

  btnFull?.addEventListener("click", togglePantallaCompleta);

  cargarHoy();
})();
