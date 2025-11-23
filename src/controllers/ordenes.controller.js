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

export const actualizarOrden = async (req, res) => {
  const { id } = req.params;
  const { estado, vin, cobro, mecanico } = req.body || {};

  // Si tu middleware de auth mete aquí al usuario, lo usamos;
  // si no, será null (y tratamos como empleado).
  const role = req.user?.role || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Buscar el vehículo ligado a esa orden
    const [rows] = await conn.query(
      "SELECT id_vehiculo FROM ordenes WHERE id_orden = ? LIMIT 1",
      [id]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Orden no encontrada" });
    }

    const { id_vehiculo } = rows[0];

    // -------- actualizar ORDEN ----------
    const camposOrden = [];
    const valoresOrden = [];

    // Estado (todos pueden cambiarlo)
    if (estado) {
      const idEstatus = MAP_ESTADO[estado] || 1;
      camposOrden.push("id_estatus = ?");
      valoresOrden.push(idEstatus);
    }

    // Cobro SOLO lo puede cambiar el admin
    if (typeof cobro === "string" && role === "admin") {
      const val = cobro.trim() === "" ? null : cobro.trim();
      camposOrden.push("cobro = ?");
      valoresOrden.push(val);
    }

    // Mecánico lo puede escribir cualquiera (admin / empleado)
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

    // -------- actualizar VIN en VEHICULOS ----------
    if (typeof vin === "string") {
      const valVin = vin.trim() === "" ? null : vin.trim();
      await conn.query(
        "UPDATE vehiculos SET VIN = ? WHERE id_vehiculo = ?",
        [valVin, id_vehiculo]
      );
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
