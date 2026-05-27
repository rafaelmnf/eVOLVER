import React, { createContext, useContext, useState, useEffect } from "react";
import {
  mockSlaves,
  mockExperiments,
  mockAlerts,
  mockMaster,
  RaspberrySlave,
  Experiment,
  Alert,
  RaspberryMaster,
  SensorType
} from "../lib/mockData";

interface LiveDataContextType {
  slaves: RaspberrySlave[];
  experiments: Experiment[];
  alerts: Alert[];
  master: RaspberryMaster;
  isConnected: boolean;
  resolveAlert: (id: string) => void;
}

const LiveDataContext = createContext<LiveDataContextType | undefined>(undefined);

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const [slaves, setSlaves] = useState<RaspberrySlave[]>(mockSlaves);
  const [experiments, setExperiments] = useState<Experiment[]>(mockExperiments);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [master, setMaster] = useState<RaspberryMaster>(mockMaster);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const resolveAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, resolved: true, resolvedAt: new Date().toISOString() }
          : a
      )
    );
  };

  useEffect(() => {
    // Determine the protocol and host for WebSockets dynamically
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Fallback to localhost:3000 if running on Vite dev server (e.g. localhost:5173)
    const host = window.location.port === "5173" ? "localhost:3000" : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    console.log(`🔌 [WebSocket client] Connecting to ${wsUrl}...`);
    // Código monta a URL e "disca" para o servidor com o wsUrl
    // O objeto WebSocket é uma API nativa do próprio navegador (Chrome, Edge, etc). 
    // Ele é o responsável direto por lidar com os pacotes da rede TCP/IP por baixo dos panos.
    let socket = new WebSocket(wsUrl);

    const connectWS = () => {
      socket.onopen = () => {
        console.log("✅ [WebSocket client] Connected to evolver master WebSocket!");
        setIsConnected(true);
        setMaster(prev => ({
          ...prev,
          status: "active",
          lastSync: new Date().toISOString()
        }));
      };

      // Conecta ao WebSocket
      // Toda vez que o seu backend dá um ws.send() (ou o broadcast() que vimos antes), o navegador dispara a função onmessage.
      socket.onmessage = (event) => {
        try {
          // Transforma o JSON em Objeto
          const message = JSON.parse(event.data);

          // Atualiza o estado com novos dados
          
          if (message.type === "MQTT_READING") { // // Isso é importante porque no  futuro você poderia ter outros tipos de mensagens passando pelo mesmo cabo (como "SYSTEM_ALERT", "CHAT_MESSAGE", etc)
            const { origem, temp, densidade, timestamp } = message.data;

            // Encontra o slave correspondente (rasp5)
            // Atualiza temperatura, densidade, histórico...
            // Verifica alertas (temp > 38.5°C ou < 30°C)
            setSlaves((prevSlaves) => {
              // Robust matching algorithm for matching topics to slaves
              const index = prevSlaves.findIndex((s) => 
                s.id.toLowerCase() === origem.toLowerCase() ||
                s.hostname.toLowerCase() === origem.toLowerCase() ||
                s.hostname.toLowerCase().includes(origem.toLowerCase()) ||
                origem.toLowerCase().includes(s.hostname.toLowerCase()) ||
                origem.toLowerCase().includes(s.id.toLowerCase())
              );

              if (index === -1) {
                console.warn(`[Live Data] Could not find matched slave for topic source: ${origem}`);
                return prevSlaves;
              }

              const newSlaves = [...prevSlaves];
              const slave = { ...newSlaves[index] };

              // Determine threshold warnings
              let isWarning = false;
              let warningMsg = "";
              if (temp > 38.5) {
                isWarning = true;
                warningMsg = `Temperature above safe threshold (${temp}°C > 38.5°C)`;
              } else if (temp < 30.0) {
                isWarning = true;
                warningMsg = `Temperature below safe threshold (${temp}°C < 30.0°C)`;
              }

              // Update Temperature readings
              const tempHistory = [...slave.sensors.temperature.history];
              const prevTemp = tempHistory[tempHistory.length - 1] ?? temp;
              // empurra valores novos e descartas aqueles depois de 20
              tempHistory.push(temp);
              if (tempHistory.length > 20) tempHistory.shift();

              slave.sensors = {
                ...slave.sensors,
                temperature: {
                  ...slave.sensors.temperature,
                  value: temp,
                  history: tempHistory,
                  // trend é para comparar a temperatura atual com a anterior para deixar a seta para cima/baixo
                  trend: temp > prevTemp ? "up" : temp < prevTemp ? "down" : "stable",
                  trendDelta: parseFloat((temp - prevTemp).toFixed(2)),
                  quality: isWarning ? "poor" : "excellent"
                }
              };

              // Update Optical Density (OD) readings
              const odHistory = [...slave.sensors.od.history];
              const prevOD = odHistory[odHistory.length - 1] ?? densidade;
              odHistory.push(densidade);
              if (odHistory.length > 20) odHistory.shift();

              slave.sensors.od = {
                ...slave.sensors.od,
                value: densidade,
                history: odHistory,
                trend: densidade > prevOD ? "up" : densidade < prevOD ? "down" : "stable",
                trendDelta: parseFloat((densidade - prevOD).toFixed(3)),
                quality: "excellent"
              };

              // Update general slave states
              slave.lastSeen = timestamp;
              slave.status = isWarning ? "warning" : "active";

              // Handle Alert Generation in real-time
              if (isWarning) {
                setAlerts((prevAlerts) => {
                  // Check if there is already an active alert for this sensor and slave
                  const hasActiveAlert = prevAlerts.some(
                    (a) => a.slaveId === slave.id && a.sensor === "temperature" && !a.resolved
                  );

                  if (!hasActiveAlert) {
                    const newAlert = {
                      id: `alert-${Date.now()}`,
                      slaveId: slave.id,
                      slaveName: slave.hostname,
                      experimentId: slave.experimentId,
                      sensor: "temperature" as SensorType,
                      severity: "warning" as const,
                      message: warningMsg,
                      value: temp,
                      threshold: 38.5,
                      timestamp: new Date().toISOString(),
                      resolved: false,
                      resolvedAt: null
                    };
                    slave.alertCount += 1;
                    return [newAlert, ...prevAlerts];
                  }
                  return prevAlerts;
                });
              } else {
                // If it returned to normal, resolve active alerts for this slave
                setAlerts((prevAlerts) => {
                  let alertResolved = false;
                  const updatedAlerts = prevAlerts.map((a) => {
                    if (a.slaveId === slave.id && a.sensor === "temperature" && !a.resolved) {
                      alertResolved = true;
                      return {
                        ...a,
                        resolved: true,
                        resolvedAt: new Date().toISOString()
                      };
                    }
                    return a;
                  });
                  if (alertResolved && slave.alertCount > 0) {
                    slave.alertCount -= 1;
                  }
                  return updatedAlerts;
                });
              }

              newSlaves[index] = slave;
              return newSlaves;
            });

            // Update sync status on Master
            setMaster((prev) => ({
              ...prev,
              lastSync: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error("❌ [WebSocket client] Error parsing socket data:", error);
        }
      };

      // Se a rede falhar, o servidor reiniciar ou o Wi-Fi cair, a conexão WebSocket se quebra.
      //  Se o backend cair, o painel do Biorreator vai mostrar "offline", mas a cada 5 segundos ele tenta fazer uma ligação nova e invisível. Se o backend voltar, o sistema volta à vida sozinho sem o usuário precisar apertar F5 na página
      socket.onclose = () => {
        console.log("🔌 [WebSocket client] Connection closed. Retrying in 5 seconds...");
        setIsConnected(false);
        setMaster(prev => ({ ...prev, status: "offline" }));
        setTimeout(() => {
          socket = new WebSocket(wsUrl);
          connectWS();
        }, 5000);
      };

      socket.onerror = (err) => {
        console.error("❌ [WebSocket client] Connection error:", err);
      };
    };

    connectWS();

    return () => {
      socket.close();
    };
  }, []);

  return (
    <LiveDataContext.Provider value={{ slaves, experiments, alerts, master, isConnected, resolveAlert }}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const context = useContext(LiveDataContext);
  if (context === undefined) {
    throw new Error("useLiveData must be used within a LiveDataProvider");
  }
  return context;
}
