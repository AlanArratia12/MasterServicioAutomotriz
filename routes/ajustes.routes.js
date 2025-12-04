// routes/ajustes.routes.js
import { Router } from "express";
import { ensureRole } from "../src/middlewares/auth.js";
import { pool } from "../db.js";
import bcrypt from "bcryptjs";

const router = Router();

/* ===========================
   Mostrar página de ajustes
   Solo admin
=========================== */
router.get("/", ensureRole("admin"), async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      "SELECT id, nombre, username, role FROM usuarios ORDER BY id ASC"
    );

    res.render("ajustes", {
      title: "Ajustes",
      user: req.user,
      usuarios,
    });
  } catch (err) {
    console.error("Error cargando usuarios en ajustes:", err);
    res.status(500).render("500", { title: "Error interno" });
  }
});

/* ===========================
   Crear nuevo usuario
   POST /ajustes/usuarios
=========================== */
router.post("/usuarios", ensureRole("admin"), async (req, res) => {
  const { nombre = "", username = "", password = "", role = "" } = req.body || {};

  if (!nombre.trim() || !username.trim() || !password.trim() || !role.trim()) {
    return res.status(400).json({ error: "Todos los campos son obligatorios." });
  }

  // Solo permitir admin o empleado
  if (!["admin", "empleado"].includes(role.trim())) {
    return res.status(400).json({ error: "Rol inválido." });
  }

  try {
    // Verificar si ya existe ese username
    const [[existe]] = await pool.query(
      "SELECT id FROM usuarios WHERE username = ? LIMIT 1",
      [username.trim()]
    );

    if (existe) {
      return res.status(409).json({ error: "Ese nombre de usuario ya existe." });
    }

    const hash = await bcrypt.hash(password.trim(), 10);

    const [result] = await pool.query(
      "INSERT INTO usuarios (nombre, username, role, password_hash) VALUES (?, ?, ?, ?)",
      [nombre.trim(), username.trim(), role.trim(), hash]
    );

    return res.json({
      ok: true,
      usuario: {
        id: result.insertId,
        nombre: nombre.trim(),
        username: username.trim(),
        role: role.trim(),
      },
    });
  } catch (err) {
    console.error("Error creando usuario:", err);
    return res
      .status(500)
      .json({ error: "No se pudo crear el usuario, revisa la consola." });
  }
});

/* ===========================
   Cambiar rol de usuario
   PATCH /ajustes/usuarios/:id/role
=========================== */
router.patch("/usuarios/:id/role", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { role = "" } = req.body || {};

  if (!role.trim()) {
    return res.status(400).json({ error: "Rol requerido." });
  }
  if (!["admin", "empleado"].includes(role.trim())) {
    return res.status(400).json({ error: "Rol inválido." });
  }

  try {
    const [[user]] = await pool.query(
      "SELECT username, role FROM usuarios WHERE id = ?",
      [id]
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // No permitir cambiar el rol de la cuenta principal admin
    if (user.username === "admin" && user.role === "admin") {
      return res
        .status(400)
        .json({ error: "No se puede cambiar el rol de la cuenta de administrador." });
    }

    const [r] = await pool.query("UPDATE usuarios SET role = ? WHERE id = ?", [
      role.trim(),
      id,
    ]);

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error cambiando rol:", err);
    return res
      .status(500)
      .json({ error: "No se pudo actualizar el rol del usuario." });
  }
});

/* ===========================
   Eliminar usuario
   DELETE /ajustes/usuarios/:id
=========================== */
router.delete("/usuarios/:id", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const [[user]] = await pool.query(
      "SELECT username, role FROM usuarios WHERE id = ?",
      [id]
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // No permitir borrar la cuenta principal admin
    if (user.username === "admin" && user.role === "admin") {
      return res
        .status(400)
        .json({ error: "No se puede eliminar la cuenta de administrador." });
    }

    const [r] = await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando usuario:", err);
    return res.status(500).json({ error: "No se pudo eliminar el usuario." });
  }
});

/* ===========================
   Cambiar contraseña
   PATCH /ajustes/usuarios/:id/pass
=========================== */
router.patch("/usuarios/:id/pass", ensureRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { password = "" } = req.body || {};

  if (!password.trim()) {
    return res.status(400).json({ error: "Contraseña requerida." });
  }

  try {
    const hash = await bcrypt.hash(password.trim(), 10);

    const [r] = await pool.query(
      "UPDATE usuarios SET password_hash = ? WHERE id = ?",
      [hash, id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error cambiando contraseña:", err);
    return res
      .status(500)
      .json({ error: "No se pudo actualizar la contraseña." });
  }
});

export default router;
