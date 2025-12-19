// src/controllers/ordenes.controller.js
import { pool } from "../../db.js";

const MAP_ESTADO = {
  Recibido: 1,
  "Diagnóstico": 2,
  "En espera de refacciones": 3,
  "Reparación": 4,
  Listo: 5,
  Entregado: 6,
};

function soloDigitos(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}

export const actualizarOrden = async (req, res) => {
  const { id } = req.params;

  // existentes
  const { estado, vin, cobro, mecanico } = req.body || {};

  // NUEVOS (edición)
  const {
    clienteNombre,
    telefono1,
    telefono2,
    marca,
    modelo,
    anio,
    color,
    falla,
  } = req.body || {};

  const role = req.user?.role || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Buscar ids ligados a la orden
    const [rows] = await conn.query(
      `SELECT o.id_vehiculo, v.id_cliente
       FROM ordenes o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       WHERE o.id_orden = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const { id_vehiculo, id_cliente } = rows[0];

    // -------- actualizar ORDEN ----------
    const camposOrden = [];
    const valoresOrden = [];

    // Estado (admin/empleado)
    if (typeof estado === "string" && estado.trim()) {
      const idEstatus = MAP_ESTADO[estado] || 1;
      camposOrden.push("id_estatus = ?");
      valoresOrden.push(idEstatus);
    }

    // Falla (solo admin)
    if (role === "admin" && typeof falla === "string") {
      const val = falla.trim() === "" ? null : falla.trim();
      camposOrden.push("falla_reportada = ?");
      valoresOrden.push(val);
    }

    // Cobro (solo admin)
    if (role === "admin" && typeof cobro === "string") {
      const val = cobro.trim() === "" ? null : cobro.trim();
      camposOrden.push("cobro = ?");
      valoresOrden.push(val);
    }

    // Mecánico (admin/empleado)
    if (typeof mecanico === "string") {
      const val = mecanico.trim() === "" ? null : mecanico.trim();
      camposOrden.push("mecanico = ?");
      valoresOrden.push(val);
    }

    if (camposOrden.length) {
      valoresOrden.push(id);
      await conn.query(
        `UPDATE ordenes SET ${camposOrden.join(", ")} WHERE id_orden = ?`,
        valoresOrden
      );
    }

    // -------- actualizar VIN en VEHICULOS (admin/empleado) ----------
    if (typeof vin === "string") {
      const valVin = vin.trim() === "" ? null : vin.trim();
      await conn.query("UPDATE vehiculos SET VIN = ? WHERE id_vehiculo = ?", [
        valVin,
        id_vehiculo,
      ]);
    }

    // -------- editar DATOS DE VEHICULO (solo admin) ----------
    if (role === "admin") {
      const camposVeh = [];
      const valoresVeh = [];

      if (typeof marca === "string") {
        const v = marca.trim() === "" ? null : marca.trim();
        camposVeh.push("marca = ?");
        valoresVeh.push(v);
      }
      if (typeof modelo === "string") {
        const v = modelo.trim() === "" ? null : modelo.trim();
        camposVeh.push("modelo = ?");
        valoresVeh.push(v);
      }
      if (typeof color === "string") {
        const v = color.trim() === "" ? null : color.trim();
        camposVeh.push("color = ?");
        valoresVeh.push(v);
      }
      if (anio !== undefined) {
        const num = parseInt(anio, 10);
        const v = Number.isNaN(num) ? null : num;
        camposVeh.push("anio = ?");
        valoresVeh.push(v);
      }

      if (camposVeh.length) {
        valoresVeh.push(id_vehiculo);
        await conn.query(
          `UPDATE vehiculos SET ${camposVeh.join(", ")} WHERE id_vehiculo = ?`,
          valoresVeh
        );
      }

      // -------- editar DATOS DE CLIENTE (solo admin) ----------
      const camposCli = [];
      const valoresCli = [];

      if (typeof clienteNombre === "string") {
        const v = clienteNombre.trim() === "" ? null : clienteNombre.trim();
        camposCli.push("nombre = ?");
        valoresCli.push(v);
      }
      if (typeof telefono1 === "string") {
        const v = soloDigitos(telefono1);
        camposCli.push("telefono1 = ?");
        valoresCli.push(v || null);
      }
      if (typeof telefono2 === "string") {
        const v = soloDigitos(telefono2);
        camposCli.push("telefono2 = ?");
        valoresCli.push(v || null);
      }

      if (camposCli.length) {
        valoresCli.push(id_cliente);
        await conn.query(
          `UPDATE clientes SET ${camposCli.join(", ")} WHERE id_cliente = ?`,
          valoresCli
        );
      }
    }

    await conn.commit();
    return res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("Error actualizarOrden:", e);
    return res.status(500).json({ error: "No se pudo actualizar la orden" });
  } finally {
    conn.release();
  }
};
