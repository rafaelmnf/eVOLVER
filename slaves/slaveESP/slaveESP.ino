#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

// --- CONFIGURAÇÕES ---
const char* SSID_WIFI = "eMaster_Rede";
const char* SENHA_WIFI = "evolver_admin";
const char* IP_BROKER = "10.42.0.1";
const char* ARQUIVO_BUFFER = "/buffer_dados.txt";

String id_client;
String TOPICO;

// Pinos analógicos
const int sensor_temp = 34;
const int sensor_densidade = 35;

WiFiClient espClient;
PubSubClient client_mqtt(espClient);

// Conexão Wi-Fi
void wifiConection() {
    Serial.print("Conectando ao Wi-Fi...");
    WiFi.begin(SSID_WIFI, SENHA_WIFI);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }
    Serial.println("\nWi-Fi Conectado! IP: " + WiFi.localIP().toString());
}

void mqttConection() {
    while (!client_mqtt.connected() && WiFi.status() == WL_CONNECTED) {
        Serial.println("Tentando conexão ao Broker MQTT...");

        if (client_mqtt.connect(id_client.c_str())) {
            Serial.println("Conectado ao Broker MQTT");
        } else {
            Serial.print("Falha de conexão, rc = ");
            Serial.print(client_mqtt.state());
            delay(2000);
        }
    }
}

void saveOnBuffer(String json_data) {
    File arquivo = LittleFS.open(ARQUIVO_BUFFER, FILE_APPEND);
    if (!arquivo) {
        Serial.println("Erro fatal na memória Flash: Falha ao abrir para escrita");
        return;
    }
    arquivo.println(json_data);
    arquivo.close();
    Serial.print("Estado salvo na Flash: " + json_data + '\n');
}

void clearBuffer() {
    if (!LittleFS.exists(ARQUIVO_BUFFER)) {
        return;
    }
    Serial.println("Reconectado! Esvaziando buffer de dados atrasados...");
    File arquivo = LittleFS.open(ARQUIVO_BUFFER, FILE_READ);
    if (!arquivo) {
        Serial.println("Erro ao tentar abrir o buffer para leitura");
        return;
    }

    int packages = 0;
    while (arquivo.available()) {
        String data = arquivo.readStringUntil('\n');
        data.trim(); // Remove espaços em branco e o Enter

        if (data.length() > 0) {
            client_mqtt.publish(TOPICO.c_str(), data.c_str());
            delay(100);
            packages++;
        }
    }

    arquivo.close();
    Serial.printf("%d pacotes atrasados foram enviados com sucesso! \n", packages);

    LittleFS.remove(ARQUIVO_BUFFER);
    Serial.println("Buffer apagado. Espaco na Flash liberado");
}

void setup() {
    Serial.begin(115200);

    if (!LittleFS.begin(true)) {
        Serial.println("Erro ao montar o sistema de arquivos LittleFS");
        return;
    }

    uint64_t chipid = ESP.getEfuseMac();
    char id_str[25];
    snprintf(id_str, 25, "esp_32%04X%08X", (uint16_t)(chipid >> 32), (uint32_t)chipid);

    id_client = String(id_str);
    TOPICO = "projeto/sensores/" + id_client;

    wifiConection();
    client_mqtt.setServer(IP_BROKER, 1883);
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        WiFi.reconnect();
    }

    if (!client_mqtt.connected() && WiFi.status() == WL_CONNECTED) {
        mqttConection();
    }

    client_mqtt.loop();

    int leitura_t = analogRead(sensor_temp);
    int leitura_d = analogRead(sensor_densidade);

    float temperatura_real = (leitura_t / 4095.0)*100.0;
    float densidade_real = (leitura_d / 4095.0)*5.0;

    JsonDocument dados;

    dados["temp"] = round(temperatura_real * 100.0)/100.0;
    dados["densidade"] = round(densidade_real * 100.0)/100.0;

    String carga_json;
    serializeJson(dados, carga_json);

    if (client_mqtt.connected()) {
        clearBuffer();

        if(client_mqtt.publish(TOPICO.c_str(), carga_json.c_str())) {
            Serial.println("Enviado: " +carga_json);
        } else {
            Serial.println("Falha de envio de pacote");
            saveOnBuffer(carga_json);
        }
    } else {
        Serial.println("Falha geral detectada: Broker offline. Salvando no arquivo de emergência");
        saveOnBuffer(carga_json);
    }

    delay(5000);
}