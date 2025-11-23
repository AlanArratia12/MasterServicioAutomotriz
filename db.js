// src/db.js  (o donde tengas tu archivo de conexión)

import mysql from "mysql2/promise";
import "dotenv/config";

// 👇 Asegúrate de que en Railway existe DATABASE_URL = {{ MySQL.MYSQL_URL }}
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno");
}

// 👇 Usamos la URL completa que da Railway
export const pool = mysql.createPool(connectionString);
