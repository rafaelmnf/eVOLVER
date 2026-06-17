import { createServer } from "http";
import path from "path";
import { createApp } from "./app";
import { config } from "./config/env";
import { WebSocketService } from "./services/websocket";
import { MQTTService } from "./services/mqtt";
import { query } from "./services/db";
import { writeReading, getLatestReading } from "./services/influx";
import { runMigrations } from "./config/migrate";
import { registerExperimentRoutes } from "./routes/experiments";
import { registerSlaveRoutes } from "./routes/slaves";
import { registerAuthRoutes } from "./routes/authRoutes";

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  const wsService = new WebSocketService(server);
  const mqttService = new MQTTService();

  // Garante alterações de schema em bancos já existentes (idempotente)
  await runMigrations();

  // Seed/ensure Master exists in PostgreSQL database
  try {
    await query(`
      INSERT INTO masters (hostname, ip, status)
      VALUES ('eMaster', '10.42.0.1', 'offline')
      ON CONFLICT (hostname) DO NOTHING
    `);
    console.log("✅ [Database Seed] eMaster ensured in PostgreSQL.");
  } catch (err) {
    console.error("❌ [Database Seed] Error seeding eMaster:", err);
  }

  // --- ROTAS DE API ---
  // Registradas antes do fallback SPA. As instâncias de WS/MQTT são injetadas
  // para que as rotas possam fazer broadcast e publicar comandos.
  registerAuthRoutes(app);
  registerSlaveRoutes(app);
  registerExperimentRoutes(app, { wsService, mqttService });

  let lastMqttStatus: string | null = null;

  mqttService.on("status", async (status) => {
    if (status === lastMqttStatus) return;
    lastMqttStatus = status;

    try {
      console.log(`🔌 [MQTT Service] Status changed to: ${status}`);

      await query(
        `UPDATE masters
         SET status = $1::device_status,
             online_since = CASE WHEN $1::device_status = 'active'::device_status THEN NOW() ELSE online_since END,
             last_sync = NOW()
         WHERE hostname = 'eMaster'`,
        [status]
      );

      if (status === "offline") {
        await query(`UPDATE slaves SET status = 'offline'`);
        console.log("🔌 [MQTT Service] Set all slaves to offline in DB due to Master disconnection.");
      }

      wsService.broadcast({
        type: "MASTER_STATUS_UPDATE",
        data: { hostname: "eMaster", status, slavesOffline: status === "offline" },
      });
    } catch (error) {
      console.error("❌ [Database Error] Error updating master status:", error);
    }
  });

  // Plaquinha conectou — verifica se já pertencia a um experimento ativo
  mqttService.on("hello", async (data) => {
    try {
      // Busca o slave existente no banco para ver se tem experimento pendente
      const existing = await query(
        `SELECT s.id, s.hostname, s.ip, s.experiment_id, e.status AS exp_status
         FROM slaves s
         LEFT JOIN experiments e ON e.id = s.experiment_id
         WHERE s.hostname = $1`,
        [data.hostname]
      );

      const prev = existing.rows[0];
      const hasActiveExperiment = prev?.experiment_id && prev?.exp_status === "running";

      if (hasActiveExperiment) {
        // Reconexão durante experimento: atualiza last_seen e reenvia o comando
        await query(
          `UPDATE slaves SET status = 'active', last_seen = NOW() WHERE hostname = $1`,
          [data.hostname]
        );

        const topico = `projeto/comandos/${data.hostname}`;
        mqttService.publish(topico, {
          comando: "iniciar_experimento",
          experimentId: prev.experiment_id,
        });

        console.log(`🔄 [MQTT HELLO] Slave '${data.hostname}' reconectou ao experimento ${prev.experiment_id} → comando reenviado.`);

        wsService.broadcast({
          type: "SLAVE_STATUS_UPDATE",
          data: {
            id: prev.id,
            hostname: prev.hostname,
            status: "active",
            lastSeen: new Date().toISOString(),
          },
        });
      } else {
        // Sem experimento ativo: registra como idle normalmente
        const result = await query(
          `INSERT INTO slaves (hostname, master_id, ip, status, last_seen)
           VALUES ($1, (SELECT id FROM masters WHERE hostname = 'eMaster' LIMIT 1), $2, 'idle', NOW())
           ON CONFLICT (hostname) DO UPDATE
           SET status = 'idle',
               last_seen = NOW()
           RETURNING id, hostname, ip, status, last_seen`,
          [data.hostname, "Connected"]
        );

        const dbSlave = result.rows[0];
        console.log(`👋 [MQTT HELLO] Slave '${data.hostname}' registrado como idle no DB.`);

        wsService.broadcast({
          type: "SLAVE_HELLO",
          data: {
            id: dbSlave.id,
            hostname: dbSlave.hostname,
            ip: dbSlave.ip,
            timestamp: dbSlave.last_seen ? dbSlave.last_seen.toISOString() : data.timestamp,
          },
        });
      }
    } catch (error) {
      console.error("❌ [HELLO Error] Erro ao registrar slave:", error);
    }
  });

  mqttService.on("reading", async (data) => {
    try {
      await writeReading(data.origem, data.temp, data.densidade, data.rotacao);

      const dbReading = await getLatestReading(data.origem);

      const temp = dbReading ? dbReading.temperature : data.temp;
      const od = dbReading ? dbReading.od : data.densidade;
      const timestamp = dbReading ? dbReading.timestamp : new Date().toISOString();

      const isWarning = temp > 38.5 || temp < 30.0;
      const status = isWarning ? "warning" : "active";

      const result = await query(
        `INSERT INTO slaves (hostname, master_id, ip, status, last_seen)
         VALUES ($1, (SELECT id FROM masters WHERE hostname = 'eMaster' LIMIT 1), $2, $3, NOW())
         ON CONFLICT (hostname) DO UPDATE
         SET status = CASE
               WHEN slaves.status IN ('idle', 'offline') THEN slaves.status
               ELSE EXCLUDED.status
             END,
             last_seen = EXCLUDED.last_seen
         RETURNING id, master_id, experiment_id, hostname, ip, status, last_seen`,
        [data.origem, "Connected", status]
      );

      const dbSlave = result.rows[0];

      wsService.broadcast({
        type: "MQTT_READING",
        data: {
          origem: data.origem,
          temp,
          densidade: od,
          rotacao: data.rotacao,
          timestamp,
          id: dbSlave.id,
          status: dbSlave.status,
          experimentId: dbSlave.experiment_id,
        },
      });
    } catch (error) {
      console.error("❌ [Database Error] Error storing or retrieving slave reading:", error);
      wsService.broadcast({ type: "MQTT_READING", data });
    }
  });

  // Heartbeat a cada 5s:
  // - 'active'/'warning' sem dados por 15s → offline
  // - 'idle' sem HELLO por 30s → offline (plaquinha foi desligada)
  setInterval(async () => {
    try {
      const threshold15s = new Date(Date.now() - 15000);
      const threshold20s = new Date(Date.now() - 20000);

      const result = await query(
        `UPDATE slaves
         SET status = 'offline'
         WHERE (status IN ('active', 'warning') AND last_seen < $1)
            OR (status = 'idle' AND last_seen < $2)
         RETURNING id, hostname, ip, last_seen`,
        [threshold15s, threshold20s]
      );

      if (result.rows.length > 0) {
        console.log(`🔌 [Heartbeat] Set ${result.rows.length} slave(s) to offline due to timeout.`);
        result.rows.forEach((slave) => {
          wsService.broadcast({
            type: "SLAVE_STATUS_UPDATE",
            data: {
              id: slave.id,
              hostname: slave.hostname,
              status: "offline",
              lastSeen: slave.last_seen ? slave.last_seen.toISOString() : new Date().toISOString(),
            },
          });
        });
      }
    } catch (error) {
      console.error("❌ [Heartbeat] Error checking offline slaves:", error);
    }
  }, 5000);

  // Fallback SPA — deve vir depois de todas as rotas da API
  app.get("*", (_req, res) => {
    res.sendFile(path.join(config.staticPath, "index.html"));
  });

  mqttService.connect();

  server.listen(config.port, () => {
    console.log(`[eVOLVER Backend] Running in ${config.nodeEnv} mode at http://localhost:${config.port}/`);
  });

  const handleExit = (signal: string) => {
    console.log(`\n[eVOLVER Backend] Received ${signal}. Closing HTTP server...`);
    server.close(() => {
      console.log("[eVOLVER Backend] HTTP server closed. Exiting process.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => handleExit("SIGINT"));
  process.on("SIGTERM", () => handleExit("SIGTERM"));
}

startServer().catch((error) => {
  console.error("[eVOLVER Backend] Failed to start server:", error);
  process.exit(1);
});
