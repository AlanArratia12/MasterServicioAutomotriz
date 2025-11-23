// routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const router = Router();

router.get("/login", (req, res) => {
  if (req.session?.user) return res.redirect(req.query.next || "/");
  res.render("login", { title: "Inicia sesión" });
});

router.post("/login", async (req, res) => {
  const { username = "", password = "" } = req.body || {};
  try {
    const [[u]] = await pool.query(
      "SELECT id, username, nombre, role, password_hash FROM usuarios WHERE username = ? LIMIT 1",
      [username.trim()]
    );
    if (!u) return res.status(401).render("login", { title: "Inicia sesión", error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, u.password_hash || "");
    if (!ok) return res.status(401).render("login", { title: "Inicia sesión", error: "Credenciales inválidas" });

    // guarda sesión "ligera"
    req.session.user = { id: u.id, username: u.username, nombre: u.nombre, role: u.role };
    res.redirect(req.query.next || "/");
  } catch (e) {
    console.error(e);
    res.status(500).render("login", { title: "Inicia sesión", error: "Error interno" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// utilidades opcionales
router.get("/yo", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "No autenticado" });
  res.json(req.session.user);
});

export default router;
