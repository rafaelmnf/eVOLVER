// experiments.ts — rotas de experimentos (CRUD, config de slaves, dados, alertas, start).
import type { Express } from "express";
import { query } from "../services/db";
import { getHistoryByField } from "../services/influx";
import type { WebSocketService } from "../services/websocket";
import type { MQTTService } from "../services/mqtt";
import { requireResearcher } from "./auth";
import { upsertSensorConfig, SENSOR_TYPES } from "./slaves";

export interface RouteDeps {
  wsService: WebSocketService;
  mqttService: MQTTService;
}

// Mapeia a categoria da query (?category=) para o field correspondente no InfluxDB.
const CATEGORY_TO_FIELD: Record<string, string> = {
  tp: "temperature",
  do: "od",
  rpm: "rotacao",
};

// Ativa as slaves de um experimento: carrega config + intervalo de cada slave,
// publica o comando MQTT `iniciar_experimento` e faz broadcast do status.
// Reutilizado por POST /start e POST /resume.
async function startSlavesForExperiment(
  experimentId: string,
  deps: RouteDeps
): Promise<number> {
  const { wsService, mqttService } = deps;

  // Intervalo de envio é definido por experimento (mesmo valor para todas as slaves).
  const intervalResult = await query(
    `SELECT data_send_interval FROM experiments WHERE id = $1`,
    [experimentId]
  );
  const intervalo = intervalResult.rows[0]?.data_send_interval ?? 20;

  const slavesResult = await query(
    `UPDATE slaves SET status = 'active' WHERE experiment_id = $1
     RETURNING id, hostname`,
    [experimentId]
  );

  for (const slave of slavesResult.rows) {
    const cfgResult = await query(
      `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
       FROM slave_sensor_configs
       WHERE slave_id = $1`,
      [slave.id]
    );

    const configBySensor: Record<string, any> = {};
    for (const row of cfgResult.rows) {
      configBySensor[row.sensor] = {
        targetValue: row.target_value,
        minLimit: row.min_limit,
        maxLimit: row.max_limit,
        feedPumpTime: row.feed_pump_time,
        wastePumpTime: row.waste_pump_time,
      };
    }

    mqttService.publish(`projeto/comandos/${slave.hostname}`, {
      comando: "iniciar_experimento",
      experimentId,
      // Intervalo de envio (segundos) respeitado pela Pico no loop principal.
      intervalo,
      config: configBySensor,
    });

    wsService.broadcast({
      type: "SLAVE_STATUS_UPDATE",
      data: {
        id: slave.id,
        hostname: slave.hostname,
        status: "active",
        lastSeen: new Date().toISOString(),
      },
    });
  }

  return slavesResult.rows.length;
}

export function registerExperimentRoutes(app: Express, deps: RouteDeps) {
  const { wsService, mqttService } = deps;

  // --- GET /api/experiments : lista todos (8 campos + dados do pesquisador) ---
  app.get("/api/experiments", async (_req, res) => {
    try {
      const result = await query(
        `SELECT e.id, e.researcher_id, e.name, e.description, e.status,
                e.started_at, e.created_at, e.updated_at,
                u.name AS researcher_name, u.email AS researcher_email,
                COALESCE(
                  (SELECT array_agg(s.id) FROM slaves s WHERE s.experiment_id = e.id),
                  '{}'
                ) AS slave_ids
         FROM experiments e
         LEFT JOIN users u ON u.id = e.researcher_id
         ORDER BY e.created_at DESC`
      );

      const experiments = result.rows.map((row) => ({
        id: row.id,
        researcherId: row.researcher_id,
        name: row.name,
        description: row.description || "",
        status: row.status,
        startedAt: row.started_at ? row.started_at.toISOString() : null,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
        updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
        slaveIds: row.slave_ids || [],
        researcher: {
          id: row.researcher_id || "",
          name: row.researcher_name || "Pesquisador",
          email: row.researcher_email || "",
        },
      }));

      res.json(experiments);
    } catch (error) {
      console.error("❌ [API] Erro ao listar experimentos:", error);
      res.status(500).json({ error: "Erro interno ao listar experimentos." });
    }
  });

  // --- POST /api/experiments : cria experimento inicial em 'draft' ---
  app.post("/api/experiments", requireResearcher, async (req, res) => {
    try {
      const { name, description, slaveIds, dataSendInterval } = req.body;
      const researcher = req.researcher!; // garantido pelo requireResearcher

      if (!name) {
        res.status(400).json({ error: "name é obrigatório." });
        return;
      }

      // Intervalo de envio do experimento (segundos). Validação estrita 20–200.
      const interval = Number(dataSendInterval);
      if (!Number.isFinite(interval) || interval < 20 || interval > 200) {
        res.status(400).json({ error: "dataSendInterval deve estar entre 20 e 200 segundos." });
        return;
      }

      const expResult = await query(
        `INSERT INTO experiments (researcher_id, name, description, status, data_send_interval)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING id, researcher_id, name, description, status, started_at, created_at, updated_at`,
        [researcher.id, name, description || "", interval]
      );
      const experiment = expResult.rows[0];

      // Vincula as slaves selecionadas (sem mudar status nem disparar MQTT — isso só no /start)
      if (Array.isArray(slaveIds) && slaveIds.length > 0) {
        await query(
          `UPDATE slaves SET experiment_id = $1 WHERE id = ANY($2::uuid[])`,
          [experiment.id, slaveIds]
        );
      }

      wsService.broadcast({
        type: "EXPERIMENT_CREATED",
        data: {
          id: experiment.id,
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          createdAt: experiment.created_at ? experiment.created_at.toISOString() : null,
          slaveIds: Array.isArray(slaveIds) ? slaveIds : [],
          researcher: { id: researcher.id, name: researcher.name, email: researcher.email },
        },
      });

      res.status(201).json({ id: experiment.id });
    } catch (error) {
      console.error("❌ [API] Erro ao criar experimento:", error);
      res.status(500).json({ error: "Erro interno ao criar experimento." });
    }
  });

  // --- POST /api/experiments/:id/slaves : (re)vincula a lista de slaves ao experimento ---
  app.post("/api/experiments/:id/slaves", async (req, res) => {
    try {
      const { id } = req.params;
      const { slaveIds } = req.body;

      if (!Array.isArray(slaveIds)) {
        res.status(400).json({ error: "slaveIds deve ser uma lista." });
        return;
      }

      // Desvincula slaves que saíram da seleção
      await query(
        `UPDATE slaves SET experiment_id = NULL
         WHERE experiment_id = $1 AND NOT (id = ANY($2::uuid[]))`,
        [id, slaveIds]
      );

      // Vincula as selecionadas
      if (slaveIds.length > 0) {
        await query(
          `UPDATE slaves SET experiment_id = $1 WHERE id = ANY($2::uuid[])`,
          [id, slaveIds]
        );
      }

      res.json({ ok: true, experimentId: id, slaveIds });
    } catch (error) {
      console.error("❌ [API] Erro ao vincular slaves:", error);
      res.status(500).json({ error: "Erro interno ao vincular slaves." });
    }
  });

  // --- PUT /api/experiments/:id/slaves/:slaveId/config : UPSERT das configs por sensor ---
  app.put("/api/experiments/:id/slaves/:slaveId/config", async (req, res) => {
    try {
      const { slaveId } = req.params;
      // Body esperado: objeto com chaves por sensor, ex:
      // { temperature: {targetValue, minLimit, maxLimit},
      //   agitation:   {targetValue, minLimit, maxLimit},
      //   od:          {targetValue, minLimit, maxLimit, feedPumpTime, wastePumpTime} }
      const body = req.body || {};

      for (const sensor of SENSOR_TYPES) {
        const cfg = body[sensor];
        if (cfg) {
          await upsertSensorConfig(slaveId, sensor, cfg);
        }
      }

      res.json({ ok: true, slaveId });
    } catch (error) {
      console.error("❌ [API] Erro ao salvar config da slave:", error);
      res.status(500).json({ error: "Erro interno ao salvar configurações." });
    }
  });

  // --- GET /api/experiments/:id/data?category=tp|do|rpm : histórico do InfluxDB ---
  app.get("/api/experiments/:id/data", async (req, res) => {
    try {
      const { id } = req.params;
      const category = String(req.query.category || "");
      const field = CATEGORY_TO_FIELD[category];

      if (!field) {
        res.status(400).json({ error: "category inválida. Use tp, do ou rpm." });
        return;
      }

      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      // O Influx tagueia por slave_id == hostname (ver writeReading no fluxo MQTT)
      const series = await Promise.all(
        slavesResult.rows.map(async (slave) => ({
          slaveId: slave.id,
          hostname: slave.hostname,
          points: await getHistoryByField(slave.hostname, field),
        }))
      );

      res.json({ experimentId: id, category, field, series });
    } catch (error) {
      console.error("❌ [API] Erro ao buscar dados do experimento:", error);
      res.status(500).json({ error: "Erro interno ao buscar dados do experimento." });
    }
  });

  // --- GET /api/experiments/:id/alerts : alertas persistidos/ativos do experimento ---
  app.get("/api/experiments/:id/alerts", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT a.id, a.slave_id, a.experiment_id, a.sensor, a.severity, a.message,
                a.value, a.threshold, a.resolved, a.resolved_at, a.timestamp,
                s.hostname
         FROM alerts a
         LEFT JOIN slaves s ON s.id = a.slave_id
         WHERE a.experiment_id = $1
         ORDER BY a.timestamp DESC`,
        [id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("❌ [API] Erro ao buscar alertas:", error);
      res.status(500).json({ error: "Erro interno ao buscar alertas." });
    }
  });

  // --- POST /api/experiments/:id/start : draft -> running + dispara MQTT ---
  app.post("/api/experiments/:id/start", async (req, res) => {
    try {
      const { id } = req.params;

      const expResult = await query(
        `UPDATE experiments
         SET status = 'running', started_at = NOW()
         WHERE id = $1
         RETURNING id, name, status, started_at`,
        [id]
      );

      if (expResult.rows.length === 0) {
        res.status(404).json({ error: "Experimento não encontrado." });
        return;
      }
      const experiment = expResult.rows[0];

      // Ativa as slaves vinculadas (config + intervalo + comando MQTT + broadcast)
      const activated = await startSlavesForExperiment(id, deps);

      wsService.broadcast({
        type: "EXPERIMENT_STARTED",
        data: {
          id: experiment.id,
          status: experiment.status,
          startedAt: experiment.started_at ? experiment.started_at.toISOString() : null,
        },
      });

      console.log(
        `🚀 [API] Experimento ${id} iniciado. ${activated} slave(s) ativada(s).`
      );
      res.json({ ok: true, id, status: experiment.status });
    } catch (error) {
      console.error("❌ [API] Erro ao iniciar experimento:", error);
      res.status(500).json({ error: "Erro interno ao iniciar experimento." });
    }
  });

  // --- POST /api/experiments/:id/pause : running -> paused (slaves param de publicar) ---
  app.post("/api/experiments/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;

      const expResult = await query(
        `UPDATE experiments SET status = 'paused'
         WHERE id = $1 AND status = 'running'
         RETURNING id, status`,
        [id]
      );

      if (expResult.rows.length === 0) {
        res.status(409).json({ error: "Experimento não está em execução." });
        return;
      }

      // Mantém o vínculo experiment_id (para retomar), apenas marca como idle e pausa a Pico.
      const slavesResult = await query(
        `UPDATE slaves SET status = 'idle' WHERE experiment_id = $1
         RETURNING id, hostname`,
        [id]
      );

      for (const slave of slavesResult.rows) {
        mqttService.publish(`projeto/comandos/${slave.hostname}`, {
          comando: "pausar_experimento",
        });

        wsService.broadcast({
          type: "SLAVE_STATUS_UPDATE",
          data: {
            id: slave.id,
            hostname: slave.hostname,
            status: "idle",
            lastSeen: new Date().toISOString(),
          },
        });
      }

      wsService.broadcast({ type: "EXPERIMENT_STATUS", data: { id, status: "paused" } });

      console.log(`⏸️ [API] Experimento ${id} pausado. ${slavesResult.rows.length} slave(s).`);
      res.json({ ok: true, id, status: "paused" });
    } catch (error) {
      console.error("❌ [API] Erro ao pausar experimento:", error);
      res.status(500).json({ error: "Erro interno ao pausar experimento." });
    }
  });

  // --- POST /api/experiments/:id/resume : paused -> running (reenvia iniciar) ---
  app.post("/api/experiments/:id/resume", async (req, res) => {
    try {
      const { id } = req.params;

      const expResult = await query(
        `UPDATE experiments SET status = 'running'
         WHERE id = $1 AND status = 'paused'
         RETURNING id, status`,
        [id]
      );

      if (expResult.rows.length === 0) {
        res.status(409).json({ error: "Experimento não está pausado." });
        return;
      }

      // Reativa as slaves (mesma rotina do /start: config + intervalo + comando MQTT)
      const activated = await startSlavesForExperiment(id, deps);

      wsService.broadcast({ type: "EXPERIMENT_STATUS", data: { id, status: "running" } });

      console.log(`▶️ [API] Experimento ${id} retomado. ${activated} slave(s) ativada(s).`);
      res.json({ ok: true, id, status: "running" });
    } catch (error) {
      console.error("❌ [API] Erro ao retomar experimento:", error);
      res.status(500).json({ error: "Erro interno ao retomar experimento." });
    }
  });

  // --- DELETE /api/experiments/:id : exclui experimento e libera slaves (movido do server.ts) ---
  app.delete("/api/experiments/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      for (const slave of slavesResult.rows) {
        await query(
          `UPDATE slaves SET experiment_id = NULL, status = 'idle' WHERE id = $1`,
          [slave.id]
        );

        mqttService.publish(`projeto/comandos/${slave.hostname}`, {
          comando: "parar_experimento",
        });

        wsService.broadcast({
          type: "SLAVE_HELLO",
          data: {
            id: slave.id,
            hostname: slave.hostname,
            ip: "Connected",
            timestamp: new Date().toISOString(),
          },
        });
      }

      await query(`DELETE FROM experiments WHERE id = $1`, [id]);

      wsService.broadcast({ type: "EXPERIMENT_DELETED", data: { id } });

      console.log(
        `🗑️ [API] Experimento ${id} excluído. ${slavesResult.rows.length} slave(s) liberado(s).`
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("❌ [API] Erro ao excluir experimento:", error);
      res.status(500).json({ error: "Erro interno ao excluir experimento." });
    }
  });
}
