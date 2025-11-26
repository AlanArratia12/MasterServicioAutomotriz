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

// Railway asigna su propio puerto
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ---------------------- Usuario en req y en vistas ---------------------- */
app.use(sessionUser);
app.use(exposeUserToViews);

/* ---------------------- Archivos estáticos ---------------------- */
app.use(
  express.static(path.join(__dirname, "src", "public"), {
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  })
);

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
app.use("/ajustes", ensureAuth, ajustesRoutes);

/* ---------------------- API (protegido) ---------------------- */
app.use("/api/ordenes", ensureAuth, ordenesRoutes);

/* ---------------------- Healthcheck ---------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------- Errores ---------------------- */
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "No encontrado" });
  }
  res.status(404).render("404", { title: "No encontrado" });
});

app.use((err, req, res, _next) => {
  console.error("Error no controlado:", err);
  if (res.headersSent) return;

  if (req?.path?.startsWith?.("/api/")) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
  res.status(500).render("500", { title: "Error interno" });
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
