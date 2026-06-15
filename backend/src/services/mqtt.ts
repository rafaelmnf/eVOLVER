import mqtt, { MqttClient } from "mqtt";
import { EventEmitter } from "events";
import { config } from "../config/env";

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private topicSensores = "projeto/sensores/#";
  private topicStatus   = "projeto/status/#";

  public connect() {
    console.log(`[MQTT Service] Connecting to broker at ${config.mqttUrl}...`);
    this.client = mqtt.connect(config.mqttUrl, {
      reconnectPeriod: 5000,
    });

    this.client.on("connect", () => {
      console.log("✅ [MQTT Service] Connected to Broker MQTT!");
      this.emit("status", "active");

      this.client!.subscribe([this.topicSensores, this.topicStatus], (err) => {
        if (!err) {
          console.log(`🎧 [MQTT Service] Listening to: ${this.topicSensores} | ${this.topicStatus}`);
          console.log("⏳ [MQTT Service] Waiting for Raspberry data...\n");
        } else {
          console.error("❌ [MQTT Service] Subscription error:", err);
        }
      });
    });

    this.client.on("message", (topic, message) => {
      try {
        const payloadString = message.toString();
        const dados = JSON.parse(payloadString);
        const origem = topic.split("/").pop() || "unknown";

        // Tópico de status: HELLO da plaquinha anunciando presença ociosa
        if (topic.startsWith("projeto/status/")) {
          if (dados.tipo === "HELLO") {
            console.log(`👋 [MQTT Service] HELLO de [${dados.id || origem}]`);
            this.emit("hello", {
              id: dados.id || origem,
              hostname: dados.id || origem,
              timestamp: new Date().toISOString(),
            });
          }
          return;
        }

        // Tópico de sensores: leitura em tempo real (só quando vinculado a experimento)
        console.log(`📥 [MQTT Service] [${origem.toUpperCase()}] Received:`);
        console.log(`   🌡️ Temp: ${dados.temp} °C | 🧪 OD: ${dados.densidade} | 🔄 RPM: ${dados.rotacao ?? "—"}`);

        this.emit("reading", {
          origem,
          temp: typeof dados.temp === "number" ? dados.temp : parseFloat(dados.temp),
          densidade: typeof dados.densidade === "number" ? dados.densidade : parseFloat(dados.densidade),
          rotacao: dados.rotacao !== undefined
            ? (typeof dados.rotacao === "number" ? dados.rotacao : parseFloat(dados.rotacao))
            : undefined,
          experimentId: dados.experimentId ?? null,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        console.warn(`⚠️ [MQTT Service] Invalid JSON on topic [${topic}]:`, message.toString());
      }
    });

    this.client.on("offline", () => {
      this.emit("status", "offline");
    });

    this.client.on("close", () => {
      this.emit("status", "offline");
    });

    this.client.on("error", (err: Error) => {
      console.error("❌ [MQTT Service] Connection error:", err.message);
      this.emit("status", "offline");
    });
  }

  // Publica um comando para um slave específico (ex: iniciar/parar experimento)
  public publish(topic: string, payload: object) {
    if (!this.client?.connected) {
      console.warn(`⚠️ [MQTT Service] Cannot publish to ${topic}: not connected.`);
      return;
    }
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }
}
