// routes/ordenes.routes.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { actualizarOrden } from "../src/controllers/ordenes.controller.js";
import { ensureRole } from "../src/middlewares/auth.js";
import cloudinary from "../src/lib/cloudinary.js";

const router = Router();

/* ===========================================================
   Helper: fecha actual en zona America/Mexico_City (AAAA, MM, DD)
=========================================================== */
function fechaMX() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;

  return { year, month, day };
}

/* ============ Multer: audios a tmp y luego se mueven a /ordenes/:id/audios ============ */
const storageTmp = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join("uploads", "ordenes", "tmp");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, uuidv4() + ext);
  },
});
const fileFilter = (_req, file, cb) => {
  if (!file.mimetype?.startsWith("audio/")) return cb(null, false);
  cb(null, true);
};
const uploadAudio = multer({
  storage: storageTmp,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

/* ===========================================================================================
   POST /   -> Crear: cliente NUEVO -> vehiculo -> orden (+ audio opcional)
   (admin y empleado pueden capturar recepción)
=========================================================================================== */
router.post(
  "/",
  ensureRole(["admin", "empleado"]),
  uploadAudio.single("audios"),
  async (req, res) => {
    const {
      clienteNombre,
      telefono1,
      telefono2,
      falla,
      marca,
      modelo,
      anio,
      color,
      VIN,
    } = req.body;

    if (!clienteNombre || !telefono1 || !falla || !marca || !modelo) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) Cliente nuevo
      const [cliResult] = await conn.query(
        `INSERT INTO clientes (nombre, telefono1, telefono2)
         VALUES (?, ?, ?)`,
        [clienteNombre, telefono1, telefono2 || null]
      );
      const id_cliente = cliResult.insertId;

      // 2) Vehículo nuevo
      const [vehResult] = await conn.query(
        `INSERT INTO vehiculos (id_cliente, marca, modelo, anio, color, VIN)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_cliente, marca, modelo, anio || null, color || null, VIN || null]
      );
      const id_vehiculo = vehResult.insertId;

      // 3) Orden
      const ahora = new Date();
      const fecha = ahora.toISOString().slice(0, 10);
      const hora = ahora.toTimeString().slice(0, 8);

      const [ordResult] = await conn.query(
        `INSERT INTO ordenes (
           id_vehiculo, fecha_ingreso, hora_ingreso,
           falla_reportada, id_estatus
         )
         VALUES (?, ?, ?, ?, 1)`,
        [id_vehiculo, fecha, hora, falla]
      );
      const id_orden = ordResult.insertId;

      // 4) Audio opcional
      if (req.file) {
        const dirOrden = path.join(
          "uploads",
          "ordenes",
          String(id_orden),
          "audios"
        );
        fs.mkdirSync(dirOrden, { recursive: true });

        const ext =
          path.extname(req.file.originalname || "").toLowerCase() || ".m4a";
        const nombreFinal = `audio-${id_orden}-${Date.now()}${ext}`;
        const finalPath = path.join(dirOrden, nombreFinal);

        fs.renameSync(req.file.path, finalPath);

        await conn.query(
          `INSERT INTO orden_audios (orden_id, ruta_archivo, nombre_original, mime_type)
           VALUES (?, ?, ?, ?)`,
          [
            id_orden,
            finalPath.replace(/\\/g, "/"),
            req.file.originalname || "",
            req.file.mimetype || "",
          ]
        );
      }

      await conn.commit();
      return res
        .status(201)
        .json({ ok: true, id_orden, id_vehiculo, id_cliente });
    } catch (e) {
      await conn.rollback();
      if (req.file)
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      console.error(e);
      if (e?.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ error: "Regla 1–1 violada: ya existe un registro similar" });
      }
      return res.status(500).json({ error: "Error al crear la orden" });
    }
  }
);

// ====== LISTA DE HOY (y pendientes de días anteriores) ======
router.get(
  "/hoy",
  ensureRole(["admin", "empleado"]),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
           o.id_orden,
           o.fecha_ingreso,
           DATE_FORMAT(o.hora_ingreso, '%H:%i') AS hora,
           c.nombre AS cliente,
           c.telefono1, 
           c.telefono2,
           v.marca, 
           v.modelo, 
           v.anio, 
           v.color, 
           v.VIN,
           o.falla_reportada AS falla,
           o.cobro,
           o.mecanico,
           o.id_estatus
         FROM ordenes o
         JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
         JOIN clientes  c ON c.id_cliente  = v.id_cliente
         WHERE
           -- 1) Órdenes de HOY (cualquier estado)
           o.fecha_ingreso = CURDATE()
           OR
           -- 2) Órdenes de días ANTERIORES que NO estén entregadas
           (o.fecha_ingreso < CURDATE() AND o.id_estatus <> 6)
         ORDER BY 
           o.fecha_ingreso DESC,
           o.hora_ingreso  DESC`
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "No se pudo obtener la lista de hoy" });
    }
  }
);

/* ===========================================================================================
   🔹 GET /historial  (Búsquedas + PAGINACIÓN)
   IMPORTANTE: va ANTES de /:id para que no lo capture la ruta dinámica
=========================================================================================== */
router.get("/historial", async (req, res) => {
  const {
    q = "",
    activo = "",
    estado = "",
    limit = "200", // por página
    marca = "",
    modelo = "",
    anio = "",
    color = "",
    page = "1",
  } = req.query || {};

  const LIM = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

  let pageNum = parseInt(page, 10);
  if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1;

  const where = [];
  const args = [];

  if (q) {
    where.push(`(
      c.nombre   LIKE ? OR c.telefono1 LIKE ? OR c.telefono2 LIKE ?
      OR v.marca LIKE ? OR v.modelo   LIKE ? OR v.color     LIKE ?
      OR v.VIN   LIKE ?
    )`);
    for (let i = 0; i < 7; i++) args.push(`%${q}%`);
  }

  if (marca) {
    where.push("v.marca LIKE ?");
    args.push(`%${marca}%`);
  }
  if (modelo) {
    where.push("v.modelo LIKE ?");
    args.push(`%${modelo}%`);
  }
  if (anio) {
    const anioNum = parseInt(anio, 10);
    if (!Number.isNaN(anioNum)) {
      where.push("v.anio = ?");
      args.push(anioNum);
    }
  }
  if (color) {
    where.push("v.color LIKE ?");
    args.push(`%${color}%`);
  }

  if (String(activo) === "1") {
    where.push(`o.id_estatus <> 6`);
  }

  const estNum = parseInt(estado, 10);
  if (!isNaN(estNum) && estNum >= 1 && estNum <= 6) {
    where.push(`o.id_estatus = ?`);
    args.push(estNum);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    // 1) total de resultados
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM ordenes o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       JOIN clientes  c ON c.id_cliente  = v.id_cliente
       ${whereSql}`,
      args
    );
    const total = countRows[0]?.total || 0;
    const totalPages = total ? Math.max(Math.ceil(total / LIM), 1) : 1;

    if (pageNum > totalPages) pageNum = totalPages;
    const offset = (pageNum - 1) * LIM;

    // 2) página actual
    const [rows] = await pool.query(
      `SELECT
         o.id_orden,
         o.fecha_ingreso,
         DATE_FORMAT(o.hora_ingreso, '%H:%i') AS hora,
         c.nombre AS cliente,
         c.telefono1, c.telefono2,
         v.marca, v.modelo, v.anio, v.color, v.VIN,
         o.falla_reportada AS falla,
         o.cobro,
         o.mecanico,
         o.id_estatus
       FROM ordenes o
       JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
       JOIN clientes  c ON c.id_cliente  = v.id_cliente
       ${whereSql}
       ORDER BY o.fecha_ingreso DESC, o.hora_ingreso DESC
       LIMIT ${LIM} OFFSET ${offset}`,
      args
    );

    res.json({
      ok: true,
      rows,
      page: pageNum,
      perPage: LIM,
      total,
      totalPages,
    });
  } catch (e) {
    console.error("Error /historial:", e?.sqlMessage || e?.message || e);
    res.status(500).json({ error: "No se pudo obtener el historial" });
  }
});

/* ===========================================================================================
   GET /:id        (Detalle de una orden específica)
   ⚠️ Esta ruta VA DESPUÉS de /historial
=========================================================================================== */
router.get(
  "/:id",
  ensureRole(["admin", "empleado"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT
           o.id_orden,
           o.fecha_ingreso,
           DATE_FORMAT(o.hora_ingreso, '%H:%i') AS hora,
           c.nombre AS cliente,
           c.telefono1, c.telefono2,
           v.marca, v.modelo, v.anio, v.color, v.VIN,
           o.falla_reportada AS falla,
           o.cobro,
           o.mecanico,
           o.id_estatus
         FROM ordenes o
         JOIN vehiculos v ON v.id_vehiculo = o.id_vehiculo
         JOIN clientes  c ON c.id_cliente  = v.id_cliente
         WHERE o.id_orden = ?`,
        [id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "No se pudo obtener la orden" });
    }
  }
);

/* ===========================================================================================
   PATCH /:id      (Actualizar estado, VIN, cobro, mecánico)
=========================================================================================== */
router.patch(
  "/:id",
  ensureRole(["admin", "empleado"]),
  async (req, res) => {
    try {
      await actualizarOrden(req, res);
    } catch (e) {
      console.error("Error en PATCH /:id", e);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error al actualizar la orden" });
      }
    }
  }
);

/* ===========================================================================================
   GET /:id/fotos      (Listar fotos de una orden)
=========================================================================================== */
router.get(
  "/:id/fotos",
  ensureRole(["admin", "empleado"]),
  async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query(
        `SELECT id, orden_id, ruta_archivo, nombre_original, mime_type, public_id
         FROM orden_fotos
         WHERE orden_id = ?
         ORDER BY id DESC`,
        [id]
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ error: "No se pudieron recuperar las fotos" });
    }
  }
);

/* ===========================================================================================
   POST /:id/fotos      (Subir fotos para una orden a Cloudinary, por FECHA)
=========================================================================================== */

// Multer para FOTOS: guarda temporalmente y luego subimos a Cloudinary
const uploadFotos = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join("uploads", "tmp-fotos");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, "foto-" + uuidv4() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/:id/fotos",
  ensureRole(["admin", "empleado"]),
  uploadFotos.array("fotos"),
  async (req, res) => {
    const { id } = req.params;
    if (!req.files?.length) {
      return res.status(400).json({ error: "No se recibieron archivos" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const { year, month, day } = fechaMX();
      const folder = `master-servicio/${year}/${month}/${day}`;

      for (const file of req.files) {
        // 1) Subir a Cloudinary a carpeta por FECHA
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder,
          resource_type: "image",
        });

        // 2) Borrar archivo temporal
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.warn(
            "No se pudo borrar archivo temporal:",
            e.message
          );
        }

        // 3) Guardar en BD la URL y el public_id
        await conn.query(
          `INSERT INTO orden_fotos (orden_id, ruta_archivo, nombre_original, mime_type, public_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            id,
            uploadResult.secure_url,
            file.originalname || "",
            file.mimetype || "",
            uploadResult.public_id,
          ]
        );
      }

      await conn.commit();
      res.status(201).json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res
        .status(500)
        .json({ error: "No se pudieron guardar las fotos" });
    } finally {
      conn.release();
    }
  }
);

/* ===========================================================================================
   DELETE /fotos/:id   (Eliminar una foto individual de Cloudinary y BD)
   Solo admin
=========================================================================================== */
router.delete(
  "/fotos/:id",
  ensureRole(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [[foto]] = await conn.query(
        `SELECT ruta_archivo, public_id FROM orden_fotos WHERE id = ?`,
        [id]
      );

      if (!foto) {
        await conn.rollback();
        return res.status(404).json({ error: "Foto no encontrada" });
      }

      // 1) Borrar en Cloudinary si tenemos public_id
      if (foto.public_id) {
        try {
          await cloudinary.uploader.destroy(foto.public_id);
        } catch (e) {
          console.warn(
            "No se pudo borrar en Cloudinary:",
            e.message
          );
        }
      }

      // 2) Borrar registro de BD
      await conn.query(`DELETE FROM orden_fotos WHERE id = ?`, [id]);
      await conn.commit();
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res
        .status(500)
        .json({ error: "No se pudo borrar la foto" });
    } finally {
      conn.release();
    }
  }
);

/* ===========================================================================================
   DELETE /:id         (Eliminar completamente una orden + sus fotos en BD)
   Solo admin
=========================================================================================== */
router.delete(
  "/:id",
  ensureRole(["admin"]),
  async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      await conn.query("DELETE FROM orden_fotos WHERE orden_id = ?", [id]);

      const [result] = await conn.query(
        "DELETE FROM ordenes WHERE id_orden = ?",
        [id]
      );

      await conn.commit();

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      res.json({ ok: true, mensaje: "Orden eliminada correctamente" });
    } catch (e) {
      await conn.rollback();
      console.error(e);
      res
        .status(500)
        .json({ error: "No se pudo borrar la orden" });
    } finally {
      conn.release();
    }
  }
);

export default router;
