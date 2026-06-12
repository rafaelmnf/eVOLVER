import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
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
  const [slaves, setSlaves] = useState<RaspberrySlave[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [master, setMaster] = useState<RaspberryMaster>({
    id: "master-001",
    hostname: "evolver-master",
    ip: "192.168.1.10",
    status: "offline",
    slaves: [],
    uptime: "0d 0h 0m",
    lastSync: ""
  });
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const slavesRef = useRef(slaves);
  useEffect(() => {
    slavesRef.current = slaves;
  }, [slaves]);

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
    // Fallback to the current hostname at port 3000 if running on Vite dev server (e.g. 5173)
    const host = window.location.port === "5173" ? `${window.location.hostname}:3000` : window.location.host;
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

            const currentSlaves = slavesRef.current;
            const index = currentSlaves.findIndex((s) =>
              s.id.toLowerCase() === origem.toLowerCase() ||
              s.hostname.toLowerCase() === origem.toLowerCase() ||
              s.hostname.toLowerCase().includes(origem.toLowerCase()) ||
              origem.toLowerCase().includes(s.hostname.toLowerCase()) ||
              origem.toLowerCase().includes(s.id.toLowerCase())
            );

            if (index === -1) {
              console.log(`🔌 [Live Data] Discovered new slave: ${origem}`);
              const newSlave: RaspberrySlave = {
                id: origem,
                hostname: origem,
                ip: "Connected",
                status: isWarning ? "warning" : "active",
                lastSeen: timestamp,
                experimentId: null,
                alertCount: isWarning ? 1 : 0,
                sensors: {
                  temperature: {
                    value: temp,
                    unit: "°C",
                    trend: "stable",
                    trendDelta: 0,
                    quality: isWarning ? "poor" : "excellent",
                    history: [temp]
                  },
                  ph: {
                    value: 7.0,
                    unit: "pH",
                    trend: "stable",
                    trendDelta: 0,
                    quality: "excellent",
                    history: [7.0]
                  },
                  od: {
                    value: densidade,
                    unit: "OD600",
                    trend: "stable",
                    trendDelta: 0,
                    quality: "excellent",
                    history: [densidade]
                  },
                  agitation: {
                    value: 200,
                    unit: "RPM",
                    trend: "stable",
                    trendDelta: 0,
                    quality: "excellent",
                    history: [200]
                  }
                }
              };

              // Toda vez que o WebSocket chama setSlaves, o React detecta que o estado mudou
              // e redesenha na hora apenas os gráficos e os cards na tela do usuário com os valores atualizados
              setSlaves((prev) => [...prev, newSlave]);

              if (isWarning) {
                setAlerts((prevAlerts) => {
                  const newAlert = {
                    id: `alert-${Date.now()}`,
                    slaveId: newSlave.id,
                    slaveName: newSlave.hostname,
                    experimentId: null,
                    sensor: "temperature" as SensorType,
                    severity: "warning" as const,
                    message: warningMsg,
                    value: temp,
                    threshold: 38.5,
                    timestamp: new Date().toISOString(),
                    resolved: false,
                    resolvedAt: null
                  };
                  return [newAlert, ...prevAlerts];
                });
              }

              setMaster((prev) => {
                const updatedSlaves = prev.slaves.includes(origem)
                  ? prev.slaves
                  : [...prev.slaves, origem];
                return {
                  ...prev,
                  slaves: updatedSlaves,
                  lastSync: new Date().toISOString()
                };
              });

            } else {
              setSlaves((prevSlaves) => {
                const newSlaves = [...prevSlaves];
                const slave = { ...newSlaves[index] };

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
            }

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
