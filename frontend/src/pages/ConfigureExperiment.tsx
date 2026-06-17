/*
 * ConfigureExperiment — stub navegável ("Bioluminescence")
 * Destino do fluxo de criação (POST /api/experiments -> /experimento/:id/configurar).
 * A configuração detalhada por slave (limites de DO/RPM/Temp + bombas) será
 * implementada na próxima etapa. Por enquanto mostra nome/descrição/status do
 * experimento e as slaves vinculadas.
 */
import { useParams, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import StatusBadge from '@/components/StatusBadge';
import { useLiveData } from '@/contexts/LiveDataContext';
import { ArrowLeft, Cpu, Settings } from 'lucide-react';

export default function ConfigureExperiment() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { experiments, slaves } = useLiveData();

  const experiment = experiments.find((e) => e.id === params.id);
  const linkedSlaves = slaves.filter((s) => s.experimentId === params.id);

  return (
    <DashboardLayout
      title="Configurar Experimento"
      subtitle="Defina os parâmetros das slaves antes de iniciar o experimento"
      headerRight={
        <button
          onClick={() => setLocation('/experimentos')}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-all duration-200"
          style={{
            backgroundColor: 'var(--ev-bg-card)',
            border: '1px solid var(--ev-border-subtle)',
            color: 'var(--ev-text-secondary)',
          }}
        >
          <ArrowLeft size={14} />
          Voltar
        </button>
      }
    >
      {!experiment ? (
        <div className="flex flex-col items-center justify-center py-16 rounded ev-card" style={{ border: '1px dashed var(--ev-border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--ev-text-secondary)' }}>
            Experimento não encontrado.
          </p>
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

          {/* Slaves vinculadas */}
          <div>
            <h3 className="ev-label mb-3 flex items-center gap-2">
              <Cpu size={14} /> Slaves vinculadas ({linkedSlaves.length})
            </h3>
            {linkedSlaves.length === 0 ? (
              <div className="ev-card p-4 text-sm" style={{ color: 'var(--ev-text-muted)' }}>
                Nenhuma slave vinculada a este experimento.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {linkedSlaves.map((slave) => (
                  <div key={slave.id} className="ev-card p-4">
                    <div className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}>
                      {slave.hostname}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--ev-text-muted)' }}>
                      {slave.ip} · {slave.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placeholder da configuração detalhada (próxima etapa) */}
          <div className="ev-card p-6 flex flex-col items-center text-center" style={{ border: '1px dashed var(--ev-border-subtle)' }}>
            <Settings size={28} className="mb-2" style={{ color: 'var(--ev-green-primary)' }} />
            <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
              Configuração detalhada por slave
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--ev-text-muted)' }}>
              Limites de DO, RPM e Temperatura + tempos das bombas — em breve (próxima etapa).
            </p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
