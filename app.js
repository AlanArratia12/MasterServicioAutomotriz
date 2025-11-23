// app.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import session from "express-session";

// Rutas
import ajustesRoutes from "./routes/ajustes.routes.js";
import ordenesRoutes from "./routes/ordenes.routes.js";
import authRoutes from "./routes/auth.routes.js";

// Middlewares de auth
import {
  sessionUser,
  exposeUserToViews,
  ensureAuth,
} from "./src/middlewares/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------------- Hardening ---------------------- */
app.disable("x-powered-by");

/* ---------------------- Sesión ---------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
      sameSite: "lax",
    },
  })
);

/* ---------------------- Middlewares base ---------------------- */
app.use(express.json({ limit: "10mb" })); // JSON para API
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // forms

/* ---------------------- Usuario en req y en vistas ---------------------- */
app.use(sessionUser);       // req.user desde la sesión
app.use(exposeUserToViews); // res.locals.user en Pug

/* ---------------------- Archivos estáticos ---------------------- */
// /js, /css, imágenes de tu frontend
app.use(
  express.static(path.join(__dirname, "src", "public"), {
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  })
);
// Archivos subidos (fotos, audios de órdenes)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), { maxAge: "1d" })
);

/* ---------------------- Motor de vistas ---------------------- */
app.set("views", path.join(__dirname, "src", "views"));
app.set("view engine", "pug");

/* ---------------------- Auth (público) ---------------------- */
app.use(authRoutes); // /login, /logout, /yo

/* ---------------------- Rutas de páginas (protegidas) ---------------------- */
app.get("/", ensureAuth, (req, res) =>
  res.render("recepcion", { title: "Recepción" })
);
app.get("/clientes", ensureAuth, (req, res) =>
  res.render("clientes", { title: "Clientes" })
);
app.get("/vehiculos", ensureAuth, (req, res) =>
  res.render("vehiculos", { title: "Vehículos" })
);
app.get("/ordenes", ensureAuth, (req, res) =>
  res.render("ordenes", { title: "Órdenes" })
);
app.get("/historial", ensureAuth, (req, res) =>
  res.render("historial", { title: "Historial y búsquedas" })
);
app.get("/buscar", (_req, res) => res.redirect(301, "/historial"));
app.get("/recepcion", ensureAuth, (req, res) =>
  res.render("recepcion", { title: "Recepción" })
);

/* ---------------------- Ajustes (protegido) ---------------------- */
// Aquí cuelga lo de crear usuarios, etc.
// Dentro de ajustes.routes.js ya puedes filtrar por rol admin.
app.use("/ajustes", ensureAuth, ajustesRoutes);

/* ---------------------- API (protegido) ---------------------- */
// Todo el API de órdenes bajo /api/ordenes
app.use("/api/ordenes", ensureAuth, ordenesRoutes);

/* ---------------------- Utilidades ---------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------- 404 y errores ---------------------- */
// 404 (páginas no encontradas)
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "No encontrado" });
  }
  res.status(404).render("404", { title: "No encontrado" });
});

// Handler de errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("Error no controlado:", err);
  if (res.headersSent) return;
  if (req?.path?.startsWith?.("/api/")) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
  res.status(500).render("500", { title: "Error interno" });
});

/* ---------------------- Inicio del servidor ---------------------- */
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
