import { createServer } from "http";
import { createApp } from "./app";
import { config } from "./config/env";
import { WebSocketService } from "./services/websocket";
import { MQTTService } from "./services/mqtt";

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // Initialize WebSockets and MQTT Services
  const wsService = new WebSocketService(server);
  const mqttService = new MQTTService();

  // Wire up MQTT reading events to WebSocket broadcasts
  mqttService.on("reading", (data) => {
    wsService.broadcast({
      type: "MQTT_READING",
      data,
    });
  });

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
