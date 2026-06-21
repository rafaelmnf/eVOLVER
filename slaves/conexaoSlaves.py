import network
import time
import json
import machine
import ubinascii
import os
from umqtt.simple import MQTTClient

dna_placa = ubinascii.hexlify(machine.unique_id()).decode('utf-8')
ID_CLIENTE = f"rasp_{dna_placa}"

# --- CONFIGURAÇÕES ---
SSID_WIFI = "eMaster_Rede"
SENHA_WIFI = "evolver_admin"
IP_BROKER = "10.42.0.1"
TOPICO_SENSORES = f"projeto/sensores/{ID_CLIENTE}"
TOPICO_STATUS   = f"projeto/status/{ID_CLIENTE}"
ARQUIVO_BUFFER  = "buffer_dados.txt"

# Pausa de inicialização para estabilizar o chip Wi-Fi na tomada
time.sleep(2)

# Pinos Analógicos
sensor_temp      = machine.ADC(26)
sensor_densidade = machine.ADC(27)
sensor_rotacao   = machine.ADC(28)

# Estado local: None = ocioso, string = id do experimento em curso
experimento_ativo = None

# Intervalo de envio de dados (segundos). Default 5 (legado); o backend envia um
# valor entre 20 e 200 no comando 'iniciar_experimento'.
intervalo_envio = 5
INTERVALO_MIN = 20
INTERVALO_MAX = 200

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
    """Tenta conectar ao Broker. Retorna True se conseguir."""
    try:
        cliente_mqtt.connect()
        print("✅ Conectado ao Broker MQTT!")
        return True
    except Exception as e:
        print(f"❌ Falha ao conectar no Broker: {e}")
        return False

# --- 3. CALLBACK: recebe comandos da master (ex.: vincular a experimento) ---
def callback_comandos(topico, mensagem):
    global experimento_ativo, intervalo_envio
    try:
        # DECODIFICA de bytes para texto antes de ler o JSON
        mensagem_texto = mensagem.decode('utf-8')
        dados = json.loads(mensagem_texto)

        comando = dados.get("comando")
        if comando == "iniciar_experimento":
            experimento_ativo = dados.get("experimentId")
            # Aplica o intervalo de envio configurado, com clamp defensivo 20–200s.
            try:
                novo = int(dados.get("intervalo", intervalo_envio))
                intervalo_envio = max(INTERVALO_MIN, min(INTERVALO_MAX, novo))
            except (TypeError, ValueError):
                pass
            print(f"🔬 Experimento iniciado: {experimento_ativo} (envio a cada {intervalo_envio}s)")
        elif comando == "pausar_experimento":
            # Pausa: para de publicar sensores e volta a anunciar presença (HELLO).
            # O backend mantém o vínculo no DB; 'iniciar_experimento' (resume/reconexão) retoma.
            print(f"⏸️ Experimento pausado: {experimento_ativo}")
            experimento_ativo = None
        elif comando == "parar_experimento":
            print(f"🛑 Experimento encerrado: {experimento_ativo}")
            experimento_ativo = None
    except Exception as e:
        print(f"❌ Erro no callback: {e}")

TOPICO_COMANDOS = f"projeto/comandos/{ID_CLIENTE}"

# Primeira tentativa de conexão
conectado_mqtt = tentar_conectar_mqtt()

if conectado_mqtt:
    cliente_mqtt.set_callback(callback_comandos)
    cliente_mqtt.subscribe(TOPICO_COMANDOS.encode('utf-8'))

# --- 4. FUNÇÕES DE BUFFER LOCAL ---
def salvar_no_buffer(dado_json):
    """Guarda o dado na Flash se o Broker estiver offline."""
    try:
        with open(ARQUIVO_BUFFER, 'a') as arquivo:
            arquivo.write(dado_json + '\n')
        print(f"💾 Salvo na Flash: {dado_json}")
    except Exception as e:
        print(f"❌ Erro físico na memória Flash: {e}")

def enviar_buffer_acumulado():
    """Envia dados acumulados na Flash e limpa o arquivo."""
    try:
        os.stat(ARQUIVO_BUFFER)
    except OSError:
        return

    print("🔄 Conexão restabelecida! Descarregando buffer offline...")
    with open(ARQUIVO_BUFFER, 'r') as arquivo:
        linhas = arquivo.readlines()

    if linhas:
        for linha in linhas:
            dado = linha.strip()
            if dado:
                cliente_mqtt.publish(TOPICO_SENSORES.encode('utf-8'), dado.encode('utf-8'), qos=1)
                time.sleep(0.1)
        print(f"✅ {len(linhas)} pacotes antigos enviados com sucesso!")

    os.remove(ARQUIVO_BUFFER)
    print("🗑️ Memória Flash limpa e liberada.")

# --- 5. ANUNCIO INICIAL (HELLO) ---
def anunciar_presenca():
    """Avisa a master que a plaquinha está online e disponível."""
    hello = json.dumps({
        "tipo": "HELLO",
        "id": ID_CLIENTE
    })
    try:
        cliente_mqtt.publish(TOPICO_STATUS.encode('utf-8'), hello.encode('utf-8'), qos=1)
        print(f"👋 HELLO enviado: {hello}")
    except Exception as e:
        print(f"❌ Falha ao enviar HELLO: {e}")

if conectado_mqtt:
    anunciar_presenca()

# --- 6. LOOP PRINCIPAL ---
# O loop "tica" a cada TICK_S segundos só para checar comandos (check_msg) e manter
# a Pico responsiva. A publicação de sensores/HELLO é controlada por tempo decorrido,
# respeitando o intervalo configurado. Assim, pausar/iniciar tem efeito em ~1s mesmo
# com intervalo de envio alto (20–200s) — antes a Pico ficava presa no sleep longo.
TICK_S = 1
ultimo_envio = time.ticks_ms()

# Últimas leituras (inicializadas para o buffer offline funcionar antes do 1º envio)
temperatura_real = 0.0
densidade_real = 0.0
rotacao_real = 0.0

while True:
    try:
        # Verifica se chegou algum comando da master (não-bloqueante) — a cada tick
        if conectado_mqtt:
            cliente_mqtt.check_msg()

        # Tenta reconectar se necessário
        if not conectado_mqtt:
            print("🔄 Tentando restabelecer comunicação com o Broker...")
            conectado_mqtt = tentar_conectar_mqtt()
            if conectado_mqtt:
                cliente_mqtt.set_callback(callback_comandos)
                cliente_mqtt.subscribe(TOPICO_COMANDOS.encode('utf-8'))
                anunciar_presenca()
                enviar_buffer_acumulado()
                ultimo_envio = time.ticks_ms()

        # Só publica/anuncia quando o intervalo configurado tiver decorrido
        decorrido = time.ticks_diff(time.ticks_ms(), ultimo_envio) >= intervalo_envio * 1000
        if decorrido:
            ultimo_envio = time.ticks_ms()

            # Leituras dos sensores (sempre acontecem, mesmo em idle)
            leitura_t = sensor_temp.read_u16()
            leitura_d = sensor_densidade.read_u16()
            leitura_r = sensor_rotacao.read_u16()

            temperatura_real = round((leitura_t / 65535.0) * 100, 2)
            densidade_real   = round((leitura_d / 65535.0) * 5, 2)
            rotacao_real     = round((leitura_r / 65535.0) * 300, 1)  # 0–300 RPM mock

            if conectado_mqtt:
                # Ociosa/pausada: renova o HELLO para o servidor saber que ainda está viva
                if experimento_ativo is None:
                    anunciar_presenca()
                    print(f"💤 Ocioso — aguardando experimento (temp={temperatura_real}°C)")
                else:
                    dados = {
                        "temp": temperatura_real,
                        "densidade": densidade_real,
                        "rotacao": rotacao_real,
                        "experimentId": experimento_ativo
                    }
                    carga_json = json.dumps(dados)
                    cliente_mqtt.publish(TOPICO_SENSORES.encode('utf-8'), carga_json.encode('utf-8'), qos=1)
                    print(f"📤 Enviado: {carga_json}")
            else:
                # Offline e em experimento: salva no buffer para não perder dados
                if experimento_ativo is not None:
                    dados = {
                        "temp": temperatura_real,
                        "densidade": densidade_real,
                        "rotacao": rotacao_real,
                        "experimentId": experimento_ativo
                    }
                    salvar_no_buffer(json.dumps(dados))
                print("⚠️ Sistema operando Offline.")

        time.sleep(TICK_S)

    except OSError as e:
        print(f"⚠️ Alerta de Hardware: Conexão com o Broker perdida ({e})")
        conectado_mqtt = False
        if experimento_ativo is not None:
            dados = {
                "temp": temperatura_real,
                "densidade": densidade_real,
                "rotacao": rotacao_real,
                "experimentId": experimento_ativo
            }
            salvar_no_buffer(json.dumps(dados))
        time.sleep(2)
