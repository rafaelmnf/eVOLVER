// lê variáveis de ambiente e fornece valores padrão:
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  // 10.42.0.1 Esse é o IP da Raspberry Pi onde vai rodar o mosquitto (Broker MQTT)
  mqttUrl: process.env.MQTT_URL || "mqtt://10.42.0.1:1883",
  // Serve static files from dist/public in production and development
  staticPath:
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "..", "public")
      : path.resolve(__dirname, "..", "..", "dist", "public"),
};
