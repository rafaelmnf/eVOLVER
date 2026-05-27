import { Server as HTTPServer } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";

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
