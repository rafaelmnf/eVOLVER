import network
import time
import json
import machine
import ubinascii
import os  # <-- NOVA BIBLIOTECA: Gerencia arquivos na memória Flash
from umqtt.robust import MQTTClient 

dna_placa = ubinascii.hexlify(machine.unique_id()).decode('utf-8')
ID_CLIENTE = f"rasp_{dna_placa}"

# --- CONFIGURAÇÕES ---
SSID_WIFI = "eMaster_Rede"
SENHA_WIFI = "evolver_admin"
IP_BROKER = "10.42.0.1"
TOPICO = f"projeto/sensores/{ID_CLIENTE}" 
ARQUIVO_BUFFER = "buffer_dados.txt" # Nome do arquivo que vai guardar os dados offline

# Pinos Analógicos
sensor_temp = machine.ADC(26) 
sensor_densidade = machine.ADC(27)

# --- 1. CONECTANDO AO WI-FI ---
def conectar_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID_WIFI, SENHA_WIFI)
    print("Conectando ao Wi-Fi...")
    while not wlan.isconnected():
        time.sleep(1)
    print("✅ Wi-Fi Conectado! IP:", wlan.ifconfig()[0])

conectar_wifi()

# --- 2. CONECTANDO AO BROKER MQTT ---
cliente_mqtt = MQTTClient(ID_CLIENTE, IP_BROKER)
cliente_mqtt.connect() 
print("✅ Conectado ao Broker MQTT (Modo Robusto)!")

# --- 3. FUNÇÕES DE BLINDAGEM (BUFFER LOCAL) ---
def salvar_no_buffer(dado_json):
    """Abre o arquivo, pula para a última linha, escreve o dado e fecha."""
    try:
        # O parâmetro 'a' (Append) garante que não vamos apagar os dados anteriores
        with open(ARQUIVO_BUFFER, 'a') as arquivo:
            arquivo.write(dado_json + '\n')
        print(f"💾 Salvo na Flash: {dado_json}")
    except Exception as e:
        print(f"❌ Erro fatal na memória Flash: {e}")

def enviar_buffer_acumulado():
    """Lê todos os dados atrasados, envia para a Master e apaga o arquivo."""
    try:
        # Tenta checar se o arquivo existe. Se der erro, ele não existe (não tem dados atrasados)
        try:
            os.stat(ARQUIVO_BUFFER)
        except OSError:
            return 
            
        print("🔄 Conexão estável! Esvaziando buffer de dados atrasados...")
        
        # Modo 'r' (Read) para ler o arquivo inteiro
        with open(ARQUIVO_BUFFER, 'r') as arquivo:
            linhas = arquivo.readlines()

        if linhas:
            for linha in linhas:
                dado = linha.strip() # Tira os espaços em branco e o "Enter" invisível
                if dado:
                    # Envia o dado antigo para o Broker
                    cliente_mqtt.publish(TOPICO.encode('utf-8'), dado.encode('utf-8'), qos=1)
                    time.sleep(0.1) # Uma pausa mínima para não "engasgar" o Broker enviando 100 mensagens de uma vez só
            
            print(f"✅ {len(linhas)} pacotes atrasados foram enviados com sucesso!")
        
        # A Mágica do Espaço: Exclui o arquivo físico da memória Flash
        os.remove(ARQUIVO_BUFFER)
        print("🗑️ Buffer apagado. Espaço na Flash 100% liberado.")

    except Exception as e:
        print(f"⚠️ Erro ao tentar esvaziar o buffer: {e}")


# --- 4. LOOP INFINITO DE COLETA E ENVIO ---
while True:
    try:
        leitura_t = sensor_temp.read_u16()
        leitura_d = sensor_densidade.read_u16()

        temperatura_real = (leitura_t / 65535.0) * 100 
        densidade_real = (leitura_d / 65535.0) * 5
        
        dados = {
            "temp": round(temperatura_real, 2),
            "densidade": round(densidade_real, 2)
        }
        carga_json = json.dumps(dados)
        
        # PASSO A: Tenta enviar o que estiver atrasado no "HD" primeiro
        enviar_buffer_acumulado()

        # PASSO B: Envia a leitura atual do segundo
        cliente_mqtt.publish(TOPICO.encode('utf-8'), carga_json.encode('utf-8'), qos=1) 
        print(f"📤 Enviado (QoS 1): {carga_json}")
        
        
        # Espera 5 segundos antes de ler de novo
        time.sleep(5)
        
    except Exception as e:
        # PASSO C: Se a internet cair ou o MQTT for desconectado, o erro estoura aqui!
        # O try/except "amortece" a queda, e nós mandamos a leitura atual para a gaveta.
        print(f"⚠️ Falha de envio detectada: {e}")
        salvar_no_buffer(carga_json)
        
        # O umqtt.robust vai tentar se reconectar sozinho nos bastidores durante esta pausa
        time.sleep(2)