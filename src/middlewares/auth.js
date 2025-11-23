// src/middlewares/auth.js
import { pool } from "../../db.js";

export function sessionUser(req, _res, next) {
  // adjunta el usuario a req.user si hay sesión
  req.user = req.session?.user || null;
  next();
}

export function exposeUserToViews(req, res, next) {
  res.locals.user = req.user; // disponible en Pug
  next();
}

export function ensureAuth(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "No autenticado" });
    }
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  next();
}

export function ensureRole(roles = []) {
  const set = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    if (!req.user || !set.has(req.user.role)) {
      if (req.path.startsWith("/api/")) {
        return res.status(403).json({ error: "Sin permisos" });
      }
      return res.status(403).render("403", { title: "Sin permisos" });
    }
    next();
  };
}

// pequeño helper opcional: trae usuario por id
export async function getUserById(id) {
  const [[u]] = await pool.query(
    "SELECT id, username, nombre, role FROM usuarios WHERE id = ?",
    [id]
  );
  return u || null;
}
