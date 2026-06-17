import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { useLiveData } from '@/contexts/LiveDataContext';
import SlaveConfigForm from '@/components/SlaveConfigForm';
import { ChevronLeft, CheckCircle2, AlertCircle, ArrowRight, Cpu } from 'lucide-react';

export default function ConfigureExperiment() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { experiments, slaves } = useLiveData();

  const expId = id ?? '';
  const experiment = experiments.find(e => e.id === expId);
  const expSlaves = slaves.filter(s => experiment?.slaveIds.includes(s.id));

  const [activeSlaveId, setActiveSlaveId] = useState<string>('');
  const [configuredSlaves, setConfiguredSlaves] = useState<Record<string, boolean>>({});
  const [initialConfigsMap, setInitialConfigsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Define active slave inicial quando expSlaves carregar
  useEffect(() => {
    if (expSlaves.length > 0 && !activeSlaveId) {
      setActiveSlaveId(expSlaves[0].id);
    }
  }, [expSlaves, activeSlaveId]);

  // Carrega configurações existentes no banco de dados para marcar quais slaves já estão configurados
  useEffect(() => {
    const fetchConfigs = async () => {
      if (!experiment) return;
      try {
        setLoading(true);
        for (const slaveId of experiment.slaveIds) {
          const res = await fetch(`/api/slaves/${slaveId}/config`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setConfiguredSlaves(prev => ({ ...prev, [slaveId]: true }));
              setInitialConfigsMap(prev => ({ ...prev, [slaveId]: data }));
            }
          }
        }
      } catch (err) {
        console.error('❌ Erro ao buscar configurações das slaves:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfigs();
  }, [experiment]);

  if (!experiment) {
    return (
      <DashboardLayout title="Configuração" subtitle="Experimento não encontrado">
        <div className="flex flex-col items-center justify-center py-16 gap-3 ev-card">
          <AlertCircle size={32} style={{ color: 'var(--ev-danger)' }} />
          <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
            Experimento não encontrado
          </p>
          <Link href="/experimentos">
            <button className="ev-btn-primary">Voltar para Experimentos</button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const handleSaveSlaveConfig = async (slaveId: string, configs: any[]) => {
    try {
      const res = await fetch(`/api/experiments/${expId}/slaves/${slaveId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs })
      });
      if (!res.ok) throw new Error(await res.text());

      // Marca como configurado localmente
      setConfiguredSlaves(prev => ({ ...prev, [slaveId]: true }));
      setInitialConfigsMap(prev => ({ ...prev, [slaveId]: configs }));
    } catch (err) {
      console.error('❌ Erro ao salvar configurações:', err);
      throw err;
    }
  };

  const allConfigured = expSlaves.length > 0 && expSlaves.every(s => configuredSlaves[s.id]);

  const handleFinish = () => {
    // Redireciona para o Dashboard do experimento (mantendo status 'draft')
    setLocation(`/experimento/${expId}`);
  };

  return (
    <DashboardLayout
      title="Configuração das Slaves"
      subtitle={`Defina os parâmetros operacionais para o experimento: ${experiment.name}`}
      headerRight={
        <Link href="/experimentos">
          <button className="flex items-center gap-1 text-xs text-[var(--ev-text-muted)] hover:text-white transition-colors cursor-pointer">
            <ChevronLeft size={14} />
            Voltar para lista
          </button>
        </Link>
      }
    >
      <div className="grid grid-cols-4 gap-6">
        {/* Lista Lateral de Slaves */}
        <div className="col-span-1 flex flex-col gap-3">
          <div className="ev-label px-1">Slaves Associadas</div>
          
          {loading ? (
            <div className="text-xs text-[var(--ev-text-muted)] font-mono p-4 text-center">
              Carregando configurações...
            </div>
          ) : expSlaves.length === 0 ? (
            <div className="text-xs text-[var(--ev-text-muted)] p-4 text-center ev-card">
              Nenhuma slave vinculada.
            </div>
          ) : (
            expSlaves.map(slave => {
              const isConfigured = configuredSlaves[slave.id];
              const isActive = activeSlaveId === slave.id;

              return (
                <div
                  key={slave.id}
                  onClick={() => setActiveSlaveId(slave.id)}
                  className="p-3.5 rounded border transition-all duration-200 cursor-pointer flex items-center justify-between"
                  style={{
                    backgroundColor: isActive ? 'var(--ev-green-dim)' : 'var(--ev-bg-card)',
                    borderColor: isActive ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cpu size={14} className={isActive ? 'text-[var(--ev-green-primary)]' : 'text-[var(--ev-text-muted)]'} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold font-mono truncate text-[var(--ev-text-primary)]">
                        {slave.hostname}
                      </span>
                      <span className="text-[10px] text-[var(--ev-text-muted)] font-mono truncate">
                        {slave.ip}
                      </span>
                    </div>
                  </div>

                  {isConfigured ? (
                    <span className="flex items-center text-[var(--ev-green-primary)]" title="Configurado">
                      <CheckCircle2 size={14} />
                    </span>
                  ) : (
                    <span className="flex items-center text-[var(--ev-warning)]" title="Configuração Pendente">
                      <AlertCircle size={14} />
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Botão de Concluir */}
          <div className="mt-4 pt-4 border-t border-[var(--ev-border-subtle)]">
            <button
              onClick={handleFinish}
              disabled={!allConfigured}
              className="w-full ev-btn-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: allConfigured ? 'var(--ev-green-primary)' : 'transparent',
                color: allConfigured ? 'var(--ev-bg-primary)' : 'var(--ev-text-muted)',
                border: allConfigured ? 'none' : '1px solid var(--ev-border-subtle)'
              }}
            >
              Concluir Configuração
              <ArrowRight size={14} />
            </button>
            {!allConfigured && (
              <p className="text-[10px] text-[var(--ev-text-muted)] text-center mt-2">
                Configure todas as slaves acima para concluir.
              </p>
            )}
          </div>
        </div>

        {/* Painel Central de Configuração */}
        <div className="col-span-3">
          <div className="ev-card p-6 min-h-[400px]">
            {expSlaves.map(slave => {
              const isActive = activeSlaveId === slave.id;
              
              // Renderiza todos os formulários e controla a visibilidade com CSS,
              // preservando o progresso de digitação do usuário ao alternar abas!
              return (
                <div key={slave.id} className={isActive ? 'block' : 'hidden'}>
                  <div className="flex items-center justify-between mb-5 border-b border-[var(--ev-border-subtle)] pb-3">
                    <div>
                      <h3 className="text-base font-bold font-mono" style={{ color: 'var(--ev-text-primary)' }}>
                        Parâmetros: {slave.hostname}
                      </h3>
                      <p className="text-xs text-[var(--ev-text-muted)]">
                        IP do Nó: {slave.ip} · Status: {slave.status}
                      </p>
                    </div>
                    {configuredSlaves[slave.id] ? (
                      <span className="ev-badge-active text-xs">✓ Salvo</span>
                    ) : (
                      <span className="ev-badge-warning text-xs">Pendente</span>
                    )}
                  </div>

                  <SlaveConfigForm
                    slaveId={slave.id}
                    onSave={(configs) => handleSaveSlaveConfig(slave.id, configs)}
                    initialConfigs={initialConfigsMap[slave.id]}
                    disabled={slave.status === 'offline'}
                  />
                </div>
              );
            })}
            
            {expSlaves.length === 0 && !loading && (
              <div className="flex items-center justify-center py-20 text-xs text-[var(--ev-text-muted)] font-mono">
                Selecione ou vincule slaves a este experimento para iniciar a parametrização.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
