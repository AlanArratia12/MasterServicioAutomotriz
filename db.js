// db.js
import mysql from "mysql2/promise";
import "dotenv/config";

// En producción (Railway) SIEMPRE usaremos DATABASE_URL
// que ya contiene host, usuario, contraseña, puerto y base de datos.
// Ejemplo: mysql://root:pass@host:port/railway

if (!process.env.DATABASE_URL) {
  console.error("FALTA la variable DATABASE_URL en Railway");
  process.exit(1);
}

const pool = mysql.createPool(process.env.DATABASE_URL);

export default pool;
