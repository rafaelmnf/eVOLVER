/*
 * ConfigureExperiment (Tela 3) — Configuração de slaves antes de iniciar o experimento.
 * - Lista lateral dos slaves vinculados (Pendente vs Configurado)
 * - Ao selecionar, exibe o SlaveConfigForm (limites + atuadores)
 * - Edições ficam em cache no estado React (alternar entre slaves não perde dados)
 * - Salvar -> PUT /api/experiments/:id/slaves/:slaveId/config (marca como Configurado)
 * - "Concluir configuração" habilita só quando todos os slaves estão configurados;
 *   redireciona para /experimento/:id mantendo o status 'draft'.
 */
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import StatusBadge from '@/components/StatusBadge';
import { useLiveData } from '@/contexts/LiveDataContext';
import SlaveConfigForm, {
  SlaveConfig,
  emptySlaveConfig,
  mapApiConfigToForm,
  hasAnyConfigValue,
  buildConfigPayload,
} from '@/components/SlaveConfigForm';
import { ArrowLeft, Cpu, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export default function ConfigureExperiment() {
  const params = useParams<{ id: string }>();
  const expId = params.id!;
  const [, setLocation] = useLocation();
  const { experiments, slaves } = useLiveData();

  const experiment = experiments.find((e) => e.id === expId);
  const linkedSlaves = slaves.filter((s) => s.experimentId === expId);

  const [activeSlaveId, setActiveSlaveId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SlaveConfig>>({});
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingSlave, setLoadingSlave] = useState(false);

  // Seleciona o primeiro slave automaticamente
  useEffect(() => {
    if (!activeSlaveId && linkedSlaves.length > 0) {
      setActiveSlaveId(linkedSlaves[0].id);
    }
  }, [linkedSlaves, activeSlaveId]);

  // Pré-carrega a config do slave ativo (GET) caso ainda não exista rascunho em cache
  useEffect(() => {
    if (!activeSlaveId || drafts[activeSlaveId]) return;
    let cancelled = false;
    setLoadingSlave(true);
    fetch(`/api/slaves/${activeSlaveId}/config`)
      .then((res) => (res.ok ? res.json() : { config: null }))
      .then((data) => {
        if (cancelled) return;
        const cfg = mapApiConfigToForm(data?.config);
        setDrafts((prev) => ({ ...prev, [activeSlaveId]: cfg }));
        // Se o backend já tinha config salva, considera o slave como configurado
        if (hasAnyConfigValue(cfg)) {
          setConfigured((prev) => new Set(prev).add(activeSlaveId));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts((prev) => ({ ...prev, [activeSlaveId]: emptySlaveConfig() }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlave(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlaveId, drafts]);

  const handleChange = (next: SlaveConfig) => {
    if (!activeSlaveId) return;
    setDrafts((prev) => ({ ...prev, [activeSlaveId]: next }));
  };

  const handleSave = async () => {
    if (!activeSlaveId) return;
    const cfg = drafts[activeSlaveId];
    setSaving(true);
    try {
      const res = await fetch(`/api/experiments/${expId}/slaves/${activeSlaveId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConfigPayload(cfg)),
      });
      if (!res.ok) throw new Error(await res.text());
      setConfigured((prev) => new Set(prev).add(activeSlaveId));
    } catch (err) {
      console.error('❌ Erro ao salvar config:', err);
    } finally {
      setSaving(false);
    }
  };

  const allConfigured = linkedSlaves.length > 0 && linkedSlaves.every((s) => configured.has(s.id));
  const activeConfig = activeSlaveId ? drafts[activeSlaveId] : undefined;
  const activeSlave = linkedSlaves.find((s) => s.id === activeSlaveId);

  return (
    <DashboardLayout
      title="Configurar Experimento"
      subtitle="Defina os parâmetros das slaves antes de iniciar"
      headerRight={
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/experimentos')}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-all duration-200"
            style={{ backgroundColor: 'var(--ev-bg-card)', border: '1px solid var(--ev-border-subtle)', color: 'var(--ev-text-secondary)' }}
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
          <button
            onClick={() => setLocation(`/experimento/${expId}`)}
            disabled={!allConfigured}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--ev-green-dim)', border: '1px solid var(--ev-green-muted)', color: 'var(--ev-green-primary)' }}
          >
            Concluir configuração
            <ArrowRight size={14} />
          </button>
        </div>
      }
    >
      {!experiment ? (
        <div className="flex flex-col items-center justify-center py-16 rounded ev-card" style={{ border: '1px dashed var(--ev-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--ev-text-secondary)' }}>Experimento não encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cabeçalho do experimento */}
          <div className="ev-card p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
                  {experiment.name}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--ev-text-muted)' }}>
                  {experiment.description || 'Sem descrição'}
                </p>
              </div>
              <StatusBadge status={experiment.status} className="ml-3" />
            </div>
          </div>

          {linkedSlaves.length === 0 ? (
            <div className="ev-card p-4 text-sm" style={{ color: 'var(--ev-text-muted)' }}>
              Nenhuma slave vinculada a este experimento.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {/* Lista lateral de slaves */}
              <div className="col-span-1 space-y-2">
                <h3 className="ev-label mb-2 flex items-center gap-2">
                  <Cpu size={14} /> Slaves ({configured.size}/{linkedSlaves.length})
                </h3>
                {linkedSlaves.map((slave) => {
                  const isConfigured = configured.has(slave.id);
                  const isActive = slave.id === activeSlaveId;
                  return (
                    <button
                      key={slave.id}
                      onClick={() => setActiveSlaveId(slave.id)}
                      className="w-full text-left p-3 rounded transition-all duration-200 flex items-center justify-between"
                      style={{
                        backgroundColor: isActive ? 'var(--ev-green-dim)' : 'var(--ev-bg-card)',
                        border: `1px solid ${isActive ? 'var(--ev-green-muted)' : 'var(--ev-border-subtle)'}`,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}>
                          {slave.hostname}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--ev-text-muted)' }}>{slave.ip}</div>
                      </div>
                      {isConfigured ? (
                        <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--ev-green-primary)' }}>
                          <CheckCircle2 size={13} /> Configurado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'var(--ev-text-muted)' }}>
                          <Clock size={13} /> Pendente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Formulário do slave ativo */}
              <div className="col-span-2">
                {loadingSlave || !activeConfig ? (
                  <div className="ev-card p-6 text-sm" style={{ color: 'var(--ev-text-muted)' }}>
                    Carregando configuração...
                  </div>
                ) : (
                  <SlaveConfigForm
                    title={`Configuração — ${activeSlave?.hostname ?? ''}`}
                    value={activeConfig}
                    onChange={handleChange}
                    onSave={handleSave}
                    saving={saving}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
