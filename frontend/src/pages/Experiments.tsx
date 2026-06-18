import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Link, useLocation } from 'wouter';
import { useLiveData } from '@/contexts/LiveDataContext';
import { ChevronRight, X, FlaskConical, Trash2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import Fab from '@/components/Fab';
import { formatDateTime } from '@/lib/utils';

export default function Experiments() {
  const { experiments, slaves, deleteExperiment } = useLiveData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [selectedSlaves, setSelectedSlaves] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const openModal = () => {
    setNewExpName('');
    setNewExpDesc('');
    setSelectedSlaves(new Set());
    setCreateError('');
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    // Validação: nome obrigatório e pelo menos 1 slave
    if (!newExpName.trim() || selectedSlaves.size === 0) return;
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExpName.trim(),
          description: newExpDesc,
          slaveIds: Array.from(selectedSlaves),
          researcherId: user.id,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erro ao criar experimento.' }));
        throw new Error(error || 'Erro ao criar experimento.');
      }
      const { id: newId } = await res.json();
      // LiveDataContext recebe EXPERIMENT_CREATED via WebSocket e atualiza o estado
      setIsModalOpen(false);
      setLocation(`/experimento/${newId}/configurar`);
    } catch (err) {
      console.error('❌ Erro ao criar experimento:', err);
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar experimento.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteExperiment(id);
  };
  return (
    <DashboardLayout
      title="Meus Experimentos"
      subtitle="Visualize e gerencie todos os experimentos de biorreatores"
    >
      {experiments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded ev-card" style={{ border: '1px dashed var(--ev-border-subtle)', backgroundColor: 'var(--ev-bg-card)' }}>
          <FlaskConical size={36} className="mb-3 animate-pulse" style={{ color: 'var(--ev-green-primary)' }} />
          <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
            Nenhum experimento ativo encontrado
          </p>
          <p className="text-xs text-center mt-1" style={{ color: 'var(--ev-text-muted)' }}>
            Clique em "New Experiment" para criar e iniciar o monitoramento de um novo ensaio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {experiments.map((exp, i) => (
            <div
              key={exp.id}
              className="ev-card animate-fade-in-up flex flex-col"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Link href={`/experimento/${exp.id}`}>
              <div className="p-4 cursor-pointer flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-sm truncate"
                      style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
                    >
                      {exp.name}
                    </div>
                    <div className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--ev-text-muted)' }}>
                      {exp.description}
                    </div>
                  </div>
                  <StatusBadge status={exp.status} className="ml-3" />
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <div className="ev-label mb-0.5">Criado em</div>
                    <div
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
                    >
                      {formatDateTime(exp.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="ev-label mb-0.5">Slaves</div>
                    <div
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
                    >
                      {exp.slaveIds.length}
                    </div>
                  </div>
                  <div>
                    <div className="ev-label mb-0.5">Researcher</div>
                    <div
                      className="truncate max-w-[120px]"
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
                      title={exp.researcher.name}
                    >
                      {exp.researcher.name}
                    </div>
                  </div>
                  {exp.alertCount > 0 && (
                    <div>
                      <div className="ev-label mb-0.5">Alerts</div>
                      <div
                        style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#d4a017' }}
                      >
                        {exp.alertCount}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        backgroundColor: 'var(--ev-green-dim)',
                        border: '1px solid var(--ev-green-muted)',
                        color: 'var(--ev-green-primary)',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '0.6rem',
                      }}
                      title={exp.researcher.name}
                    >
                      {exp.researcher.avatar}
                    </div>
                    <span className="text-xs truncate" style={{ color: 'var(--ev-text-muted)', fontFamily: 'Space Grotesk, monospace' }}>
                      {exp.researcher.name}
                    </span>
                  </div>
                  <span
                    className="text-xs flex items-center gap-1"
                    style={{ color: 'var(--ev-text-muted)' }}
                  >
                    View details
                    <ChevronRight size={11} />
                  </span>
                </div>
              </div>
              </Link>

              {/* Delete button — fora do Link para não navegar */}
              <div
                className="flex items-center justify-end px-4 py-2"
                style={{ borderTop: '1px solid var(--ev-border-subtle)' }}
              >
                {confirmDeleteId === exp.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#d4a017' }}>Confirmar exclusão?</span>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(197,48,48,0.15)', color: '#e74c3c', border: '1px solid rgba(197,48,48,0.3)' }}
                    >
                      Excluir
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs"
                      style={{ color: 'var(--ev-text-muted)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(exp.id)}
                    className="flex items-center gap-1 text-xs transition-colors duration-200"
                    style={{ color: 'var(--ev-text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#e74c3c')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ev-text-muted)')}
                  >
                    <Trash2 size={11} />
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="ev-card w-full max-w-lg p-6 relative shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
              Novo Experimento
            </h2>

            <div className="space-y-4">
              <div>
                <label className="ev-label block mb-1">Nome *</label>
                <input
                  type="text"
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="w-full bg-transparent border rounded px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: 'var(--ev-border-subtle)', color: 'var(--ev-text-primary)' }}
                  placeholder="Ex: Curva de crescimento de E. coli"
                />
              </div>

              <div>
                <label className="ev-label block mb-1">Descrição</label>
                <textarea
                  value={newExpDesc}
                  onChange={e => setNewExpDesc(e.target.value)}
                  className="w-full bg-transparent border rounded px-3 py-2 text-sm focus:outline-none h-20 resize-none transition-colors"
                  style={{ borderColor: 'var(--ev-border-subtle)', color: 'var(--ev-text-primary)' }}
                  placeholder="Descrição do experimento..."
                />
              </div>

              <div>
                <label className="ev-label block mb-2">Slaves disponíveis *</label>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {slaves.map(slave => {
                    const isAvailable = slave.experimentId === null && slave.status !== 'offline';
                    const isSelected = selectedSlaves.has(slave.id);
                    return (
                      <div
                        key={slave.id}
                        className={`flex items-center gap-2 p-2 rounded border transition-colors duration-200 ${isAvailable ? 'cursor-pointer hover:bg-white/5' : 'opacity-40 cursor-not-allowed'}`}
                        style={{
                          borderColor: isSelected ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)',
                          backgroundColor: isSelected ? 'var(--ev-green-dim)' : 'transparent'
                        }}
                        onClick={() => {
                          if (!isAvailable) return;
                          const next = new Set(selectedSlaves);
                          if (next.has(slave.id)) next.delete(slave.id);
                          else next.add(slave.id);
                          setSelectedSlaves(next);
                        }}
                      >
                        {/* Checkbox visual */}
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            border: `1px solid ${isSelected ? 'var(--ev-green-primary)' : 'var(--ev-border-default)'}`,
                            backgroundColor: isSelected ? 'var(--ev-green-primary)' : 'transparent',
                          }}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} style={{ color: 'var(--ev-bg-primary)' }} />}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}>{slave.hostname}</span>
                          <span className="text-xs truncate" style={{ color: isAvailable ? 'var(--ev-text-muted)' : '#d4a017' }}>
                            {isAvailable
                              ? (slave.status === 'idle' ? 'Disponível' : 'Ativo')
                              : (slave.status === 'offline' ? 'Offline' : 'Em uso')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {slaves.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ev-text-muted)' }}>
                    Nenhuma slave registrada.
                  </p>
                )}
              </div>
            </div>

            {createError && (
              <p className="text-sm mt-3" style={{ color: 'var(--ev-danger)' }}>
                {createError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded text-sm transition-colors hover:bg-white/5"
                style={{ color: 'var(--ev-text-muted)', border: '1px solid var(--ev-border-subtle)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newExpName.trim() || selectedSlaves.size === 0 || creating}
                className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: 'var(--ev-green-primary)', color: 'var(--ev-bg-primary)' }}
              >
                {creating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB — criar novo experimento */}
      <Fab onClick={openModal} title="Novo experimento" />
    </DashboardLayout>
  );
}
