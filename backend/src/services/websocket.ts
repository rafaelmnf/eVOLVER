import { Server as HTTPServer } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { query } from "./db";
import { getSensorHistory } from "./influx";

// Criamos o WebSocketService (websocket.ts) para enviar essas leituras aos clientes Web em tempo real.
export class WebSocketService {
  private wss: WSServer | null = null;

  // O WSServer é o responsável por aceitar conexões de clientes.
  // Aqui a gente criou um construtor de objeto para ser usado em server.ts
  constructor(server: HTTPServer) {
    this.wss = new WSServer({ server });
    // configura o comportamento do servidor
    this.init();
  }

  private init() {
    console.log("[WebSocket Service] Initializing WebSocket Server...");
    
    this.wss?.on("connection", (ws) => {
      console.log(`🔌 [WebSocket Service] Client connected. Active clients: ${this.wss?.clients.size}`);

      // Optional: send connection confirmation to client
      ws.send(JSON.stringify({ type: "SYSTEM", message: "CONNECTED_TO_MASTER" }));

      // Fetch master status from database and send to client
      query("SELECT hostname, ip, status, last_sync FROM masters WHERE hostname = 'eMaster'")
        .then((result) => {
          const dbMaster = result.rows[0];
          ws.send(JSON.stringify({
            type: "INITIAL_MASTER",
            data: {
              hostname: dbMaster ? dbMaster.hostname : "eMaster",
              ip: dbMaster ? dbMaster.ip : "10.42.0.1",
              status: dbMaster ? dbMaster.status : "offline",
              lastSync: dbMaster && dbMaster.last_sync ? dbMaster.last_sync.toISOString() : "",
            }
          }));
        })
        .catch((err) => {
          console.error("❌ [WebSocket Service] Error fetching initial master from DB:", err);
        });

      // Fetch all slaves from database and send to client
      query("SELECT id, master_id, experiment_id, hostname, ip, status, last_seen FROM slaves ORDER BY created_at ASC")
        .then(async (result) => {
          const dbSlaves = result.rows;
          const slaves = await Promise.all(
            dbSlaves.map(async (slave) => {
              // Fetch history from InfluxDB
              const history = await getSensorHistory(slave.hostname);
              
              // Get last known sensor values from history if available
              const lastTemp = history.temperature.length > 0 
                ? history.temperature[history.temperature.length - 1].value 
                : 0;
              const lastOD = history.od.length > 0 
                ? history.od[history.od.length - 1].value 
                : 0;

              return {
                id: slave.id,
                hostname: slave.hostname,
                ip: slave.ip,
                status: slave.status,
                lastSeen: slave.last_seen ? slave.last_seen.toISOString() : new Date().toISOString(),
                experimentId: slave.experiment_id,
                alertCount: 0,
                sensors: {
                  temperature: {
                    value: lastTemp,
                    unit: "°C",
                    trend: "stable",
                    trendDelta: 0,
                    quality: slave.status === "offline" ? "error" : "excellent",
                    history: history.temperature.map((p: { value: number }) => p.value)
                  },
                  od: {
                    value: lastOD,
                    unit: "OD600",
                    trend: "stable",
                    trendDelta: 0,
                    quality: slave.status === "offline" ? "error" : "excellent",
                    history: history.od.map((p: { value: number }) => p.value)
                  },
                  agitation: {
                    value: 0,
                    unit: "RPM",
                    trend: "stable",
                    trendDelta: 0,
                    quality: slave.status === "offline" ? "error" : "excellent",
                    history: []
                  },
                },
              };
            })
          );

          ws.send(JSON.stringify({
            type: "INITIAL_SLAVES",
            data: slaves,
          }));
        })
        .catch((err) => {
          console.error("❌ [WebSocket Service] Error fetching initial slaves from DB:", err);
        });

      query(`
        SELECT e.id, e.name, e.description, e.status, e.started_at, e.ended_at, e.created_at, e.updated_at,
               u.id AS researcher_id, u.name AS researcher_name, u.email AS researcher_email,
               ARRAY_AGG(s.id) FILTER (WHERE s.id IS NOT NULL) AS slave_ids
        FROM experiments e
        LEFT JOIN users u ON u.id = e.researcher_id
        LEFT JOIN slaves s ON s.experiment_id = e.id
        GROUP BY e.id, u.id
        ORDER BY e.created_at DESC
      `)
        .then((result) => {
          const experiments = result.rows.map((row) => {
            const startedAt = row.started_at ? new Date(row.started_at) : null;
            let duration = "0h 0m";
            if (startedAt) {
              const now = new Date();
              const diffMs = now.getTime() - startedAt.getTime();
              const hours = Math.floor(diffMs / 3600000);
              const minutes = Math.floor((diffMs % 3600000) / 60000);
              duration = `${hours}h ${minutes}m`;
            }

            return {
              id: row.id,
              name: row.name,
              description: row.description || "",
              status: row.status,
              startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
              endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
              createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
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
          });

          ws.send(JSON.stringify({ type: "INITIAL_EXPERIMENTS", data: experiments }));
        })
        .catch((err) => {
          console.error("❌ [WebSocket Service] Error fetching initial experiments from DB:", err);
        });

      // Ouve o evento "close" e realiza a ação
      ws.on("close", () => {
        console.log(`🔌 [WebSocket Service] Client disconnected. Active clients: ${this.wss?.clients.size}`);
      });
      
      ws.on("error", (err) => {
        console.error("❌ [WebSocket Service] Socket error:", err);
      });
    });
  }

  /* Em vez do Frontend buscar os dados dos sensores chamando uma rota da API repetidas vezes, 
  o Frontend se conecta silenciosamente via WebSocket logo que a página carrega e apenas fica escutando
  o "alto-falante" (broadcast) do wsService cuspir os dados em tempo real quando o Raspberry Pi enviar pelo MQTT */
  public broadcast(data: any) {
    const payload = JSON.stringify(data); // Transforma em string, pois WebSockets transportam strings ou buffers (binários)

    // Passa por todos os clientes atualmente conectados
    this.wss?.clients.forEach((client) => {
      // Confirma se o cliente ainda está ativamente "aberto" para receber
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);  // Envia o dado
      }
    });
  }
}
