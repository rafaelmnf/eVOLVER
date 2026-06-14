import mqtt, { MqttClient } from "mqtt";
import { EventEmitter } from "events";
import { config } from "../config/env";

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private topic = "projeto/sensores/#";
  private lastErrorMsg: string | null = null;

  public connect() {
    // Conecta a um broker MQTT EXISTENTE
    console.log(`[MQTT Service] Connecting to broker at ${config.mqttUrl}...`);
    // config.mqttUrl tem "mqtt://localhost:1883"
    this.client = mqtt.connect(config.mqttUrl, {
      reconnectPeriod: 5000,
    });

    this.client.on("connect", () => {
      console.log("✅ [MQTT Service] Connected to Broker MQTT!");
      this.lastErrorMsg = null;
      this.emit("status", "active");

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

    /* Toda vez que o Raspberry Pi publica uma mensagem lá no broker, o broker manda essa mensagem pra cá. 
    O arquivo recebe, transforma o dado cru em um objeto de fácil leitura (JSON), descobre quem 
    enviou (extraindo o final do tópico, ex: rasp5), formata os dados e avisa o restante do sistema. */
    this.client.on("message", (topic, message) => {
      try {
        // A mensagem chega crua e transforma em JSON
        const payloadString = message.toString();
        const dados = JSON.parse(payloadString);

        // Extract slave identifier from topic (e.g. "rasp5", "slave-001")
        const origem = topic.split("/").pop() || "unknown";

        console.log(`📥 [MQTT Service] [${origem.toUpperCase()}] Received:`);
        console.log(`   🌡️ Temp: ${dados.temp} °C | 🧪 OD: ${dados.densidade}`);

        // Quando chega mensagem: { "temp": 35.2, "densidade": 0.45 } no tópico "projeto/sensores/rasp5"
        // this.emit("reading", { origem: "rasp5", temp: 35.2, densidade: 0.45 })
        // Aqui está usando a extensão da classe atual EventEmitter para poder emitir alertas (eventos).
        // Ele permite que outros arquivos se "inscrevam" para ouvir esse grito, usando o método .on()
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

    this.client.on("offline", () => {
      this.emit("status", "offline");
    });

    this.client.on("close", () => {
      this.emit("status", "offline");
    });

    this.client.on("error", (err) => {
      if (err.message !== this.lastErrorMsg) {
        console.error("❌ [MQTT Service] Connection error:", err.message);
        this.lastErrorMsg = err.message;
      }
      this.emit("status", "offline");
    });
  }
}
