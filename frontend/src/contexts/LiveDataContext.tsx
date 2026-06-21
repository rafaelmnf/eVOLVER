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
  deleteExperiment: (id: string) => Promise<void>;
}

const LiveDataContext = createContext<LiveDataContextType | undefined>(undefined);

// Mapeia uma linha do GET /api/experiments para o shape Experiment do frontend.
function mapApiExperiment(row: any): Experiment {
  const researcherName = row.researcher?.name || "Pesquisador";
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    status: row.status,
    startedAt: row.startedAt ?? null,
    endedAt: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    duration: "—",
    slaveIds: row.slaveIds || [],
    alertCount: 0,
    researcher: {
      id: row.researcher?.id || row.researcherId || "",
      name: researcherName,
      email: row.researcher?.email || "",
      avatar: researcherName.substring(0, 2).toUpperCase(),
    },
  };
}

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const [slaves, setSlaves] = useState<RaspberrySlave[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [master, setMaster] = useState<RaspberryMaster>({
    id: "master-001",
    hostname: "eMaster",
    ip: "10.42.0.1",
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

  // Carrega a lista de experimentos do backend no mount (fonte única; o WebSocket
  // mantém atualizações em tempo real via EXPERIMENT_CREATED/EXPERIMENT_DELETED).
  useEffect(() => {
    fetch("/api/experiments")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: any[]) => {
        setExperiments(rows.map(mapApiExperiment));
      })
      .catch((err) => {
        console.error("❌ [Live Data] Erro ao carregar experimentos:", err);
      });
  }, []);

  const deleteExperiment = async (id: string) => {
    await fetch(`/api/experiments/${id}`, { method: "DELETE" });
    // O broadcast EXPERIMENT_DELETED via WebSocket atualiza o estado
  };

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
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.port === "5173" ? `${window.location.hostname}:3000` : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    console.log(`🔌 [WebSocket client] Connecting to ${wsUrl}...`);
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

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "INITIAL_MASTER") {
            const { hostname, ip, status, lastSync } = message.data;
            setMaster((prev) => ({
              ...prev,
              hostname,
              ip,
              status,
              lastSync: lastSync || prev.lastSync,
            }));

            if (status === "offline") {
              setSlaves((prevSlaves) =>
                prevSlaves.map((s) => ({
                  ...s,
                  status: "offline",
                  sensors: {
                    temperature: { ...s.sensors.temperature, quality: "error" as const, value: 0 },
                    od: { ...s.sensors.od, quality: "error" as const, value: 0 },
                    agitation: { ...s.sensors.agitation, quality: "error" as const, value: 0 },
                  },
                }))
              );
            }
          }

          if (message.type === "MASTER_STATUS_UPDATE") {
            const { status, slavesOffline } = message.data;
            setMaster((prev) => ({
              ...prev,
              status,
              lastSync: new Date().toISOString(),
            }));

            if (slavesOffline || status === "offline") {
              setSlaves((prevSlaves) =>
                prevSlaves.map((s) => ({
                  ...s,
                  status: "offline",
                  sensors: {
                    temperature: { ...s.sensors.temperature, quality: "error" as const, value: 0 },
                    od: { ...s.sensors.od, quality: "error" as const, value: 0 },
                    agitation: { ...s.sensors.agitation, quality: "error" as const, value: 0 },
                  },
                }))
              );
            }
          }

          if (message.type === "INITIAL_SLAVES") {
            setSlaves(message.data);
            setMaster((prev) => {
              const hostnames = message.data.map((s: any) => s.hostname);
              return {
                ...prev,
                slaves: Array.from(new Set([...prev.slaves, ...hostnames])),
                lastSync: new Date().toISOString()
              };
            });
          }

          if (message.type === "INITIAL_EXPERIMENTS") {
            // A fonte autoritativa é o GET /api/experiments (traz createdAt).
            // Aqui apenas garantimos createdAt (fallback startedAt) caso o GET ainda
            // não tenha respondido, sem sobrescrever dados já carregados.
            const incoming: Experiment[] = (message.data as any[]).map((e) => ({
              ...e,
              createdAt: e.createdAt || e.startedAt || new Date().toISOString(),
            }));
            setExperiments((prev) => (prev.length > 0 ? prev : incoming));
          }

          if (message.type === "SLAVE_STATUS_UPDATE") {
            const { id, hostname, status, lastSeen } = message.data;
            setSlaves((prevSlaves) =>
              prevSlaves.map((s) =>
                s.id === id || s.hostname.toLowerCase() === hostname.toLowerCase()
                  ? {
                      ...s,
                      status,
                      lastSeen,
                      sensors: status === "offline"
                        ? {
                            temperature: { ...s.sensors.temperature, quality: "error" as const, value: 0 },
                            od: { ...s.sensors.od, quality: "error" as const, value: 0 },
                            agitation: { ...s.sensors.agitation, quality: "error" as const, value: 0 },
                          }
                        : s.sensors,
                    }
                  : s
              )
            );
          }

          if (message.type === "EXPERIMENT_CREATED") {
            const d = message.data;
            setExperiments((prev) => {
              if (prev.some((e) => e.id === d.id)) return prev;
              const researcherName = d.researcher?.name || "Pesquisador";
              return [
                {
                  id: d.id,
                  name: d.name,
                  description: d.description || "",
                  status: (d.status || "draft") as Experiment["status"],
                  startedAt: d.startedAt ?? null,
                  endedAt: null,
                  createdAt: d.createdAt || new Date().toISOString(),
                  duration: "—",
                  slaveIds: d.slaveIds || [],
                  alertCount: 0,
                  researcher: {
                    id: d.researcher?.id || "",
                    name: researcherName,
                    email: d.researcher?.email || "",
                    avatar: researcherName.substring(0, 2).toUpperCase(),
                  },
                },
                ...prev,
              ];
            });
          }

          if (message.type === "EXPERIMENT_DELETED") {
            const { id } = message.data;
            setExperiments((prev) => prev.filter((e) => e.id !== id));
          }

          if (message.type === "EXPERIMENT_STARTED") {
            const { id, status, startedAt } = message.data;
            setExperiments((prev) =>
              prev.map((e) =>
                e.id === id
                  ? { ...e, status: (status || "running") as Experiment["status"], startedAt: startedAt ?? e.startedAt }
                  : e
              )
            );
          }

          // Mudança de status do experimento (pausado/retomado) em tempo real.
          if (message.type === "EXPERIMENT_STATUS") {
            const { id, status } = message.data;
            setExperiments((prev) =>
              prev.map((e) =>
                e.id === id ? { ...e, status: status as Experiment["status"] } : e
              )
            );
          }

          if (message.type === "SLAVE_HELLO") {
            const { id, hostname, ip, timestamp } = message.data;
            setSlaves((prev) => {
              const exists = prev.some((s) => s.id === id || s.hostname.toLowerCase() === hostname.toLowerCase());
              if (exists) {
                return prev.map((s) =>
                  s.id === id || s.hostname.toLowerCase() === hostname.toLowerCase()
                    ? { ...s, status: "idle" as const, lastSeen: timestamp, experimentId: null }
                    : s
                );
              }
              const newSlave: RaspberrySlave = {
                id,
                hostname,
                ip: ip || "Connected",
                status: "idle",
                lastSeen: timestamp,
                experimentId: null,
                alertCount: 0,
                sensors: {
                  temperature: { value: 0, unit: "°C", trend: "stable", trendDelta: 0, quality: "excellent", history: [] },
                  od: { value: 0, unit: "OD600", trend: "stable", trendDelta: 0, quality: "excellent", history: [] },
                  agitation: { value: 0, unit: "RPM", trend: "stable", trendDelta: 0, quality: "excellent", history: [] },
                },
              };
              return [...prev, newSlave];
            });
            setMaster((prev) => ({
              ...prev,
              slaves: prev.slaves.includes(hostname) ? prev.slaves : [...prev.slaves, hostname],
              lastSync: new Date().toISOString(),
            }));
          }

          if (message.type === "MQTT_READING") {
            const { origem, temp, densidade, rotacao, timestamp, id, status, experimentId } = message.data;
            // Instante real desta leitura (epoch ms) — usado para o eixo X cronológico.
            const readingTs = timestamp ? new Date(timestamp).getTime() : Date.now();

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
              (id && s.id === id) ||
              s.id.toLowerCase() === origem.toLowerCase() ||
              s.hostname.toLowerCase() === origem.toLowerCase() ||
              s.hostname.toLowerCase().includes(origem.toLowerCase()) ||
              origem.toLowerCase().includes(s.hostname.toLowerCase()) ||
              origem.toLowerCase().includes(s.id.toLowerCase())
            );

            if (index === -1) {
              console.log(`🔌 [Live Data] Discovered new slave: ${origem}`);
              const newSlave: RaspberrySlave = {
                id: id || origem,
                hostname: origem,
                ip: "Connected",
                status: status || (isWarning ? "warning" : "active"),
                lastSeen: timestamp,
                experimentId: experimentId || null,
                alertCount: isWarning ? 1 : 0,
                sensors: {
                  temperature: {
                    value: temp,
                    unit: "°C",
                    trend: "stable",
                    trendDelta: 0,
                    quality: isWarning ? "poor" : "excellent",
                    history: [temp],
                    historyTs: [readingTs]
                  },
                  od: {
                    value: densidade,
                    unit: "OD600",
                    trend: "stable",
                    trendDelta: 0,
                    quality: "excellent",
                    history: [densidade],
                    historyTs: [readingTs]
                  },
                  agitation: {
                    value: rotacao ?? 200,
                    unit: "RPM",
                    trend: "stable",
                    trendDelta: 0,
                    quality: "excellent",
                    history: [rotacao ?? 200],
                    historyTs: [readingTs]
                  }
                }
              };

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

                // Se o experimentId mudou (slave acabou de entrar num experimento), limpa o histórico
                const experimentChanged = experimentId !== undefined && experimentId !== slave.experimentId && experimentId !== null;

                // Update Temperature (mantém history e historyTs espelhados)
                const tempHistory = experimentChanged ? [] : [...(slave.sensors.temperature.history || [])];
                const tempHistoryTs = experimentChanged ? [] : [...(slave.sensors.temperature.historyTs || [])];
                const prevTemp = tempHistory[tempHistory.length - 1] ?? temp;
                tempHistory.push(temp);
                tempHistoryTs.push(readingTs);
                if (tempHistory.length > 20) { tempHistory.shift(); tempHistoryTs.shift(); }

                slave.sensors = {
                  ...slave.sensors,
                  temperature: {
                    ...slave.sensors.temperature,
                    value: temp,
                    history: tempHistory,
                    historyTs: tempHistoryTs,
                    trend: temp > prevTemp ? "up" : temp < prevTemp ? "down" : "stable",
                    trendDelta: parseFloat((temp - prevTemp).toFixed(2)),
                    quality: isWarning ? "poor" : "excellent"
                  }
                };

                // Update OD
                const odHistory = experimentChanged ? [] : [...(slave.sensors.od.history || [])];
                const odHistoryTs = experimentChanged ? [] : [...(slave.sensors.od.historyTs || [])];
                const prevOD = odHistory[odHistory.length - 1] ?? densidade;
                odHistory.push(densidade);
                odHistoryTs.push(readingTs);
                if (odHistory.length > 20) { odHistory.shift(); odHistoryTs.shift(); }

                slave.sensors.od = {
                  ...slave.sensors.od,
                  value: densidade,
                  history: odHistory,
                  historyTs: odHistoryTs,
                  trend: densidade > prevOD ? "up" : densidade < prevOD ? "down" : "stable",
                  trendDelta: parseFloat((densidade - prevOD).toFixed(3)),
                  quality: "excellent"
                };

                // Update Agitation (rotacao)
                if (rotacao !== undefined) {
                  const rpmHistory = experimentChanged ? [] : [...(slave.sensors.agitation.history || [])];
                  const rpmHistoryTs = experimentChanged ? [] : [...(slave.sensors.agitation.historyTs || [])];
                  const prevRpm = rpmHistory[rpmHistory.length - 1] ?? rotacao;
                  rpmHistory.push(rotacao);
                  rpmHistoryTs.push(readingTs);
                  if (rpmHistory.length > 20) { rpmHistory.shift(); rpmHistoryTs.shift(); }
                  slave.sensors.agitation = {
                    ...slave.sensors.agitation,
                    value: rotacao,
                    history: rpmHistory,
                    historyTs: rpmHistoryTs,
                    trend: rotacao > prevRpm ? "up" : rotacao < prevRpm ? "down" : "stable",
                    trendDelta: parseFloat((rotacao - prevRpm).toFixed(1)),
                    quality: "excellent"
                  };
                }

                slave.lastSeen = timestamp;
                slave.status = status || (isWarning ? "warning" : "active");
                if (id) slave.id = id;
                if (experimentId !== undefined) slave.experimentId = experimentId;

                if (isWarning) {
                  setAlerts((prevAlerts) => {
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
                  setAlerts((prevAlerts) => {
                    let alertResolved = false;
                    const updatedAlerts = prevAlerts.map((a) => {
                      if (a.slaveId === slave.id && a.sensor === "temperature" && !a.resolved) {
                        alertResolved = true;
                        return { ...a, resolved: true, resolvedAt: new Date().toISOString() };
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

            setMaster((prev) => ({
              ...prev,
              lastSync: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error("❌ [WebSocket client] Error parsing socket data:", error);
        }
      };

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
    <LiveDataContext.Provider value={{ slaves, experiments, alerts, master, isConnected, resolveAlert, deleteExperiment }}>
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
