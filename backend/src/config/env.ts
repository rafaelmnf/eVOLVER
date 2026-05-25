import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  mqttUrl: process.env.MQTT_URL || "mqtt://localhost:1883",
  // Serve static files from dist/public in production and development
  staticPath:
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "..", "public")
      : path.resolve(__dirname, "..", "..", "dist", "public"),
};
