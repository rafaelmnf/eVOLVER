import network
import time
import json
import machine
import ubinascii
import os
from umqtt.simple import MQTTClient  # <-- MUDANÇA: Usando a versão Simple para termos controle dos erros

dna_placa = ubinascii.hexlify(machine.unique_id()).decode('utf-8')
ID_CLIENTE = f"rasp_{dna_placa}"

# --- CONFIGURAÇÕES ---
SSID_WIFI = "eMaster_Rede"
SENHA_WIFI = "evolver_admin"
IP_BROKER = "10.42.0.1"
<<<<<<< HEAD
TOPICO = f"projeto/sensores/{ID_CLIENTE}" 2
ARQUIVO_BUFFER = "buffer_dados.txt" # Nome do arquivo que vai guardar os dados offline
=======
TOPICO = f"projeto/sensores/{ID_CLIENTE}"
ARQUIVO_BUFFER = "buffer_dados.txt"

# Pausa de inicialização para estabilizar o chip Wi-Fi na tomada
time.sleep(2)
>>>>>>> dd5e2072741879c853e1f7b89dad582799e62ae4

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

# --- 2. GERENCIADOR DE CONEXÃO MQTT ---
cliente_mqtt = MQTTClient(ID_CLIENTE, IP_BROKER)

def tentar_conectar_mqtt():
    """Tenta conectar ao Broker de forma limpa. Retorna True se conseguir e False se falhar."""
    try:
        cliente_mqtt.connect()
        print("✅ Conectado ao Broker MQTT!")
        return True
    except Exception as e:
        print(f"❌ Falha ao conectar no Broker: {e}")
        return False

# Primeira tentativa antes de entrar no loop
conectado_mqtt = tentar_conectar_mqtt()

# --- 3. FUNÇÕES DE BUFFER LOCAL ---
def salvar_no_buffer(dado_json):
    """Guarda o dado com segurança na Flash se o Broker estiver offline."""
    try:
        with open(ARQUIVO_BUFFER, 'a') as arquivo:
            arquivo.write(dado_json + '\n')
        print(f"💾 Salvo na Flash: {dado_json}")
    except Exception as e:
        print(f"❌ Erro físico na memória Flash: {e}")

def enviar_buffer_acumulado():
    """Lê os dados acumulados, envia e limpa o arquivo apenas se tudo der certo."""
    try:
        os.stat(ARQUIVO_BUFFER)
    except OSError:
        return # Sem dados acumulados, sai da função

    print("🔄 Conexão restabelecida! Descarregando buffer offline...")

    with open(ARQUIVO_BUFFER, 'r') as arquivo:
        linhas = arquivo.readlines()

    if linhas:
        for linha in linhas:
            dado = linha.strip()
            if dado:
                # Se a conexão cair no MEIO do descarregamento do buffer,
                # o erro vai estourar aqui e interromper a função imediatamente,
                # impedindo que o arquivo seja apagado antes da hora.
                cliente_mqtt.publish(TOPICO.encode('utf-8'), dado.encode('utf-8'), qos=1)
                time.sleep(0.1)

        print(f"✅ {len(linhas)} pacotes antigos enviados com sucesso!")

    os.remove(ARQUIVO_BUFFER)
    print("🗑️ Memória Flash limpa e liberada.")


# --- 4. LOOP PRINCIPAL COM MÁQUINA DE ESTADOS ---
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

        # Se no ciclo passado nós perdemos a conexão, tenta reconectar agora
        if not conectado_mqtt:
            print("🔄 Tentando restabelecer comunicação com o Broker...")
            conectado_mqtt = tentar_conectar_mqtt()

        # Se estamos conectados (ou se a reconexão acima funcionou)
        if conectado_mqtt:
            # Envia primeiro o que ficou guardado no "HD"
            enviar_buffer_acumulado()

            # Envia o dado atual do sensor
            cliente_mqtt.publish(TOPICO.encode('utf-8'), carga_json.encode('utf-8'), qos=1)
            print(f"📤 Enviado em Tempo Real: {carga_json}")
            time.sleep(5)
        else:
            # Se a tentativa de reconexão falhou, armazena direto na Flash
            print("⚠️ Sistema operando Offline.")
            salvar_no_buffer(carga_json)
            time.sleep(5) # Mantém o ritmo de amostragem de 5 em 5 segundos

    except OSError as e:
        # Qualquer queda de conexão ou erro de rede vai cair EXATAMENTE aqui
        print(f"⚠️ Alerta de Hardware: Conexão com o Broker perdida ({e})")
        conectado_mqtt = False
        salvar_no_buffer(carga_json)
        time.sleep(2)
