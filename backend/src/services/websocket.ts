import { Server as HTTPServer } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";

export class WebSocketService {
  private wss: WSServer | null = null;

  constructor(server: HTTPServer) {
    this.wss = new WSServer({ server });
    this.init();
  }

  private init() {
    console.log("[WebSocket Service] Initializing WebSocket Server...");
    
    this.wss?.on("connection", (ws) => {
      console.log(`🔌 [WebSocket Service] Client connected. Active clients: ${this.wss?.clients.size}`);

      // Optional: send connection confirmation to client
      ws.send(JSON.stringify({ type: "SYSTEM", message: "CONNECTED_TO_MASTER" }));

      ws.on("close", () => {
        console.log(`🔌 [WebSocket Service] Client disconnected. Active clients: ${this.wss?.clients.size}`);
      });
      
      ws.on("error", (err) => {
        console.error("❌ [WebSocket Service] Socket error:", err);
      });
    });
  }

  public broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.wss?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}
