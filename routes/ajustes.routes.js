// routes/ajustes.routes.js
import { Router } from "express";
import { ensureRole } from "../src/middlewares/auth.js";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";   // 👈 usa la misma lib que en tu login

const router = Router();

/* ===========================
   Mostrar página ajustes
=========================== */
router.get("/", ensureRole("admin"), async (req, res) => {
  const [usuarios] = await pool.query(
    "SELECT id, nombre, username, role FROM usuarios ORDER BY id ASC"
  );

  res.render("ajustes", {
    title: "Ajustes",
    usuarios,
  });
});

/* ===========================
   Crear usuario
=========================== */
router.post("/usuarios", ensureRole("admin"), async (req, res) => {
  try {
    const { nombre, username, password, rol } = req.body;

    if (!nombre || !username || !password || !rol) {
      return res.status(400).json({ error: "Faltan datos." });
    }

    // Validar que username no exista
    const [existe] = await pool.query(
      "SELECT id FROM usuarios WHERE username = ? LIMIT 1",
      [username]
    );
    if (existe.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe." });
    }

    // Hashear contraseña
    const hash = await bcrypt.hash(password, 10);

    // OJO: columnas reales de tu tabla
    const [result] = await pool.query(
      "INSERT INTO usuarios (username, nombre, role, password_hash) VALUES (?, ?, ?, ?)",
      [username, nombre, rol, hash]
    );

    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("Error creando usuario:", err);
    return res.status(500).json({ error: "No se pudo crear el usuario." });
  }
});

/* ===========================
   Eliminar usuario
=========================== */
router.delete("/usuarios/:id", ensureRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    res.status(500).json({ error: "No se pudo eliminar el usuario." });
  }
});

/* ===========================
   Cambiar contraseña
=========================== */
router.patch(
  "/usuarios/:id/password",
  ensureRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "Contraseña requerida." });
      }

      const hash = await bcrypt.hash(password, 10);

      // Actualizar password_hash
      await pool.query(
        "UPDATE usuarios SET password_hash = ? WHERE id = ?",
        [hash, id]
      );

      res.json({ ok: true });
    } catch (err) {
      console.error("Error cambiando contraseña:", err);
      res
        .status(500)
        .json({ error: "No se pudo actualizar la contraseña." });
    }
  }
);

export default router;
