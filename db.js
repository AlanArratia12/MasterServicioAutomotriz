// db.js
import mysql from "mysql2/promise";
import "dotenv/config";

// Si hay DATABASE_URL, usamos esa (producción en Railway).
// Si no, usamos los campos separados (para desarrollo local).
const connectionConfig = process.env.DATABASE_URL || {
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "",
  port: Number(process.env.MYSQLPORT) || 3306,
};


export const pool = mysql.createPool(connectionConfig);
