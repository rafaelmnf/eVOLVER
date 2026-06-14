import { createServer } from "http";
import { createApp } from "./app";
import { config } from "./config/env";
import { WebSocketService } from "./services/websocket";
import { MQTTService } from "./services/mqtt";
import { query } from "./services/db";
import { writeReading, getLatestReading } from "./services/influx";

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // Instancia os dois serviços
  const wsService = new WebSocketService(server);
  const mqttService = new MQTTService();

  /* Aqui interliga os dois serviços: 
     Ao criar um objeto mqttService, ele vem com o EventEmitter. Aqui ele usa dela para ouvir o alerta reading emitido ao receber os dados
     das raspberrys e repassa esse data usando a função criada broadcast para o frontend
  */ 
  mqttService.on("reading", async (data) => {
    try {
      // 1. Send data to InfluxDB
      await writeReading(data.origem, data.temp, data.densidade);

      // 2. Fetch the data back from InfluxDB to verify it is stored in database
      const dbReading = await getLatestReading(data.origem);
      
      const temp = dbReading ? dbReading.temperature : data.temp;
      const od = dbReading ? dbReading.od : data.densidade;
      const timestamp = dbReading ? dbReading.timestamp : new Date().toISOString();

      const isWarning = temp > 38.5 || temp < 30.0;
      const status = isWarning ? "warning" : "active";

      // 3. Upsert the slave in the PostgreSQL database
      const result = await query(
        `INSERT INTO slaves (hostname, ip, status, last_seen)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (hostname) DO UPDATE
         SET status = EXCLUDED.status,
             last_seen = EXCLUDED.last_seen
         RETURNING id, master_id, experiment_id, hostname, ip, status, last_seen`,
        [data.origem, "Connected", status]
      );
      
      const dbSlave = result.rows[0];

      // 4. Broadcast the data returned from database to all connected clients
      wsService.broadcast({
        type: "MQTT_READING",
        data: {
          origem: data.origem,
          temp,
          densidade: od,
          timestamp,
          id: dbSlave.id,
          status: dbSlave.status,
          experimentId: dbSlave.experiment_id,
        },
      });
    } catch (error) {
      console.error("❌ [Database Error] Error storing or retrieving slave reading:", error);
      
      // Fallback: broadcast anyway so real-time screen still functions
      wsService.broadcast({
        type: "MQTT_READING",
        data,
      });
    }
  });

  // Heartbeat check every 5 seconds to mark inactive slaves as offline
  setInterval(async () => {
    try {
      const timeoutThreshold = new Date(Date.now() - 15000);
      const result = await query(
        `UPDATE slaves
         SET status = 'offline'
         WHERE status != 'offline' AND last_seen < $1
         RETURNING id, hostname, ip, status, last_seen`,
        [timeoutThreshold]
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

  // Connect to the MQTT Broker
  mqttService.connect();

  server.listen(config.port, () => {
    console.log(`[eVOLVER Backend] Running in ${config.nodeEnv} mode at http://localhost:${config.port}/`);
  });

  // Graceful shutdown handlers
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
