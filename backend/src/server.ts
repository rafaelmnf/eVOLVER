import { createServer } from "http";
import path from "path";
import { createApp } from "./app";
import { config } from "./config/env";
import { WebSocketService } from "./services/websocket";
import { MQTTService } from "./services/mqtt";
import { query } from "./services/db";
import { writeReading, getLatestReading, getSensorHistory } from "./services/influx";

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  const wsService = new WebSocketService(server);
  const mqttService = new MQTTService();

  // Seed/ensure Master exists in PostgreSQL database
  try {
    await query(`
      INSERT INTO masters (hostname, ip, status)
      VALUES ('eMaster', '10.42.0.1', 'offline')
      ON CONFLICT (hostname) DO NOTHING
    `);
    console.log("✅ [Database Seed] eMaster ensured in PostgreSQL.");

    // Seed/ensure Researcher exists in database
    const userRes = await query(`
      INSERT INTO users (name, email, password_hash)
      VALUES ('Dr. Ana Lima', 'ana.lima@lab.br', 'mock_hash')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const mockUserId = userRes.rows[0]?.id;

    if (mockUserId) {
      // Seed mock experiments if table is empty
      const expCountRes = await query("SELECT COUNT(*) FROM experiments");
      if (parseInt(expCountRes.rows[0].count, 10) === 0) {
        // Insere experimentos mockados
        const e1 = await query(`
          INSERT INTO experiments (name, description, status, researcher_id, started_at)
          VALUES ('E. coli Growth Curve — LB Medium', 'Characterization of E. coli BL21 growth kinetics in LB medium at 37°C with IPTG induction at OD600 = 0.6.', 'running', $1, NOW() - INTERVAL '18 hours')
          RETURNING id
        `, [mockUserId]);
        const e2 = await query(`
          INSERT INTO experiments (name, description, status, researcher_id, started_at)
          VALUES ('S. cerevisiae Fermentation — YPD', 'Yeast fermentation optimization in YPD medium. Monitoring ethanol production and cell density.', 'running', $1, NOW() - INTERVAL '6 hours')
          RETURNING id
        `, [mockUserId]);
        await query(`
          INSERT INTO experiments (name, description, status, researcher_id, started_at)
          VALUES 
            ('CHO Cell Culture — Biopharmaceutical', 'CHO cell culture for recombinant protein production. Completed 72h run.', 'completed', $1, NOW() - INTERVAL '5 days'),
            ('Rascunho de Crescimento Microbiano', 'Ensaio piloto para calibração de sensores e bombas de alimentação.', 'draft', $1, NULL)
        `, [mockUserId]);
        console.log("✅ [Database Seed] Mock experiments created.");

        // Associa slaves aos experimentos ativos ou deixa disponíveis
        const masterRes = await query("SELECT id FROM masters WHERE hostname = 'eMaster'");
        const masterId = masterRes.rows[0]?.id;
        if (masterId) {
          const exp1Id = e1.rows[0]?.id;
          const exp2Id = e2.rows[0]?.id;
          await query(`
            INSERT INTO slaves (master_id, experiment_id, hostname, ip, status, last_seen)
            VALUES 
              ($1, $2, 'evolver-s01', '192.168.1.21', 'active', NOW() - INTERVAL '2 seconds'),
              ($1, $2, 'evolver-s02', '192.168.1.22', 'warning', NOW() - INTERVAL '5 seconds'),
              ($1, $3, 'evolver-s03', '192.168.1.23', 'active', NOW() - INTERVAL '1 seconds'),
              ($1, NULL, 'evolver-s04', '192.168.1.24', 'offline', NOW() - INTERVAL '8 minutes'),
              ($1, NULL, 'evolver-s07', '192.168.1.27', 'idle', NOW() - INTERVAL '1 seconds'),
              ($1, NULL, 'evolver-s08', '192.168.1.28', 'idle', NOW() - INTERVAL '1 seconds')
            ON CONFLICT (hostname) DO UPDATE SET
              experiment_id = EXCLUDED.experiment_id,
              status = EXCLUDED.status,
              last_seen = EXCLUDED.last_seen
          `, [masterId, exp1Id, exp2Id]);
          console.log("✅ [Database Seed] Mock slaves created & associated.");
        }
      }
    }
  } catch (err) {
    console.error("❌ [Database Seed] Error during database seeding:", err);
  }

  // --- ROTA: Listar experimentos ---
  app.get("/api/experiments", async (req, res) => {
    try {
      const result = await query(`
        SELECT e.id, e.researcher_id, e.name, e.description, e.status, e.started_at, e.ended_at, e.created_at, e.updated_at,
               u.name AS researcher_name, u.email AS researcher_email,
               COALESCE(ARRAY_AGG(s.id) FILTER (WHERE s.id IS NOT NULL), '{}') AS slave_ids
        FROM experiments e
        LEFT JOIN users u ON u.id = e.researcher_id
        LEFT JOIN slaves s ON s.experiment_id = e.id
        GROUP BY e.id, u.id
        ORDER BY e.created_at DESC
      `);
      res.json(result.rows.map((row) => {
        const startedAt = row.started_at ? new Date(row.started_at) : null;
        let duration = "0h 0m";
        if (startedAt) {
          const endedAt = row.ended_at ? new Date(row.ended_at) : new Date();
          const diffMs = endedAt.getTime() - startedAt.getTime();
          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          duration = `${hours}h ${minutes}m`;
        }
        return {
          id: row.id,
          researcher_id: row.researcher_id,
          name: row.name,
          description: row.description || "",
          status: row.status,
          started_at: row.started_at,
          ended_at: row.ended_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          duration,
          slaveIds: row.slave_ids || [],
          alertCount: 0,
          researcher: {
            id: row.researcher_id || "",
            name: row.researcher_name || "Pesquisador",
            email: row.researcher_email || "",
            avatar: row.researcher_name
              ? row.researcher_name.substring(0, 2).toUpperCase()
              : "??",
          },
        };
      }));
    } catch (err) {
      console.error("❌ [API] Erro ao listar experimentos:", err);
      res.status(500).json({ error: "Erro interno ao listar experimentos." });
    }
  });

  // --- ROTA: Criar experimento e notificar slaves via MQTT ---
  app.post("/api/experiments", async (req, res) => {
    try {
      const { name, description, slaveIds, researcherName, researcherEmail } = req.body;

      if (!name) {
        res.status(400).json({ error: "name é obrigatório." });
        return;
      }

      // Garante que o usuário existe no DB
      let researcherId = null;
      if (researcherName) {
        const email = researcherEmail || `${researcherName.toLowerCase().replace(/\s+/g, '')}@laboratorio.edu`;
        const userResult = await query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, 'mock_hash')
           ON CONFLICT (email) DO UPDATE SET name = $1
           RETURNING id`,
          [researcherName, email]
        );
        researcherId = userResult.rows[0]?.id;
      }

      // Insere o experimento no banco (com status 'draft' inicialmente)
      const expResult = await query(
        `INSERT INTO experiments (name, description, status, researcher_id, started_at)
         VALUES ($1, $2, 'draft', $3, NULL)
         RETURNING id, name, description, status, started_at, created_at, updated_at`,
        [name, description || "", researcherId]
      );
      const experiment = expResult.rows[0];

      // Se slaveIds foram passados, vincula
      if (Array.isArray(slaveIds) && slaveIds.length > 0) {
        for (const slaveId of slaveIds) {
          await query(
            `UPDATE slaves SET experiment_id = $1 WHERE id = $2`,
            [experiment.id, slaveId]
          );
        }
      }

      // Avisa o frontend do novo experimento
      wsService.broadcast({
        type: "EXPERIMENT_CREATED",
        data: {
          id: experiment.id,
          name: experiment.name,
          description: experiment.description,
          status: experiment.status,
          startedAt: experiment.started_at,
          createdAt: experiment.created_at,
          updatedAt: experiment.updated_at,
          slaveIds: slaveIds || [],
          researcher: {
            id: researcherId || "",
            name: researcherName || "Pesquisador",
            email: researcherEmail || "",
            avatar: researcherName ? researcherName.substring(0, 2).toUpperCase() : "??"
          },
        },
      });

      res.status(201).json({ id: experiment.id });
    } catch (error) {
      console.error("❌ [API] Erro ao criar experimento:", error);
      res.status(500).json({ error: "Erro interno ao criar experimento." });
    }
  });

  // --- ROTA: Excluir experimento e liberar slaves ---
  app.delete("/api/experiments/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Busca slaves vinculados antes de deletar
      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      // Libera cada slave e envia comando de parada via MQTT
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

      // Remove o experimento
      await query(`DELETE FROM experiments WHERE id = $1`, [id]);

      wsService.broadcast({ type: "EXPERIMENT_DELETED", data: { id } });

      console.log(`🗑️ [API] Experimento ${id} excluído. ${slavesResult.rows.length} slave(s) liberado(s).`);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("❌ [API] Erro ao excluir experimento:", error);
      res.status(500).json({ error: "Erro interno ao excluir experimento." });
    }
  });

  // --- ROTA: Listar slaves disponíveis ---
  app.get("/api/slaves", async (req, res) => {
    try {
      const result = await query(
        "SELECT id, master_id, experiment_id, hostname, ip, status, last_seen FROM slaves ORDER BY created_at ASC"
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ [API] Erro ao buscar slaves:", err);
      res.status(500).json({ error: "Erro interno ao buscar slaves." });
    }
  });

  // --- ROTA: Vincular slaves ao experimento ---
  app.post("/api/experiments/:id/slaves", async (req, res) => {
    try {
      const { id } = req.params;
      const { slaveIds } = req.body;

      if (!Array.isArray(slaveIds)) {
        res.status(400).json({ error: "slaveIds deve ser uma array." });
        return;
      }

      // 1. Fetch current experiment status and currently linked slaves
      const expRes = await query("SELECT status FROM experiments WHERE id = $1", [id]);
      const experiment = expRes.rows[0];
      if (!experiment) {
        res.status(404).json({ error: "Experimento não encontrado." });
        return;
      }
      const currentStatus = experiment.status;

      const currentSlavesRes = await query("SELECT id, hostname FROM slaves WHERE experiment_id = $1", [id]);
      const currentSlaves = currentSlavesRes.rows;
      const currentSlaveIds = currentSlaves.map(s => s.id);

      const addedSlaveIds = slaveIds.filter(sid => !currentSlaveIds.includes(sid));
      const removedSlaveIds = currentSlaveIds.filter(sid => !slaveIds.includes(sid));

      // 2. Process removed slaves
      for (const slaveId of removedSlaveIds) {
        const slave = currentSlaves.find(s => s.id === slaveId);
        if (slave) {
          await query(`UPDATE slaves SET experiment_id = NULL, status = 'idle' WHERE id = $1`, [slaveId]);
          mqttService.publish(`projeto/comandos/${slave.hostname}`, {
            comando: "parar_experimento",
          });
          console.log(`🔌 [Slaves Link] Removed slave ${slave.hostname} from experiment ${id}. Sent parar_experimento.`);
        }
      }

      // 3. Process added slaves
      for (const slaveId of addedSlaveIds) {
        await query(`UPDATE slaves SET experiment_id = $1 WHERE id = $2`, [id, slaveId]);
        
        const slaveRes = await query("SELECT id, hostname FROM slaves WHERE id = $1", [slaveId]);
        const slave = slaveRes.rows[0];

        if (slave) {
          if (currentStatus === "running" || currentStatus === "paused") {
            await query(`UPDATE slaves SET status = 'active' WHERE id = $1`, [slaveId]);

            const configRes = await query(
              `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
               FROM slave_sensor_configs
               WHERE slave_id = $1`,
              [slaveId]
            );

            const topico = `projeto/comandos/${slave.hostname}`;
            if (currentStatus === "running") {
              mqttService.publish(topico, {
                comando: "iniciar_experimento",
                experimentId: id,
                configs: configRes.rows
              });
              console.log(`📡 [MQTT] Comando iniciar_experimento c/ configs enviado para ${topico} (Novo slave vinculado)`);
            } else {
              mqttService.publish(topico, {
                comando: "pausar_experimento",
                experimentId: id
              });
              console.log(`📡 [MQTT] Comando pausar_experimento enviado para ${topico} (Novo slave vinculado em exp pausado)`);
            }
          }
        }
      }

      // Avisa via WebSocket
      wsService.broadcast({
        type: "SLAVES_LINKED",
        data: { experimentId: id, slaveIds }
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ [API] Erro ao vincular slaves ao experimento:", err);
      res.status(500).json({ error: "Erro interno ao vincular slaves." });
    }
  });

  // --- ROTA: Salvar configuração de uma slave (limites + sensores) ---
  app.put("/api/experiments/:id/slaves/:slaveId/config", async (req, res) => {
    try {
      const { slaveId } = req.params;
      const { configs } = req.body; // array de { sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time }

      if (!Array.isArray(configs)) {
        res.status(400).json({ error: "configs deve ser uma array." });
        return;
      }

      for (const cfg of configs) {
        const { sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time } = cfg;
        await query(
          `INSERT INTO slave_sensor_configs (slave_id, sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (slave_id, sensor) DO UPDATE SET
             target_value = EXCLUDED.target_value,
             min_limit = EXCLUDED.min_limit,
             max_limit = EXCLUDED.max_limit,
             feed_pump_time = EXCLUDED.feed_pump_time,
             waste_pump_time = EXCLUDED.waste_pump_time,
             updated_at = CURRENT_TIMESTAMP`,
          [slaveId, sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time]
        );
      }

      // Busca o hostname do slave
      const slaveResult = await query("SELECT hostname FROM slaves WHERE id = $1", [slaveId]);
      const hostname = slaveResult.rows[0]?.hostname;

      // Se o experimento já estiver 'running', envia as atualizações via MQTT imediatamente
      const expResult = await query(
        `SELECT status FROM experiments WHERE id = (SELECT experiment_id FROM slaves WHERE id = $1)`,
        [slaveId]
      );
      const isRunning = expResult.rows[0]?.status === "running";

      if (hostname && isRunning) {
        mqttService.publish(`projeto/comandos/${hostname}`, {
          comando: "atualizar_configuracao",
          configs
        });
        console.log(`📡 [MQTT] Configurações atualizadas publicadas para ${hostname}`);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("❌ [API] Erro ao salvar configuração do slave:", err);
      res.status(500).json({ error: "Erro interno ao salvar configuração." });
    }
  });

  // --- ROTA: Obter configurações salvas de uma slave ---
  app.get("/api/slaves/:slaveId/config", async (req, res) => {
    try {
      const { slaveId } = req.params;
      const result = await query(
        `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
         FROM slave_sensor_configs
         WHERE slave_id = $1`,
        [slaveId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ [API] Erro ao obter configurações do slave:", err);
      res.status(500).json({ error: "Erro interno ao obter configurações." });
    }
  });

  // --- ROTA: Dados do dashboard filtrados por categoria ---
  app.get("/api/experiments/:id/data", async (req, res) => {
    try {
      const { id } = req.params;
      const { category } = req.query;

      const slavesResult = await query(
        "SELECT id, hostname FROM slaves WHERE experiment_id = $1",
        [id]
      );

      const responseData: Record<string, any[]> = {};

      for (const slave of slavesResult.rows) {
        const history = await getSensorHistory(slave.hostname);
        if (category === "tp") {
          responseData[slave.id] = history.temperature;
        } else if (category === "do") {
          responseData[slave.id] = history.od;
        } else if (category === "rpm") {
          // O RPM não está no InfluxDB, geramos histórico mockado consistente
          const configRes = await query(
            "SELECT target_value FROM slave_sensor_configs WHERE slave_id = $1 AND sensor = 'agitation'",
            [slave.id]
          );
          const target = parseFloat(configRes.rows[0]?.target_value || "200");
          responseData[slave.id] = Array.from({ length: 20 }, (_, idx) => {
            const time = new Date(Date.now() - (20 - idx) * 60000).toISOString();
            const noise = (Math.random() - 0.5) * 5;
            return {
              timestamp: time,
              value: target + noise
            };
          });
        } else {
          // Default
          responseData[slave.id] = [
            { sensor: "temperature", points: history.temperature },
            { sensor: "od", points: history.od }
          ];
        }
      }

      res.json(responseData);
    } catch (err) {
      console.error("❌ [API] Erro ao obter dados do dashboard:", err);
      res.status(500).json({ error: "Erro interno ao obter dados." });
    }
  });

  // --- ROTA: Alertas do experimento ---
  app.get("/api/experiments/:id/alerts", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT a.id, a.slave_id, s.hostname AS slave_name, a.experiment_id, a.sensor, a.severity, a.message, a.value, a.threshold, a.timestamp, a.resolved, a.resolved_at
         FROM alerts a
         JOIN slaves s ON s.id = a.slave_id
         WHERE a.experiment_id = $1
         ORDER BY a.timestamp DESC`,
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ [API] Erro ao buscar alertas do experimento:", err);
      res.status(500).json({ error: "Erro interno ao buscar alertas." });
    }
  });

  // --- ROTA: Iniciar experimento (Run) ---
  app.post("/api/experiments/:id/start", async (req, res) => {
    try {
      const { id } = req.params;

      // Altera o status do experimento para running
      const expResult = await query(
        `UPDATE experiments SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      const experiment = expResult.rows[0];
      if (!experiment) {
        res.status(404).json({ error: "Experimento não encontrado." });
        return;
      }

      // Busca slaves vinculados
      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      const slaveIds = [];
      for (const slave of slavesResult.rows) {
        slaveIds.push(slave.id);

        // Atualiza status do slave para active
        await query(
          `UPDATE slaves SET status = 'active' WHERE id = $1`,
          [slave.id]
        );

        // Carrega configurações daquele slave para enviar via MQTT
        const configRes = await query(
          `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
           FROM slave_sensor_configs
           WHERE slave_id = $1`,
          [slave.id]
        );

        // Publica comando MQTT
        const topico = `projeto/comandos/${slave.hostname}`;
        mqttService.publish(topico, {
          comando: "iniciar_experimento",
          experimentId: experiment.id,
          configs: configRes.rows
        });
        console.log(`📡 [MQTT] Comando iniciar_experimento c/ configs enviado para ${topico}`);
      }

      // Broadcast WebSocket
      wsService.broadcast({
        type: "EXPERIMENT_STARTED",
        data: {
          id: experiment.id,
          status: experiment.status,
          startedAt: experiment.started_at,
          slaveIds
        }
      });

      res.json({ ok: true, status: experiment.status });
    } catch (err) {
      console.error("❌ [API] Erro ao iniciar experimento:", err);
      res.status(500).json({ error: "Erro interno ao iniciar experimento." });
    }
  });

  // --- ROTA: Pausar experimento ---
  app.post("/api/experiments/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;
      const expResult = await query(
        `UPDATE experiments SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      const experiment = expResult.rows[0];
      if (!experiment) {
        res.status(404).json({ error: "Experimento não encontrado." });
        return;
      }

      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      for (const slave of slavesResult.rows) {
        mqttService.publish(`projeto/comandos/${slave.hostname}`, {
          comando: "pausar_experimento",
          experimentId: id
        });
      }

      wsService.broadcast({
        type: "EXPERIMENT_UPDATED",
        data: {
          id: experiment.id,
          status: experiment.status,
          slaveIds: slavesResult.rows.map((s) => s.id)
        }
      });

      res.json({ ok: true, status: experiment.status });
    } catch (err) {
      console.error("❌ [API] Erro ao pausar experimento:", err);
      res.status(500).json({ error: "Erro interno ao pausar experimento." });
    }
  });

  // --- ROTA: Retomar experimento ---
  app.post("/api/experiments/:id/resume", async (req, res) => {
    try {
      const { id } = req.params;
      const expResult = await query(
        `UPDATE experiments SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
      );
      const experiment = expResult.rows[0];
      if (!experiment) {
        res.status(404).json({ error: "Experimento não encontrado." });
        return;
      }

      const slavesResult = await query(
        `SELECT id, hostname FROM slaves WHERE experiment_id = $1`,
        [id]
      );

      for (const slave of slavesResult.rows) {
        const configRes = await query(
          `SELECT sensor, target_value, min_limit, max_limit, feed_pump_time, waste_pump_time
           FROM slave_sensor_configs
           WHERE slave_id = $1`,
          [slave.id]
        );

        mqttService.publish(`projeto/comandos/${slave.hostname}`, {
          comando: "retomar_experimento",
          experimentId: id,
          configs: configRes.rows
        });
      }

      wsService.broadcast({
        type: "EXPERIMENT_UPDATED",
        data: {
          id: experiment.id,
          status: experiment.status,
          slaveIds: slavesResult.rows.map((s) => s.id)
        }
      });

      res.json({ ok: true, status: experiment.status });
    } catch (err) {
      console.error("❌ [API] Erro ao retomar experimento:", err);
      res.status(500).json({ error: "Erro interno ao retomar experimento." });
    }
  });

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
      await writeReading(data.origem, data.temp, data.densidade);

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
