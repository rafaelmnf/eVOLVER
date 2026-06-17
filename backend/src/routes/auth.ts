// auth.ts — autenticação mínima desta etapa (sem JWT/bcrypt).
//
// O frontend envia o researcher_id (UUID de users) no body (`researcherId`) ou
// no header `x-researcher-id`. O middleware valida que o usuário existe e popula
// req.researcher. Quando houver um sistema de auth real (JWT), só este arquivo muda.
import type { Request, Response, NextFunction } from "express";
import { query } from "../services/db";

export interface Researcher {
  id: string;
  name: string;
  email: string;
}

// Estende o Request do Express para carregar o pesquisador autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      researcher?: Researcher;
    }
  }
}

export async function requireResearcher(req: Request, res: Response, next: NextFunction) {
  const researcherId =
    (req.body && req.body.researcherId) ||
    (req.headers["x-researcher-id"] as string | undefined);

  if (!researcherId) {
    res.status(401).json({ error: "Pesquisador não informado (researcherId ou header x-researcher-id)." });
    return;
  }

  try {
    const result = await query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [researcherId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Pesquisador inválido ou não encontrado." });
      return;
    }

    req.researcher = result.rows[0] as Researcher;
    next();
  } catch (error) {
    console.error("❌ [Auth] Erro ao validar pesquisador:", error);
    res.status(500).json({ error: "Erro interno ao validar pesquisador." });
  }
}
