// scripts/seed-admin.mjs
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import "dotenv/config";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "taller_automotriz",
});

const username = process.env.ADMIN_USER || "admin";
const password = process.env.ADMIN_PASS || "admin123";
const nombre = "Administrador";

const hash = await bcrypt.hash(password, 10);

await conn.execute(
  `INSERT INTO usuarios (username, nombre, role, password_hash)
   VALUES (?, ?, 'admin', ?)
   ON DUPLICATE KEY UPDATE
     password_hash = VALUES(password_hash),
     nombre = VALUES(nombre),
     role = 'admin'`,
  [username, nombre, hash]
);

console.log(`✔ Usuario administrador creado: ${username} / ${password}`);
await conn.end();
