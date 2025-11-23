// src/public/js/historial.js
(() => {
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const tbody = $("#historial-lista");
  const tpl   = $("#tpl-historial");

  // ======== CÁMARA POR ORDEN (mismo patrón que recepcion.js) ========
  const CAM = new Map();

  // ======== CONTROLES DE FILTRO ========
  const inputs = {
    q:       $("#q"),
    estado:  $("#estado"),
    activo:  $("#activo"),
    limit:   $("#limit"),
    marca:   $("#marca"),
    modelo:  $("#modelo"),
    anio:    $("#anio"),
    color:   $("#color"),
    aplicar: $("#btn-aplicar"),
    limpiar: $("#btn-limpiar"),
  };

  // ======== CONTROLES DE PAGINACIÓN ========
  const pagerMeta = $("#historial-meta");
  const pagerNav  = $("#historial-paginacion");

  let currentPage    = 1;
  let totalPages     = 1;
  let totalResults   = 0;
  let perPage        = parseInt(inputs.limit?.value || "200", 10) || 200;

  const ESTADOS = [
    "Recibido",
    "Diagnóstico",
    "En espera de refacciones",
    "Reparación",
    "Listo",
    "Entregado",
  ];

  // Helper simple para obtener el texto del estado
  const estadoLabel = (id) => {
    const idx = (+id || 1) - 1;
    return ESTADOS[idx] || "Recibido";
  };

  const API = {
    historial: async (params) => {
      const qs = new URLSearchParams(params);
      const res = await fetch(`/api/ordenes/historial?${qs.toString()}`);
      if (!res.ok) throw new Error("No se pudo obtener el historial");
      return res.json();
    },
    patch: async (id, body) => {
      const res = await fetch(`/api/ordenes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { msg = (await res.json())?.error || msg; } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    fotos: {
      list: async (ordenId) => {
        const res = await fetch(`/api/ordenes/${ordenId}/fotos`);
        if (!res.ok) throw new Error("No se pudieron listar fotos");
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
        if (!res.ok) throw new Error("No se pudieron subir fotos");
        return res.json();
      },
      remove: async (fotoId) => {
        const res = await fetch(`/api/ordenes/fotos/${fotoId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("No se pudo borrar foto");
        return res.json();
      },
    },
    catalogo: async (campo) => {
      const res = await fetch(`/api/ordenes/catalogo/${campo}`);
      if (!res.ok) throw new Error(`No se pudo obtener catálogo de ${campo}`);
      return res.json();
    },
  };

  // ====== BADGES para estados (misma lógica que recepción) ======
  function getEstatusStyles(id) {
    let s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" }; // Azul

    const num  = Number(id);
    const text = String(id).toLowerCase();

    if ((!isNaN(num) && num === 1) || text.includes("recibido")) {
      s = { bg: "#dbeafe", fg: "#1e3a8a", br: "#bfdbfe" }; // Azul
    } else if ((!isNaN(num) && [2, 3, 4].includes(num)) || text.match(/diagn|espera|repara/)) {
      s = { bg: "#fef3c7", fg: "#78350f", br: "#fde68a" }; // Ámbar
    } else if ((!isNaN(num) && num === 5) || text.includes("listo")) {
      s = { bg: "#dcfce7", fg: "#14532d", br: "#bbf7d0" }; // Verde
    } else if ((!isNaN(num) && num === 6) || text.includes("entregado")) {
      s = { bg: "#f3f4f6", fg: "#111827", br: "#d1d5db" }; // Gris
    }
    return s;
  }

  function createBadgeElement(texto, idOTextoOrigen) {
    const estilo = getEstatusStyles(idOTextoOrigen);
    const badge  = document.createElement("span");
    badge.textContent = texto;

    badge.style.display        = "inline-block";
    badge.style.padding        = "5px 12px";
    badge.style.borderRadius   = "50px";
    badge.style.fontSize       = "12px";
    badge.style.fontWeight     = "800";
    badge.style.textTransform  = "uppercase";
    badge.style.whiteSpace     = "nowrap";
    badge.style.backgroundColor = estilo.bg;
    badge.style.color           = estilo.fg;
    badge.style.border          = "1px solid " + estilo.br;

    return badge;
  }

  const fill = (el, text) => { if (el) el.textContent = text ?? ""; };

  function autoText(r) {
    const anio  = (r.anio ?? "").toString();
    const color = r.color || "";
    return `${r.marca || ""} ${r.modelo || ""} ${anio} — ${color}`.trim();
  }

  // ====== PINTAR TABLA ======
  function renderLista(rows) {
    tbody.innerHTML = "";
    if (!rows || !rows.length) {
      tbody.innerHTML =
        `<tr><td colspan="7" style="text-align:center;">Sin resultados</td></tr>`;
      return;
    }

    const baseIdx = (currentPage - 1) * perPage;

    rows.forEach((r, idx) => {
      const frag = tpl.content.cloneNode(true);

      // Fila principal
      fill(frag.querySelector(".slot-idx"),     String(baseIdx + idx + 1));
      fill(frag.querySelector(".slot-cliente"), r.cliente || "");
      fill(frag.querySelector(".slot-auto"),    autoText(r));
      fill(frag.querySelector(".slot-falla"),   r.falla || "");

      const estadoSlot = frag.querySelector(".slot-estado");
      if (estadoSlot) {
        estadoSlot.innerHTML = "";
        const texto = estadoLabel(r.id_estatus);
        estadoSlot.appendChild(createBadgeElement(texto, r.id_estatus || texto));
      }

      fill(
        frag.querySelector(".slot-ingreso"),
        `${r.fecha_ingreso || ""} ${r.hora || ""}`.trim()
      );

      // IDs para vincular fila y detalle
      frag
        .querySelectorAll("[data-id='__ID__']")
        .forEach((n) => n.setAttribute("data-id", r.id_orden));
      frag.querySelector(".details")?.setAttribute("data-id", r.id_orden);

      // Detalle: cliente
      fill(frag.querySelector(".slot-det-cliente"), r.cliente || "");
      fill(frag.querySelector(".slot-det-tel1"), r.telefono1 || "");
      fill(frag.querySelector(".slot-det-tel2"), r.telefono2 || "-");

      // Detalle: vehículo + VIN
      fill(frag.querySelector(".slot-det-marca"), r.marca || "");
      fill(frag.querySelector(".slot-det-modelo"), r.modelo || "");
      fill(frag.querySelector(".slot-det-anio"), r.anio ?? "");
      fill(frag.querySelector(".slot-det-color"), r.color || "");
      fill(frag.querySelector(".slot-det-vin"), r.VIN || "-");

      fill(frag.querySelector(".slot-det-falla"), r.falla || "");

      const detEstadoSlot = frag.querySelector(".details .slot-estado");
      if (detEstadoSlot) {
        detEstadoSlot.innerHTML = "";
        const texto = estadoLabel(r.id_estatus);
        detEstadoSlot.appendChild(createBadgeElement(texto, r.id_estatus || texto));
      }

      // Inputs dinámicos
      const vinInput = frag.querySelector(".vin-input");
      if (vinInput) {
        vinInput.value = r.VIN || "";
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

      // Select de estado
      const sel = frag.querySelector(".estado-select");
      if (sel) {
        sel.innerHTML = ESTADOS.map((o) =>
          `<option ${o === estadoLabel(r.id_estatus) ? "selected" : ""}>${o}</option>`
        ).join("");
        sel.dataset.id = r.id_orden;
      }

      tbody.appendChild(frag);
    });
  }

  // ====== PAGINACIÓN: pintar barra de páginas ======
  function renderPaginacion() {
    if (!pagerMeta || !pagerNav) return;

    if (!totalResults) {
      pagerMeta.textContent = "Sin resultados";
      pagerNav.innerHTML = "";
      return;
    }

    const start = (currentPage - 1) * perPage + 1;
    const end   = Math.min(currentPage * perPage, totalResults);

    pagerMeta.textContent =
      `Mostrando ${start}–${end} de ${totalResults} resultados · ` +
      `Página ${currentPage} de ${totalPages}`;

    // Si solo hay una página, no tiene caso mostrar botones
    if (totalPages <= 1) {
      pagerNav.innerHTML = "";
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "pagination-list";

    const createBtn = (label, page, disabled = false, active = false) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = "page-link";
      if (active) btn.classList.add("active");
      if (disabled) {
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.dataset.page = String(page);
      }
      li.appendChild(btn);
      return li;
    };

    // Botón Anterior
    ul.appendChild(
      createBtn("« Anterior", currentPage - 1, currentPage <= 1, false)
    );

    // Números de página (simple)
    for (let p = 1; p <= totalPages; p++) {
      ul.appendChild(createBtn(String(p), p, false, p === currentPage));
    }

    // Botón Siguiente
    ul.appendChild(
      createBtn("Siguiente »", currentPage + 1, currentPage >= totalPages, false)
    );

    pagerNav.innerHTML = "";
    pagerNav.appendChild(ul);
  }

  // Click en paginación
  pagerNav?.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-link");
    if (!btn || btn.disabled || !btn.dataset.page) return;
    const p = parseInt(btn.dataset.page, 10);
    if (Number.isNaN(p) || p === currentPage) return;
    currentPage = p;
    cargar();
  });

  // ====== FOTOS: Cargar desde la BD ======
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

  // =========================================
  // EVENTOS EN TABLA
  // =========================================
  tbody?.addEventListener("click", async (e) => {
    const btn        = e.target.closest(".toggle-detalle");
    const btnGuardar = e.target.closest(".guardar-cambios");
    const btnDelFoto = e.target.closest(".del-foto");
    const btnCamOn   = e.target.closest(".cam-abrir");
    const btnShot    = e.target.closest(".cam-foto");

    // 1) Abrir / cerrar panel de detalle
    if (btn) {
      const id      = btn.dataset.id;
      const panel   = $(`.details[data-id="${id}"]`);
      if (!panel) return;
      const trDetail = panel.closest("tr.row-details");
      if (!trDetail) return;

      const isHidden =
        trDetail.hasAttribute("hidden") || trDetail.style.display === "none";

      if (isHidden) {
        trDetail.removeAttribute("hidden");
        trDetail.style.display = "table-row";
        panel.removeAttribute("hidden");
        btn.textContent = "Menos info";

        if (!CAM.has(id)) CAM.set(id, { stream: null, captures: [] });
        await cargarFotos(id);
      } else {
        trDetail.setAttribute("hidden", "");
        trDetail.style.display = "none";
        panel.setAttribute("hidden", "");
        btn.textContent = "Más info";

        // Al cerrar, apagamos la cámara si estaba prendida
        const S = CAM.get(id);
        if (S?.stream) {
          S.stream.getTracks().forEach((t) => t.stop());
          S.stream = null;
          CAM.set(id, S);
        }
        const v = $(`video.cam-preview[data-id="${id}"]`);
        if (v) {
          v.srcObject = null;
          v.style.display = "none";
        }
        const shotBtn = $(`.cam-foto[data-id="${id}"]`);
        if (shotBtn) shotBtn.disabled = true;
      }
      return;
    }

    // 2) ABRIR CÁMARA
    if (btnCamOn) {
      const id      = btnCamOn.dataset.id;
      const v       = $(`video.cam-preview[data-id="${id}"]`);
      const shotBtn = $(`.cam-foto[data-id="${id}"]`);

      if (!v || !shotBtn) {
        alert("No se encontró el video o el botón de foto para la orden " + id);
        console.error(
          "cam-abrir: no se encontró video.cam-preview o .cam-foto para id",
          id,
          { v, shotBtn }
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        v.srcObject = stream;
        v.style.display = "block";
        shotBtn.disabled = false;

        const S = CAM.get(id) || { stream: null, captures: [] };
        if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
        S.stream = stream;
        CAM.set(id, S);
      } catch (err) {
        console.error(err);
        alert(
          "No se pudo abrir la cámara. Revisa los permisos del navegador.\n\n" +
            err.message
        );
      }
      return;
    }

    // 3) TOMAR FOTO
    if (btnShot) {
      const id = btnShot.dataset.id;
      const v  = $(`video.cam-preview[data-id="${id}"]`);
      if (!v?.videoWidth) return;

      const c = document.createElement("canvas");
      c.width  = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);

      c.toBlob(
        (blob) => {
          if (!blob) return;

          const file = new File(
            [blob],
            `foto-${Date.now()}.jpg`,
            { type: "image/jpeg" }
          );

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
        },
        "image/jpeg",
        0.92
      );
      return;
    }

    // 4) GUARDAR CAMBIOS
    if (btnGuardar) {
      const id    = btnGuardar.dataset.id;
      const panel = $(`.details[data-id="${id}"]`);

      const sel     = panel?.querySelector(".estado-select");
      const vinEl   = panel?.querySelector(".vin-input");
      const cobroEl = panel?.querySelector(".cobro-input");
      const mecEl   = panel?.querySelector(".mecanico-input");

      const fotosInput = panel?.querySelector(`.fotos-input[data-id="${id}"]`);
      const okSpan  = panel?.querySelector(`.save-ok`);
      const errSpan = panel?.querySelector(`.save-err`);

      const S = CAM.get(id) || { captures: [] };

      try {
        const payload = {};
        if (sel?.value) payload.estado = sel.value;
        payload.vin      = (vinEl?.value || "").trim();
        payload.cobro    = (cobroEl?.value || "").trim();
        payload.mecanico = (mecEl?.value || "").trim();

        await API.patch(id, payload);

        const filesToUpload = [];
        if (fotosInput?.files?.length) filesToUpload.push(...fotosInput.files);
        if (S.captures?.length)        filesToUpload.push(...S.captures);

        if (filesToUpload.length) {
          await API.fotos.upload(id, filesToUpload);
          if (fotosInput) fotosInput.value = "";
          S.captures = [];
          CAM.set(id, S);
          await cargarFotos(id);
        }

        okSpan?.classList.remove("d-none");
        errSpan?.classList.add("d-none");
        await cargar();
        setTimeout(() => okSpan?.classList.add("d-none"), 1500);
      } catch (err) {
        console.error("Error guardando:", err);
        okSpan?.classList.add("d-none");
        errSpan?.classList.remove("d-none");
        setTimeout(() => errSpan?.classList.add("d-none"), 2000);
      }
      return;
    }

    // 5) BORRAR FOTO
    if (btnDelFoto) {
      const fotoId  = btnDelFoto.dataset.fotoId;
      const grid    = btnDelFoto.closest(".fotos-grid");
      const ordenId = grid?.dataset.id;
      try {
        await API.fotos.remove(fotoId);
        await cargarFotos(ordenId);
      } catch (err) {
        console.error("No se pudo borrar la foto:", err);
      }
      return;
    }
  });

  // Preview de badge al cambiar el select de estado
  tbody?.addEventListener("change", (e) => {
    const sel = e.target.closest(".estado-select");
    if (!sel) return;
    const id = sel.dataset.id;
    const badgeSlot = $(`.details[data-id="${id}"] .slot-estado`);
    if (badgeSlot) {
      badgeSlot.innerHTML = "";
      badgeSlot.appendChild(createBadgeElement(sel.value, sel.value));
    }
  });

  // =========================================
  // FILTROS
  // =========================================
  function getParams() {
    return {
      q:      (inputs.q.value || "").trim(),
      estado: inputs.estado.value || "",
      activo: inputs.activo.value || "",
      limit:  inputs.limit.value || "200",
      marca:  (inputs.marca.value || "").trim(),
      modelo: (inputs.modelo.value || "").trim(),
      anio:   (inputs.anio.value || "").trim(),
      color:  (inputs.color.value || "").trim(),
      page:   String(currentPage),
    };
  }

  async function cargar() {
    try {
      const params = getParams();
      const data   = await API.historial(params);

      // Compatibilidad: si el backend devolviera un array plano
      if (Array.isArray(data)) {
        totalResults = data.length;
        totalPages   = 1;
        currentPage  = 1;
        perPage      = totalResults || (parseInt(inputs.limit?.value || "200", 10) || 200);
        renderLista(data || []);
        renderPaginacion();
        return;
      }

      // Nueva estructura: { ok, rows, total, totalPages, page, perPage }
      const { rows, total, totalPages: tp, page, perPage: pp } = data;

      totalResults = total || 0;
      totalPages   = tp || 1;
      currentPage  = page || 1;
      perPage      = pp || (parseInt(inputs.limit?.value || "200", 10) || 200);

      renderLista(rows || []);
      renderPaginacion();
    } catch (e) {
      console.error(e);
      tbody.innerHTML =
        `<tr><td colspan="7" class="text-danger">Error al cargar los datos.</td></tr>`;
      if (pagerMeta) pagerMeta.textContent = "Error al cargar los datos.";
      if (pagerNav)  pagerNav.innerHTML = "";
    }
  }

  async function llenarDatalist(campo, datalistId) {
    const lista = document.getElementById(datalistId);
    if (!lista) return;
    try {
      const valores = await API.catalogo(campo);
      lista.innerHTML = "";
      valores.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        lista.appendChild(opt);
      });
    } catch (e) {
      console.error("Error cargando catálogo", campo, e);
    }
  }

  // Eventos de filtros
  inputs.aplicar?.addEventListener("click", () => {
    currentPage = 1;
    cargar();
  });

  inputs.q?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      currentPage = 1;
      cargar();
    }
  });

  inputs.limpiar?.addEventListener("click", () => {
    inputs.q.value = "";
    inputs.estado.value = "";
    inputs.activo.value = "";
    inputs.limit.value = "200";
    inputs.marca.value = "";
    inputs.modelo.value = "";
    inputs.anio.value = "";
    inputs.color.value = "";
    currentPage = 1;
    cargar();
  });

  inputs.limit?.addEventListener("change", () => {
    perPage = parseInt(inputs.limit.value || "200", 10) || 200;
    currentPage = 1;
    cargar();
  });

  // Inicio
  llenarDatalist("marca",  "lista-marca");
  llenarDatalist("modelo", "lista-modelo");
  llenarDatalist("anio",   "lista-anio");
  llenarDatalist("color",  "lista-color");
  cargar();
})();
