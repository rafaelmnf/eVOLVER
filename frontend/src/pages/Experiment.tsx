import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, formatRelativeTime, getSensorLabel } from '@/lib/mockData';
import { useLiveData } from '@/contexts/LiveDataContext';
import SlaveConfigForm from '@/components/SlaveConfigForm';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  FlaskConical,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Plus,
  Cpu,
  ChevronLeft,
  X,
} from 'lucide-react';

type SensorTab = 'temperature' | 'od' | 'agitation';

const sensorConfig: Record<SensorTab, { label: string; unit: string; color: string; refMin?: number; refMax?: number }> = {
  temperature: { label: 'Temperatura', unit: '°C', color: '#1db954', refMin: 30, refMax: 38.5 },
  od: { label: 'Densidade Ótica', unit: 'OD', color: '#1db954', refMin: 0.1, refMax: 2.5 },
  agitation: { label: 'Agitação', unit: 'RPM', color: '#22d45f', refMin: 100, refMax: 300 },
};

export default function Experiment() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { experiments, alerts, slaves, resolveAlert } = useLiveData();
  const expId = params.id ?? '';
  const experiment = experiments.find(e => e.id === expId);

  // States
  const [viewMode, setViewMode] = useState<'monitor' | 'config'>('monitor');
  const [activeTab, setActiveTab] = useState<SensorTab>('temperature');
  const [activeSlave, setActiveSlave] = useState<string>('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [tempSelectedSlaves, setTempSelectedSlaves] = useState<Set<string>>(new Set());
  const [linkingSlaves, setLinkingSlaves] = useState(false);

  // Database integration states
  const [historyData, setHistoryData] = useState<Record<string, any[]>>({});
  const [dbAlerts, setDbAlerts] = useState<Alert[]>([]);
  const [slaveConfigsMap, setSlaveConfigsMap] = useState<Record<string, any>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  const expSlaves = slaves.filter(s => experiment?.slaveIds.includes(s.id));

  // Define active slave inicial ou corrige se for desvinculado
  useEffect(() => {
    if (expSlaves.length > 0) {
      if (!activeSlave || !expSlaves.some(s => s.id === activeSlave)) {
        setActiveSlave(expSlaves[0].id);
      }
    } else {
      setActiveSlave('');
    }
  }, [expSlaves, activeSlave]);

  // Carrega configurações de cada slave para a área de edição de variáveis
  useEffect(() => {
    const fetchConfigs = async () => {
      if (!experiment) return;
      try {
        for (const slaveId of experiment.slaveIds) {
          const res = await fetch(`/api/slaves/${slaveId}/config`);
          if (res.ok) {
            const data = await res.json();
            setSlaveConfigsMap(prev => ({ ...prev, [slaveId]: data }));
          }
        }
      } catch (err) {
        console.error('Erro ao buscar configs das slaves:', err);
      }
    };
    fetchConfigs();
  }, [experiment]);

  // Busca dados históricos do InfluxDB filtrados por categoria
  useEffect(() => {
    const fetchHistory = async () => {
      if (!experiment || experiment.status !== 'running') return;
      try {
        setLoadingHistory(true);
        const catMap: Record<SensorTab, string> = {
          temperature: 'tp',
          od: 'do',
          agitation: 'rpm'
        };
        const res = await fetch(`/api/experiments/${expId}/data?category=${catMap[activeTab]}`);
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
        }
      } catch (err) {
        console.error('Erro ao buscar dados históricos:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [expId, activeTab, experiment?.status]);

  // Busca alertas do banco correspondentes ao experimento
  useEffect(() => {
    const fetchAlerts = async () => {
      if (!experiment) return;
      try {
        const res = await fetch(`/api/experiments/${expId}/alerts`);
        if (res.ok) {
          const data = await res.json();
          setDbAlerts(data);
        }
      } catch (err) {
        console.error('Erro ao buscar alertas:', err);
      }
    };
    fetchAlerts();
  }, [expId, alerts, experiment]); // Atualiza quando alerts via WebSocket mudar

  if (!experiment) {
    return (
      <DashboardLayout title="Experimento" subtitle="Experimento não encontrado">
        <div className="flex flex-col items-center justify-center py-16 gap-3 ev-card">
          <FlaskConical size={32} style={{ color: 'var(--ev-green-primary)' }} />
          <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
            Nenhum experimento encontrado
          </p>
          <Link href="/experimentos">
            <button className="ev-btn-primary">Voltar para Experimentos</button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Prepara os dados do gráfico
  const selectedSlaveHistory = historyData[activeSlave] || [];
  const slaveSensor = activeSlave ? slaves.find(s => s.id === activeSlave)?.sensors[activeTab] : null;

  // Fallback para dados real-time sincronizados do context
  const chartData = selectedSlaveHistory.length > 0
    ? selectedSlaveHistory.map(p => ({
        time: new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        value: Number(p.value),
      }))
    : (slaveSensor?.history.map((v, i) => ({
        time: new Date(Date.now() - (slaveSensor.history.length - i) * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        value: Number(v),
      })) ?? []);

  const cfg = sensorConfig[activeTab];

  // Configurações de status do badge no header
  const statusConfig = {
    draft: { badge: 'ev-badge', label: 'Rascunho', dot: 'var(--ev-text-secondary)', pulse: false },
    running: { badge: 'ev-badge-active', label: 'Em execução', dot: 'var(--ev-green-primary)', pulse: true },
    paused: { badge: 'ev-badge-warning', label: 'Pausado', dot: '#d4a017', pulse: false },
    completed: { badge: 'ev-badge-offline', label: 'Finalizado', dot: '#4a6a4a', pulse: false },
    error: { badge: 'ev-badge-danger', label: 'Erro', dot: '#e74c3c', pulse: false },
  };
  const stCfg = statusConfig[experiment.status] || statusConfig.draft;

  // Handler de iniciar experimento (Run)
  const handleStartExperiment = async () => {
    try {
      setStarting(true);
      const res = await fetch(`/api/experiments/${expId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar experimento.');
    } finally {
      setStarting(false);
    }
  };

  // Handler de pausar experimento
  const handlePauseExperiment = async () => {
    try {
      setPausing(true);
      const res = await fetch(`/api/experiments/${expId}/pause`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error(err);
      alert('Erro ao pausar experimento.');
    } finally {
      setPausing(false);
    }
  };

  // Handler de retomar experimento
  const handleResumeExperiment = async () => {
    try {
      setResuming(true);
      const res = await fetch(`/api/experiments/${expId}/resume`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error(err);
      alert('Erro ao retomar experimento.');
    } finally {
      setResuming(false);
    }
  };

  // Handler de salvar vinculações de slaves
  const handleSaveLinkedSlaves = async () => {
    try {
      setLinkingSlaves(true);
      const res = await fetch(`/api/experiments/${expId}/slaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slaveIds: Array.from(tempSelectedSlaves) })
      });
      if (!res.ok) throw new Error(await res.text());
      setIsLinkModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao vincular slaves.');
    } finally {
      setLinkingSlaves(false);
    }
  };

  // Handler de salvar configurações do slave em tempo real
  const handleSaveSlaveConfig = async (slaveId: string, configs: any[]) => {
    try {
      const res = await fetch(`/api/experiments/${expId}/slaves/${slaveId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs })
      });
      if (!res.ok) throw new Error(await res.text());

      // Atualiza localmente
      setSlaveConfigsMap(prev => ({ ...prev, [slaveId]: configs }));
    } catch (err) {
      console.error('Erro ao salvar configurações do slave:', err);
      throw err;
    }
  };

  const handleResolve = (alertId: string) => {
    if (confirmingId === alertId) {
      resolveAlert(alertId);
      setConfirmingId(null);
    } else {
      setConfirmingId(alertId);
    }
  };

  // Filtra alertas locais/banco
  const activeAlerts = dbAlerts.filter(a => !a.resolved);
  const resolvedAlertsList = dbAlerts.filter(a => a.resolved);

  return (
    <DashboardLayout
      title={experiment.name}
      subtitle={`Experimento · ID: ${experiment.id}`}
      headerRight={
        <div className="flex items-center gap-3">
          {experiment.status === 'running' && (
            <button
              onClick={handlePauseExperiment}
              disabled={pausing}
              className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded transition-all cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'rgba(212,160,23,0.1)',
                border: '1px solid rgba(212,160,23,0.3)',
                color: '#d4a017',
              }}
            >
              <Pause size={12} fill="#d4a017" />
              {pausing ? 'Pausando...' : 'Pausar'}
            </button>
          )}
          {experiment.status === 'paused' && (
            <button
              onClick={handleResumeExperiment}
              disabled={resuming}
              className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded transition-all cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--ev-green-dim)',
                border: '1px solid var(--ev-green-muted)',
                color: 'var(--ev-green-primary)',
              }}
            >
              <Play size={12} fill="var(--ev-green-primary)" />
              {resuming ? 'Retomando...' : 'Retomar'}
            </button>
          )}
          <Link href="/experimentos">
            <button className="flex items-center gap-1 text-xs text-[var(--ev-text-muted)] hover:text-white transition-colors cursor-pointer">
              <ChevronLeft size={14} />
              Voltar
            </button>
          </Link>
        </div>
      }
    >
      {/* Experiment Info Header */}
      <div className="ev-card p-5 mb-6 animate-fade-in-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--ev-green-dim)', border: '1px solid var(--ev-green-muted)' }}
            >
              <FlaskConical size={18} style={{ color: 'var(--ev-green-primary)' }} />
            </div>
            <div>
              <h2
                className="text-lg font-bold mb-1"
                style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)', letterSpacing: '-0.01em' }}
              >
                {experiment.name}
              </h2>
              <p className="text-sm" style={{ color: 'var(--ev-text-secondary)', maxWidth: 600 }}>
                {experiment.description || 'Nenhuma descrição fornecida.'}
              </p>
            </div>
          </div>
          
          <span className={`${stCfg.badge} flex items-center gap-1.5 flex-shrink-0`} style={experiment.status === 'draft' ? { backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--ev-text-secondary)', border: '1px solid var(--ev-border-subtle)' } : {}}>
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${stCfg.pulse ? 'animate-pulse-dot' : ''}`}
              style={{ backgroundColor: stCfg.dot }}
            />
            {stCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-5 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
          <MetaItem label="Criado em" value={new Date(experiment.createdAt || Date.now()).toLocaleString('pt-BR')} />
          <MetaItem label="Iniciado em" value={experiment.startedAt ? new Date(experiment.startedAt).toLocaleString('pt-BR') : 'Aguardando Início'} />
          <MetaItem label="Slaves Vinculadas" value={String(experiment.slaveIds.length)} />
          <MetaItem label="Pesquisador" value={experiment.researcher.name} />
        </div>
      </div>

      {/* Draft State Banner */}
      {experiment.status === 'draft' && (
        <div className="ev-card p-5 mb-6 animate-fade-in-up border border-[var(--ev-green-muted)] bg-gradient-to-r from-emerald-950/20 to-black/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-mono text-[var(--ev-green-primary)] flex items-center gap-2">
              <Play size={14} fill="var(--ev-green-primary)" />
              Rascunho de Experimento Pronto
            </h3>
            <p className="text-xs text-[var(--ev-text-secondary)]">
              Todas as slaves foram configuradas. Clique no botão ao lado para iniciar as leituras, acionar as bombas/motores e começar o ensaio.
            </p>
          </div>
          <button
            onClick={handleStartExperiment}
            disabled={starting}
            className="ev-btn-primary flex items-center gap-2 self-start md:self-auto cursor-pointer"
            style={{ padding: '0.6rem 1.5rem' }}
          >
            <Play size={14} fill="var(--ev-bg-primary)" />
            {starting ? 'Iniciando...' : 'Iniciar Experimento'}
          </button>
        </div>
      )}

      {/* Paused State Banner */}
      {experiment.status === 'paused' && (
        <div className="ev-card p-5 mb-6 animate-fade-in-up border border-[rgba(212,160,23,0.4)] bg-gradient-to-r from-amber-950/20 to-black/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold font-mono flex items-center gap-2" style={{ color: '#d4a017' }}>
              <Pause size={14} fill="#d4a017" />
              Experimento Pausado
            </h3>
            <p className="text-xs text-[var(--ev-text-secondary)]">
              O ensaio está temporariamente pausado. Os atuadores nos slaves foram instruídos a suspender a regulação ativa.
            </p>
          </div>
          <button
            onClick={handleResumeExperiment}
            disabled={resuming}
            className="flex items-center gap-2 self-start md:self-auto cursor-pointer ev-btn-primary disabled:opacity-50"
            style={{
              backgroundColor: 'var(--ev-green-primary)',
              color: 'var(--ev-bg-primary)',
              padding: '0.6rem 1.5rem',
            }}
          >
            <Play size={14} fill="var(--ev-bg-primary)" />
            {resuming ? 'Retomando...' : 'Retomar Experimento'}
          </button>
        </div>
      )}

      {/* Tabs de visualização */}
      <div className="flex gap-4 mb-6 border-b border-[var(--ev-border-subtle)] pb-px">
        <button
          onClick={() => setViewMode('monitor')}
          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
          style={{
            color: viewMode === 'monitor' ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)',
            borderBottom: viewMode === 'monitor' ? '2px solid var(--ev-green-primary)' : '2px solid transparent',
            fontFamily: 'DM Sans, sans-serif'
          }}
        >
          Monitoramento e Gráficos
        </button>
        <button
          onClick={() => setViewMode('config')}
          className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
          style={{
            color: viewMode === 'config' ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)',
            borderBottom: viewMode === 'config' ? '2px solid var(--ev-green-primary)' : '2px solid transparent',
            fontFamily: 'DM Sans, sans-serif'
          }}
        >
          Configurações de Variáveis
        </button>
      </div>

      {viewMode === 'monitor' ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Gráficos e Tabs de Sensores (Col-span 2) */}
          <div className="col-span-2 space-y-5">
            {/* Seletor de Slave ativa */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="ev-label mr-2">Slave:</span>
              {expSlaves.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSlave(s.id)}
                  className="text-xs px-3 py-1.5 rounded transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: activeSlave === s.id ? 'var(--ev-green-dim)' : 'var(--ev-bg-card)',
                    border: `1px solid ${activeSlave === s.id ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)'}`,
                    color: activeSlave === s.id ? 'var(--ev-green-primary)' : 'var(--ev-text-secondary)',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  {s.hostname}
                </button>
              ))}
            </div>

            {/* Abas dos sensores */}
            <div className="ev-card overflow-hidden">
              <div
                className="flex bg-black/20"
                style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
              >
                {(Object.keys(sensorConfig) as SensorTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 py-3.5 text-xs font-semibold transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: activeTab === tab ? 'var(--ev-green-dim)' : 'transparent',
                      color: activeTab === tab ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)',
                      borderBottom: activeTab === tab ? '2px solid var(--ev-green-primary)' : '2px solid transparent',
                      fontFamily: 'DM Sans, sans-serif',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {sensorConfig[tab].label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="ev-label font-mono">{cfg.label}</span>
                    <div
                      className="text-xs mt-1"
                      style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      Faixa Recomendada: {cfg.refMin} – {cfg.refMax} {cfg.unit}
                    </div>
                  </div>
                  <div
                    className="text-xs px-2.5 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--ev-bg-elevated)',
                      border: '1px solid var(--ev-border-subtle)',
                      color: 'var(--ev-text-muted)',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                  >
                    {experiment.status === 'running' ? 'Leituras em Tempo Real' : 'Experimento não iniciado'}
                  </div>
                </div>

                {experiment.status !== 'running' ? (
                  <div className="flex flex-col items-center justify-center py-20 text-[var(--ev-text-muted)] text-xs font-mono border border-dashed border-[var(--ev-border-subtle)] rounded bg-black/10">
                    <FlaskConical size={24} className="mb-2 animate-pulse" />
                    Gráfico disponível apenas após o início do experimento.
                  </div>
                ) : loadingHistory ? (
                  <div className="flex items-center justify-center h-[260px] text-xs font-mono text-[var(--ev-text-muted)]">
                    Carregando leituras históricas...
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-xs font-mono text-[var(--ev-text-muted)]">
                    Aguardando primeira leitura do nó...
                  </div>
                ) : (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(29,185,84,0.05)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          tick={{ fill: 'var(--ev-text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--ev-border-subtle)' }}
                        />
                        <YAxis
                          tick={{ fill: 'var(--ev-text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
                          tickLine={false}
                          axisLine={false}
                          width={35}
                        />
                        {cfg.refMin !== undefined && (
                          <ReferenceLine
                            y={cfg.refMin}
                            stroke="rgba(212,160,23,0.35)"
                            strokeDasharray="3 3"
                            label={{ value: 'min', fill: '#d4a017', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                          />
                        )}
                        {cfg.refMax !== undefined && (
                          <ReferenceLine
                            y={cfg.refMax}
                            stroke="rgba(212,160,23,0.35)"
                            strokeDasharray="3 3"
                            label={{ value: 'max', fill: '#d4a017', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--ev-bg-elevated)',
                            border: '1px solid var(--ev-border-default)',
                            borderRadius: '5px',
                            color: 'var(--ev-text-primary)',
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: '11px',
                          }}
                          labelStyle={{ color: 'var(--ev-text-muted)' }}
                          formatter={(value: number) => [`${value} ${cfg.unit}`, cfg.label]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={cfg.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: cfg.color, stroke: 'var(--ev-bg-primary)', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Alerts Table */}
            <div className="ev-card overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
              >
                <h3
                  className="font-semibold text-sm"
                  style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
                >
                  Alertas Relacionados
                </h3>
                <div className="flex items-center gap-2">
                  {activeAlerts.length > 0 && (
                    <span className="ev-badge-warning">{activeAlerts.length} ativo(s)</span>
                  )}
                  {resolvedAlertsList.length > 0 && (
                    <button
                      onClick={() => setShowResolved(!showResolved)}
                      className="flex items-center gap-1 text-xs text-[var(--ev-text-muted)] hover:text-white transition-colors cursor-pointer"
                    >
                      {showResolved ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {showResolved ? 'Ocultar' : 'Mostrar'} resolvidos ({resolvedAlertsList.length})
                    </button>
                  )}
                </div>
              </div>

              {dbAlerts.length === 0 ? (
                <div className="flex items-center justify-center py-10 gap-2 text-[var(--ev-text-muted)]">
                  <CheckCircle2 size={16} style={{ color: 'var(--ev-green-primary)' }} />
                  <span className="text-sm">Nenhum alerta registrado.</span>
                </div>
              ) : (
                <table className="ev-table">
                  <thead>
                    <tr>
                      <th>Severidade</th>
                      <th>Sensor</th>
                      <th>Mensagem</th>
                      <th>Slave</th>
                      <th>Tempo</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAlerts.map(alert => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        resolved={false}
                        confirmingId={confirmingId}
                        onResolve={handleResolve}
                        onCancelConfirm={() => setConfirmingId(null)}
                      />
                    ))}
                    {showResolved && resolvedAlertsList.map(alert => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        resolved={true}
                        confirmingId={confirmingId}
                        onResolve={handleResolve}
                        onCancelConfirm={() => setConfirmingId(null)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Panel: Nodes status & Details (Col-span 1) */}
          <div className="col-span-1 space-y-5">
            {/* Slaves Status */}
            <div className="ev-card overflow-hidden">
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
              >
                <Cpu size={14} style={{ color: 'var(--ev-green-primary)' }} />
                <h3
                  className="font-semibold text-sm"
                  style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
                >
                  Status das Slaves
                </h3>
              </div>
              <div className="p-3 space-y-2">
                {expSlaves.map(slave => (
                  <div
                    key={slave.id}
                    className="p-3 rounded"
                    style={{
                      backgroundColor: 'var(--ev-bg-elevated)',
                      border: '1px solid var(--ev-border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-semibold font-mono text-[var(--ev-text-primary)]"
                      >
                        {slave.hostname}
                      </span>
                      <span
                        className={
                          slave.status === 'active'
                            ? 'ev-badge-active'
                            : slave.status === 'warning'
                            ? 'ev-badge-warning'
                            : 'ev-badge-offline'
                        }
                        style={{ fontSize: '0.65rem' }}
                      >
                        {slave.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {(['temperature', 'od', 'agitation'] as const).map(s => (
                        <div key={s} className="flex items-center justify-between">
                          <span className="ev-label" style={{ fontSize: '0.6rem' }}>
                            {getSensorLabel(s)}
                          </span>
                          <span
                            className="text-xs"
                            style={{
                              fontFamily: 'IBM Plex Mono, monospace',
                              color: slave.sensors[s].quality === 'poor' ? '#d4a017' : 'var(--ev-green-primary)',
                            }}
                          >
                            {slave.status === 'offline' ? '—' : `${slave.sensors[s].value} ${slave.sensors[s].unit}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="text-xs mt-2"
                      style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                      Atualizado {formatRelativeTime(slave.lastSeen)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Config Mode Panel */
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 flex flex-col gap-3">
            <div className="ev-label px-1">Selecione a Slave</div>
            {expSlaves.map(slave => {
              const isActive = activeSlave === slave.id;
              return (
                <div
                  key={slave.id}
                  onClick={() => setActiveSlave(slave.id)}
                  className="p-3.5 rounded border transition-all duration-200 cursor-pointer flex items-center justify-between"
                  style={{
                    backgroundColor: isActive ? 'var(--ev-green-dim)' : 'var(--ev-bg-card)',
                    borderColor: isActive ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)',
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold font-mono truncate text-[var(--ev-text-primary)]">
                      {slave.hostname}
                    </span>
                    <span className="text-[10px] text-[var(--ev-text-muted)] font-mono">
                      {slave.ip}
                    </span>
                  </div>
                  <span
                    className={
                      slave.status === 'active'
                        ? 'ev-badge-active'
                        : slave.status === 'warning'
                        ? 'ev-badge-warning'
                        : 'ev-badge-offline'
                    }
                    style={{ fontSize: '0.6rem' }}
                  >
                    {slave.status}
                  </span>
                </div>
              );
            })}

            <button
              onClick={() => {
                setTempSelectedSlaves(new Set(experiment.slaveIds));
                setIsLinkModalOpen(true);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs py-2.5 px-3 rounded border border-dashed transition-all duration-200 cursor-pointer hover:bg-white/5"
              style={{
                borderColor: 'var(--ev-border-default)',
                color: 'var(--ev-text-secondary)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <Plus size={14} className="text-[var(--ev-green-primary)]" />
              Vincular Slaves
            </button>
          </div>

          <div className="col-span-3">
            <div className="ev-card p-6">
              {expSlaves.map(slave => {
                const isActive = activeSlave === slave.id;
                return (
                  <div key={slave.id} className={isActive ? 'block' : 'hidden'}>
                    <h3 className="text-sm font-bold font-mono text-[var(--ev-text-primary)] mb-5 border-b border-[var(--ev-border-subtle)] pb-3">
                      Reconfigurar Variáveis: {slave.hostname} {experiment.status === 'running' && <span className="text-[10px] text-[var(--ev-green-primary)] italic ml-2">(Edição em Tempo Real)</span>}
                    </h3>
                    
                    <SlaveConfigForm
                      slaveId={slave.id}
                      onSave={(configs) => handleSaveSlaveConfig(slave.id, configs)}
                      initialConfigs={slaveConfigsMap[slave.id]}
                      disabled={slave.status === 'offline'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vinculação de Slaves */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="ev-card w-full max-w-lg p-6 relative shadow-2xl animate-fade-in-up">
            <button
              onClick={() => setIsLinkModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--ev-text-muted)] hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
              Vincular Slaves ao Experimento
            </h2>
            <p className="text-xs text-[var(--ev-text-muted)] mb-4">
              Selecione as slaves que farão parte deste ensaio. Slaves em uso em outros experimentos não serão listadas.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="ev-label block mb-2">Slaves Disponíveis</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {slaves.filter(slave => slave.experimentId === null || slave.experimentId === expId).length === 0 ? (
                    <div className="text-xs text-[var(--ev-text-muted)] py-4 text-center">
                      Nenhuma slave disponível para vinculação.
                    </div>
                  ) : (
                    slaves
                      .filter(slave => slave.experimentId === null || slave.experimentId === expId)
                      .map(slave => {
                        const isSelected = tempSelectedSlaves.has(slave.id);
                        const isOffline = slave.status === 'offline';
                        
                        return (
                          <div
                            key={slave.id}
                            className="flex items-center justify-between p-3 rounded border transition-all duration-200 cursor-pointer hover:bg-white/5"
                            style={{
                              borderColor: isSelected ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)',
                              backgroundColor: isSelected ? 'var(--ev-green-dim)' : 'rgba(255,255,255,0.01)'
                            }}
                            onClick={() => {
                              const next = new Set(tempSelectedSlaves);
                              if (next.has(slave.id)) {
                                next.delete(slave.id);
                              } else {
                                next.add(slave.id);
                              }
                              setTempSelectedSlaves(next);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="accent-[var(--ev-green-primary)] cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium font-mono" style={{ color: 'var(--ev-text-primary)' }}>
                                  {slave.hostname}
                                </span>
                                <span className="text-xs text-[var(--ev-text-muted)] font-mono">
                                  IP: {slave.ip}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isOffline ? (
                                <span className="ev-badge-offline" style={{ fontSize: '0.65rem' }}>Offline</span>
                              ) : (
                                <span className="ev-badge-active animate-pulse-dot" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', border: '1px solid rgba(46, 204, 113, 0.2)' }}>Online</span>
                              )}
                              <span className="text-xs" style={{ color: isSelected ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)' }}>
                                {isSelected ? '✓ Selecionado' : 'Não vinculado'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="ev-btn-secondary"
                style={{ padding: '0.4rem 1rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLinkedSlaves}
                disabled={linkingSlaves || tempSelectedSlaves.size === 0}
                className="ev-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ padding: '0.4rem 1rem' }}
              >
                {linkingSlaves ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="ev-label mb-1" style={{ fontSize: '0.65rem' }}>{label}</div>
      <div
        className="text-sm font-medium"
        style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  resolved,
  confirmingId,
  onResolve,
  onCancelConfirm,
}: {
  alert: Alert;
  resolved: boolean;
  confirmingId: string | null;
  onResolve: (id: string) => void;
  onCancelConfirm: () => void;
}) {
  const isConfirming = confirmingId === alert.id;
  const severityColors = {
    critical: '#e74c3c',
    warning: '#d4a017',
    info: '#2e86c1',
  };
  const color = severityColors[alert.severity] || '#8aab8a';

  return (
    <tr style={{ opacity: resolved ? 0.5 : 1 }}>
      <td>
        <span style={{ color, fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', fontWeight: 600 }}>
          {alert.severity.toUpperCase()}
        </span>
      </td>
      <td>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}>
          {getSensorLabel(alert.sensor)}
        </span>
      </td>
      <td>
        <span style={{ color: 'var(--ev-text-secondary)', fontSize: '0.8rem' }}>
          {alert.message}
        </span>
      </td>
      <td>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-muted)', fontSize: '0.8rem' }}>
          {alert.slaveName}
        </span>
      </td>
      <td>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-muted)', fontSize: '0.8rem' }}>
          {formatRelativeTime(alert.timestamp)}
        </span>
      </td>
      <td>
        {!resolved ? (
          isConfirming ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onResolve(alert.id)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{
                  backgroundColor: 'var(--ev-green-dim)',
                  color: 'var(--ev-green-primary)',
                  border: '1px solid var(--ev-green-muted)',
                }}
              >
                Confirmar
              </button>
              <button
                onClick={onCancelConfirm}
                className="text-xs hover:underline text-[var(--ev-text-muted)] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => onResolve(alert.id)}
              className="text-xs px-2 py-0.5 rounded transition-all duration-150 cursor-pointer"
              style={{
                color: 'var(--ev-text-muted)',
                border: '1px solid var(--ev-border-subtle)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--ev-green-primary)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ev-border-default)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--ev-text-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ev-border-subtle)';
              }}
            >
              Resolver
            </button>
          )
        ) : (
          <span style={{ color: 'var(--ev-green-primary)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem' }}>
            ✓ Resolvido
          </span>
        )}
      </td>
    </tr>
  );
}
