// src/public/js/recepcion.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const form      = $("#form-recepcion");
  const btnClear  = $("#btn-limpiar");
  const msg       = $("#msg-orden");
  const tpl       = $("#tpl-fila");

  // Tabla HOY
  const tbodyHoy = $("#tabla-lista");

  // Card + fullscreen HOY
  const cardLista    = $("#card-lista-hoy");
  const btnFullLista = $("#btn-fullscreen-hoy");

  // Card + fullscreen PENDIENTES
  const cardPend    = $("#card-pendientes");
  const btnFullPend = $("#btn-fullscreen-pendientes");

  // Tabla PENDIENTES
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

  // Pendientes incluye Recibido si NO es hoy
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
    let s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" };
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

  function fill(el, text) { if (el) el.textContent = text ?? ""; }

  // ========= TELÉFONO =========
  function soloDigitos(v) {
    return String(v || "").replace(/\D/g, "").slice(0, 10);
  }

  function formatTelefono(value) {
    const nums = soloDigitos(value);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0,3)}-${nums.slice(3)}`;
    return `${nums.slice(0,3)}-${nums.slice(3,6)}-${nums.slice(6)}`;
  }

  ["#telefono1", "#telefono2"].forEach(sel => {
    const input = document.querySelector(sel);
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = formatTelefono(input.value);
    });
  });

  // ========= FECHAS (ARREGLO DEFINITIVO) =========
  function getRawFecha(r) {
    return r?.fecha_ingreso || r?.created_at || r?.fecha || r?.fechaIngreso || "";
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  // HOY usando fecha LOCAL del navegador (sin timeZone, sin UTC)
  function todayKeyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  // Soporta:
  // - 2025-12-04T...
  // - 2025-12-04 12:34:56
  // - 2025/12/04 ...
  // - 04/12/2025
  // - 04-12-2025
  function dateKeyFromRaw(raw) {
    if (!raw) return "";

    const s = String(raw);

    // YYYY-MM-DD
    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // YYYY/MM/DD
    m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // DD/MM/YYYY
    m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    // DD-MM-YYYY
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
    return id ? id : 0;
  }

  function sortAsc(rows) {
    return (rows || []).slice().sort((a, b) => {
      const ta = getTS(a), tb = getTS(b);
      if (ta !== tb) return ta - tb;
      const ia = Number(a?.id_orden || 0), ib = Number(b?.id_orden || 0);
      return ia - ib;
    });
  }

  // ====== SPLIT HOY vs PENDIENTES ======
  function splitHoyPend(rows) {
    const hoy = [];
    const pend = [];
    const hoyKey = todayKeyLocal();

    (rows || []).forEach(r => {
      const est = mapEstatus(r.id_estatus);
      const key = dateKeyFromRaw(getRawFecha(r));

      // Si NO podemos leer la fecha, lo metemos en HOY (para NO mandarlo a pendientes por error)
      if (!key || key === hoyKey) {
        hoy.push(r);
        return;
      }

      // NO es hoy: Pendientes solo si no está entregado
      if (ESTADOS_PEND.includes(est) && est !== "Entregado") {
        pend.push(r);
      }
    });

    return { hoy: sortAsc(hoy), pend: sortAsc(pend) };
  }

  // ====== Construye fila+detalle desde template ======
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

    fill(frag.querySelector(".slot-det-cliente"), r.cliente || "");
    fill(frag.querySelector(".slot-det-tel1"), r.telefono1 ? formatTelefono(r.telefono1) : "");
    fill(frag.querySelector(".slot-det-tel2"), r.telefono2 ? formatTelefono(r.telefono2) : "-");

    fill(frag.querySelector(".slot-det-marca"), r.marca || "");
    fill(frag.querySelector(".slot-det-modelo"), r.modelo || "");
    fill(frag.querySelector(".slot-det-anio"), r.anio ?? "");
    fill(frag.querySelector(".slot-det-color"), r.color || "");
    fill(frag.querySelector(".slot-det-falla"), r.falla || "");
    fill(frag.querySelector(".slot-det-fecha"), getFechaTexto(r));

    const vinValor = (r.VIN ?? r.vin ?? r.Vin ?? "").toString();
    fill(frag.querySelector(".slot-det-vin"), vinValor || "-");
    const vinInput = frag.querySelector(".vin-input");
    if (vinInput) { vinInput.value = vinValor || ""; vinInput.dataset.id = r.id_orden; }

    const mecValor = (r.mecanico ?? r.mecanico_reparo ?? "").toString();
    fill(frag.querySelector(".slot-det-mecanico"), mecValor || "-");
    const mecInput = frag.querySelector(".mecanico-input");
    if (mecInput) { mecInput.value = mecValor || ""; mecInput.dataset.id = r.id_orden; }

    const cobroValor = (r.cobro ?? "").toString();
    const cobroInput = frag.querySelector(".cobro-input");
    if (cobroInput) { cobroInput.value = cobroValor || ""; cobroInput.dataset.id = r.id_orden; }

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

  // ====== FORM SUBMIT ======
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    try {
      const fd = new FormData(form);

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

  // LIMPIAR con confirmación
  btnClear?.addEventListener("click", () => {
    if (!form) return;
    const seguro = confirm("⚠️ ¿Seguro que deseas limpiar el formulario?\n\nLos datos capturados se perderán.");
    if (!seguro) return;
    form.reset();
    $("#clienteNombre")?.focus();
  });

  // ====== Pantalla completa ======
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

  cargarRecepcion();
})();
