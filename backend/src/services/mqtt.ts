import mqtt, { MqttClient } from "mqtt";
import { EventEmitter } from "events";
import { config } from "../config/env";

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private topic = "projeto/sensores/#";

  public connect() {
    // Conecta a um broker MQTT EXISTENTE
    console.log(`[MQTT Service] Connecting to broker at ${config.mqttUrl}...`);
    this.client = mqtt.connect(config.mqttUrl);

    this.client.on("connect", () => {
      console.log("✅ [MQTT Service] Connected to Broker MQTT!");
      
      // Escuta o tópico
      this.client?.subscribe(this.topic, (err) => {
        if (!err) {
          console.log(`🎧 [MQTT Service] Listening to topic: ${this.topic}`);
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
        
        // Extract slave identifier from topic (e.g. "rasp5", "slave-001")
        const origem = topic.split("/").pop() || "unknown";

        console.log(`📥 [MQTT Service] [${origem.toUpperCase()}] Received:`);
        console.log(`   🌡️ Temp: ${dados.temp} °C | 🧪 OD: ${dados.densidade}`);

        // Emit typed event
        // Quando chega mensagem:
        // { "temp": 35.2, "densidade": 0.45 } no tópico "projeto/sensores/rasp5"
        // this.emit("reading", { origem: "rasp5", temp: 35.2, densidade: 0.45 })
        this.emit("reading", {
          origem,
          temp: typeof dados.temp === "number" ? dados.temp : parseFloat(dados.temp),
          densidade: typeof dados.densidade === "number" ? dados.densidade : parseFloat(dados.densidade),
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.warn(`⚠️ [MQTT Service] Invalid JSON on topic [${topic}]:`, message.toString());
      }
    });

    this.client.on("error", (err) => {
      console.error("❌ [MQTT Service] Connection error:", err);
    });
  }
}
