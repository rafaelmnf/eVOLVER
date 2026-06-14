import pg from "pg";
import { config } from "../config/env";

const pool = new pg.Pool({
  user: config.dbUser,
  password: config.dbPassword,
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
});

pool.on("error", (err) => {
  console.error("❌ [Database Pool] Unexpected error on idle client", err);
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export { pool };
