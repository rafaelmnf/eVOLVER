import { Server as HTTPServer } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { query } from "./db";

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

      // Fetch all slaves from database and send to client
      query("SELECT id, master_id, experiment_id, hostname, ip, status, last_seen FROM slaves ORDER BY created_at ASC")
        .then((result) => {
          const dbSlaves = result.rows;
          const slaves = dbSlaves.map((slave) => ({
            id: slave.id,
            hostname: slave.hostname,
            ip: slave.ip,
            status: slave.status,
            lastSeen: slave.last_seen ? slave.last_seen.toISOString() : new Date().toISOString(),
            experimentId: slave.experiment_id,
            alertCount: 0,
            sensors: {
              temperature: { value: 0, unit: "°C", trend: "stable", trendDelta: 0, quality: slave.status === "offline" ? "error" : "excellent", history: [] },
              ph: { value: 7.0, unit: "pH", trend: "stable", trendDelta: 0, quality: slave.status === "offline" ? "error" : "excellent", history: [] },
              od: { value: 0, unit: "OD600", trend: "stable", trendDelta: 0, quality: slave.status === "offline" ? "error" : "excellent", history: [] },
              agitation: { value: 0, unit: "RPM", trend: "stable", trendDelta: 0, quality: slave.status === "offline" ? "error" : "excellent", history: [] },
            },
          }));

          ws.send(JSON.stringify({
            type: "INITIAL_SLAVES",
            data: slaves,
          }));
        })
        .catch((err) => {
          console.error("❌ [WebSocket Service] Error fetching initial slaves from DB:", err);
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
