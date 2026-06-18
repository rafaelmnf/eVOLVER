// slaves.ts — rotas relacionadas a slaves e suas configurações de sensores.
import type { Express } from "express";
import { query } from "../services/db";

// Sensores configuráveis por slave (alinhado ao enum sensor_type do init.sql).
const SENSOR_TYPES = ["temperature", "od", "agitation"] as const;
type SensorType = (typeof SENSOR_TYPES)[number];

export function registerSlaveRoutes(app: Express) {
  // --- GET /api/slaves : todas as slaves registradas ---
  app.get("/api/slaves", async (_req, res) => {
    try {
      const result = await query(
        `SELECT id, master_id, experiment_id, hostname, ip, status, last_seen, created_at
         FROM slaves
         ORDER BY created_at ASC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error("❌ [API] Erro ao listar slaves:", error);
      res.status(500).json({ error: "Erro interno ao listar slaves." });
    }
  });

  // --- GET /api/slaves/:slaveId/config : configurações de uma slave (mapeado por sensor) ---
  app.get("/api/slaves/:slaveId/config", async (req, res) => {
    try {
      const { slaveId } = req.params;
      const result = await query(
        `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
         FROM slave_sensor_configs
         WHERE slave_id = $1`,
        [slaveId]
      );

      // Retorna mapeado por sensor para facilitar o consumo no front
      const configBySensor: Record<string, any> = {};
      for (const row of result.rows) {
        configBySensor[row.sensor] = {
          targetValue: row.target_value,
          minLimit: row.min_limit,
          maxLimit: row.max_limit,
          feedPumpTime: row.feed_pump_time,
          wastePumpTime: row.waste_pump_time,
        };
      }

      res.json({ slaveId, config: configBySensor });
    } catch (error) {
      console.error("❌ [API] Erro ao carregar config da slave:", error);
      res.status(500).json({ error: "Erro interno ao carregar configurações da slave." });
    }
  });
}

// Helper de UPSERT de uma config de sensor — reaproveitado pela rota PUT (em experiments.ts).
// feed/waste pump time só fazem sentido para o sensor 'od'.
export async function upsertSensorConfig(
  slaveId: string,
  sensor: SensorType,
  cfg: {
    targetValue?: number | null;
    minLimit?: number | null;
    maxLimit?: number | null;
    feedPumpTime?: number | null;
    wastePumpTime?: number | null;
  }
) {
  const feedPump = sensor === "od" ? cfg.feedPumpTime ?? null : null;
  const wastePump = sensor === "od" ? cfg.wastePumpTime ?? null : null;

  await query(
    `INSERT INTO slave_sensor_configs
       (slave_id, sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slave_id, sensor) DO UPDATE SET
       target_value = EXCLUDED.target_value,
       min_limit = EXCLUDED.min_limit,
       max_limit = EXCLUDED.max_limit,
       feed_pump_time = EXCLUDED.feed_pump_time,
       waste_pump_time = EXCLUDED.waste_pump_time`,
    [
      slaveId,
      sensor,
      cfg.targetValue ?? null,
      cfg.minLimit ?? null,
      cfg.maxLimit ?? null,
      feedPump,
      wastePump,
    ]
  );
}

export { SENSOR_TYPES };
export type { SensorType };
