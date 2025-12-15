// src/public/js/recepcion.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const form      = $("#form-recepcion");
  const btnClear  = $("#btn-limpiar");
  const tbody     = $("#tabla-lista");
  const msg       = $("#msg-orden");
  const tpl       = $("#tpl-fila");

  // Cards y botones de pantalla completa
  const cardLista     = $("#card-lista-hoy");
  const btnFullLista  = $("#btn-fullscreen-hoy");
  const cardPend      = $("#card-pendientes");
  const btnFullPend   = $("#btn-fullscreen-pendientes");

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

  // Pendientes (solo si NO es de hoy). Incluye Recibido porque a veces se quedan para el día siguiente.
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

  function getEstatusStyles(id) {
    let s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" }; // Recibido

    const num = Number(id);
    const text = String(id).toLowerCase();

    if ((!isNaN(num) && num === 1) || text.includes("recibido")) {
      s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" };
    } else if ((!isNaN(num) && [2, 3, 4].includes(num)) || text.match(/diagn|espera|repara/)) {
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

  function fill(el, text) {
    if (el) el.textContent = text ?? "";
  }

  // ===== FECHAS (sin desfases por timezone) =====
  function extraerYMD(raw) {
    if (!raw) return null;
    const str = String(raw);
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    const dt = new Date(str);
    if (isNaN(dt.getTime())) return null;
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }

  function esDeHoy(r) {
    const raw = r.fecha_ingreso || r.created_at || r.fecha || r.fechaIngreso;
    const f = extraerYMD(raw);
    if (!f) return false;
    const hoy = new Date();
    return f.y === hoy.getFullYear() && f.m === (hoy.getMonth() + 1) && f.d === hoy.getDate();
  }

  function getFechaTexto(r) {
    const raw = r.fecha_ingreso || r.created_at || r.fecha || r.fechaIngreso;
    const f = extraerYMD(raw);
    if (!f) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(f.d)}/${pad(f.m)}/${f.y}`;
  }

  // HOY: todo lo ingresado hoy (cualquier estado)
  // PEND: NO hoy + estado en Recibido/Diagnóstico/Espera/Reparación/Listo
  function splitHoyPend(rows) {
    const hoy = [];
    const pend = [];
    (rows || []).forEach(r => {
      const est = mapEstatus(r.id_estatus);
      if (esDeHoy(r)) hoy.push(r);
      else if (ESTADOS_PEND.includes(est)) pend.push(r);
    });
    return { hoy, pend };
  }

  // Construye filas usando el mismo template (para HOY y PENDIENTES)
  function buildFila(r, idx) {
    const estTexto = mapEstatus(r.id_estatus);
    const frag = tpl.content.cloneNode(true);

    // VIN puede venir como VIN o vin
    const vinValor = (r.VIN ?? r.vin ?? "").toString();

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
    const det = frag.querySelector(".details");
    det?.setAttribute("data-id", r.id_orden);

    fill(frag.querySelector(".slot-det-cliente"),  r.cliente || "");
    fill(frag.querySelector(".slot-det-tel1"),     r.telefono1 || "");
    fill(frag.querySelector(".slot-det-tel2"),     r.telefono2 || "-");
    fill(frag.querySelector(".slot-det-marca"),    r.marca || "");
    fill(frag.querySelector(".slot-det-modelo"),   r.modelo || "");
    fill(frag.querySelector(".slot-det-anio"),     r.anio ?? "");
    fill(frag.querySelector(".slot-det-color"),    r.color || "");
    fill(frag.querySelector(".slot-det-vin"),      vinValor || "-");
    fill(frag.querySelector(".slot-det-falla"),    r.falla || "");
    fill(frag.querySelector(".slot-det-mecanico"), r.mecanico || "-");
    fill(frag.querySelector(".slot-det-fecha"),    getFechaTexto(r));

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

    // ✅ RELLENAR INPUTS (lo que faltaba)
    const vinInput = frag.querySelector(".vin-input");
    if (vinInput) {
      vinInput.value = vinValor || "";
      vinInput.dataset.id = r.id_orden;
    }

    const cobroInput = frag.querySelector(".cobro-input");
    if (cobroInput) {
      cobroInput.value = r.cobro || "";
      cobroInput.dataset.id = r.id_orden;
    }

    const mecInput = frag.querySelector(".mecanico-input");
    if (mecInput) {
      mecInput.value = r.mecanico || "";
      mecInput.dataset.id = r.id_orden;
    }

    return frag;
  }

  function renderLista(rows) {
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!rows?.length) return;
    rows.forEach((r, i) => tbody.appendChild(buildFila(r, i + 1)));
  }

  function renderPendientes(rows) {
    if (!tbodyPendientes) return;
    tbodyPendientes.innerHTML = "";
    if (!rows?.length) return;
    rows.forEach((r, i) => tbodyPendientes.appendChild(buildFila(r, i + 1)));
  }

  async function cargarHoy() {
    try {
      const rows = await API.hoy();
      const { hoy, pend } = splitHoyPend(rows);
      renderLista(hoy);
      renderPendientes(pend);
    } catch (e) {
      console.error("Error cargando /api/ordenes/hoy:", e);
      setMsg("No se pudo cargar la lista", false);
      renderLista([]);
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
      fotos.forEach(f => {
        const card = document.createElement("div");
        card.className = "foto-item";
        card.style.display = "inline-block";
        card.style.margin = "6px";
        card.style.position = "relative";

        const img = document.createElement("img");
        const ruta = String(f.ruta_archivo || "");
        const src = /^https?:\/\//i.test(ruta) ? ruta : "/" + ruta.replace(/^\/+/, "");
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

  // ====== CLICK COMPARTIDO PARA AMBAS TABLAS (HOY y PENDIENTES) ======
  async function handleTableClick(e) {
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

    // ✅ FIX REAL: al guardar, actualizamos DOM local y solo recargamos si el ESTADO cambia (para mover entre HOY/PEND).
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

      // para saber si cambia de estado y requiere recarga total
      const estadoActualBadge = panel?.querySelector(".slot-estado")?.textContent?.trim() || "";
      const nuevoEstado = sel?.value?.trim() || "";

      try {
        const payload = {};

        if (nuevoEstado) payload.estado = nuevoEstado;

        const vinVal = (vinEl?.value || "").trim();
        const cobroVal = (cobroEl?.value || "").trim();
        const mecVal = (mecanicoEl?.value || "").trim();

        // ✅ NO mandar vacíos (evita borrar valores en BD)
        if (vinVal !== "") payload.vin = vinVal;
        if (cobroVal !== "") payload.cobro = cobroVal;
        if (mecVal !== "") payload.mecanico = mecVal;

        await API.patch(id, payload);

        // Subir fotos si hay
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

        // ✅ ACTUALIZAR DOM LOCAL (esto evita que se vea "en blanco" por /api/ordenes/hoy incompleto)
        const vinSpan = panel.querySelector(".slot-det-vin");
        if (vinSpan) vinSpan.textContent = vinVal || (vinSpan.textContent || "-");

        const mecSpan = panel.querySelector(".slot-det-mecanico");
        if (mecSpan) mecSpan.textContent = mecVal || (mecSpan.textContent || "-");

        const estadoBadge = panel.querySelector(".slot-estado");
        if (estadoBadge && nuevoEstado) {
          estadoBadge.textContent = "";
          estadoBadge.appendChild(createBadgeElement(nuevoEstado, nuevoEstado));
        }

        // También actualizar badge de la fila principal
        const btnRow = document.querySelector(`.toggle-detalle[data-id="${id}"]`);
        const trPrincipal = btnRow?.closest("tr");
        const filaEstadoSlot = trPrincipal?.querySelector(".slot-estado");
        if (filaEstadoSlot && nuevoEstado) {
          filaEstadoSlot.textContent = "";
          filaEstadoSlot.appendChild(createBadgeElement(nuevoEstado, nuevoEstado));
        }

        okSpan?.classList.remove("d-none");
        errSpan?.classList.add("d-none");
        setTimeout(() => okSpan?.classList.add("d-none"), 1500);

        // ✅ Solo recargar si cambió el estado (por si se mueve de HOY a PEND o sale por ENTREGADO)
        if (nuevoEstado && estadoActualBadge && nuevoEstado.toLowerCase() !== estadoActualBadge.toLowerCase()) {
          await cargarHoy();
        }

      } catch (err) {
        console.error("Error guardando:", err);
        okSpan?.classList.add("d-none");
        errSpan?.classList.remove("d-none");
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
        setMsg("Registro borrado.");
        await cargarHoy();
      } catch (err) {
        console.error(err);
        setMsg(err.message || "No se pudo borrar", false);
      }
      return;
    }
  }

  function handleTableChange(e) {
    const sel = e.target.closest(".estado-select");
    if (!sel) return;
    const id = sel.dataset.id;
    const detEstadoSlot = $(`.details[data-id="${id}"] .slot-estado`);
    if (detEstadoSlot) {
      detEstadoSlot.textContent = "";
      detEstadoSlot.appendChild(createBadgeElement(sel.value, sel.value));
    }
  }

  // listeners para ambas tablas
  tbody?.addEventListener("click", handleTableClick);
  tbodyPendientes?.addEventListener("click", handleTableClick);

  tbody?.addEventListener("change", handleTableChange);
  tbodyPendientes?.addEventListener("change", handleTableChange);

  // ====== PANTALLA COMPLETA (HOY y PENDIENTES) ======
  function entrarPantallaCompleta(card, btn) {
    if (!card) return;
    card.dataset.full = "1";
    card.style.position = "fixed";
    card.style.top      = "0";
    card.style.left     = "0";
    card.style.width    = "100vw";
    card.style.height   = "100vh";
    card.style.zIndex   = "99999";
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
    card.style.top      = "";
    card.style.left     = "";
    card.style.width    = "";
    card.style.height   = "";
    card.style.zIndex   = "";
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

  // ====== INICIO ======
  cargarHoy();
})();
