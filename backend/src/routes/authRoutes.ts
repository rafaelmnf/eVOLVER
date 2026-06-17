// authRoutes.ts — autenticação real mínima (sem JWT, sem libs externas).
//
// Usa o módulo nativo `crypto` (scrypt) para hash de senha. O password_hash é
// armazenado no formato "salt:hash" (ambos em hex). Comparação em tempo constante.
import type { Express } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { query } from "../services/db";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, 64);
  // timingSafeEqual exige buffers do mesmo tamanho
  if (hashBuffer.length !== derived.length) return false;
  return timingSafeEqual(hashBuffer, derived);
}

export function registerAuthRoutes(app: Express) {
  // --- POST /api/auth/register : cria usuário e retorna o pesquisador (id real) ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ error: "name, email e password são obrigatórios." });
        return;
      }

      const exists = await query(`SELECT id FROM users WHERE email = $1`, [email]);
      if (exists.rows.length > 0) {
        res.status(409).json({ error: "Email já cadastrado." });
        return;
      }

      const passwordHash = hashPassword(password);
      const result = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [name, email, passwordHash]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("❌ [Auth] Erro ao registrar usuário:", error);
      res.status(500).json({ error: "Erro interno ao registrar usuário." });
    }
  });

  // --- POST /api/auth/login : valida credenciais e retorna o pesquisador (id real) ---
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "email e password são obrigatórios." });
        return;
      }

      const result = await query(
        `SELECT id, name, email, password_hash FROM users WHERE email = $1`,
        [email]
      );

      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: "Credenciais inválidas." });
        return;
      }

      res.json({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
      console.error("❌ [Auth] Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro interno ao fazer login." });
    }
  });
}
