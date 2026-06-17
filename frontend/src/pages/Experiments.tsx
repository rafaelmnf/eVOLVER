import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Link, useLocation } from 'wouter';
import { useLiveData } from '@/contexts/LiveDataContext';
import { ChevronRight, Plus, X, FlaskConical, Trash2, Cpu, Calendar, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Experiments() {
  const { experiments, slaves, deleteExperiment } = useLiveData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [selectedSlaves, setSelectedSlaves] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleCreate = async () => {
    if (!user || !newExpName.trim() || selectedSlaves.size === 0) return;
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExpName.trim(),
          description: newExpDesc.trim(),
          slaveIds: Array.from(selectedSlaves),
          researcherName: user.name,
          researcherEmail: user.email,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id: newId } = await res.json();
      setIsModalOpen(false);
      // Navega para a tela de configuração das slaves
      setLocation(`/experimento/${newId}/configurar`);
    } catch (err) {
      console.error('❌ Erro ao criar experimento:', err);
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout
      title="Meus Experimentos"
      subtitle="Gerencie e acompanhe todos os ensaios em andamento nos biorreatores"
      headerRight={
        <div className="text-xs text-[var(--ev-text-muted)]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          Total: {experiments.length} experimentos
        </div>
      }
    >
      {experiments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded ev-card" style={{ border: '1px dashed var(--ev-border-subtle)', backgroundColor: 'var(--ev-bg-card)' }}>
          <FlaskConical size={42} className="mb-4 animate-pulse" style={{ color: 'var(--ev-green-primary)' }} />
          <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
            Nenhum experimento encontrado
          </p>
          <p className="text-xs text-center mt-1" style={{ color: 'var(--ev-text-muted)' }}>
            Clique no botão "+" no canto inferior direito para configurar e iniciar um novo ensaio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {experiments.map((exp, i) => {
            const isDraft = exp.status === 'draft';
            const isRunning = exp.status === 'running';
            const isCompleted = exp.status === 'completed';
            const isPaused = exp.status === 'paused';

            return (
              <div
                key={exp.id}
                className="ev-card animate-fade-in-up flex flex-col justify-between"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Link href={`/experimento/${exp.id}`}>
                  <div className="p-5 cursor-pointer flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <div
                          className="font-semibold text-sm truncate"
                          style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
                        >
                          {exp.name}
                        </div>
                        <div className="text-xs mt-1 text-[var(--ev-text-muted)] font-mono truncate">
                          ID: {exp.id}
                        </div>
                      </div>
                      
                      {isRunning ? (
                        <span className="ev-badge-active flex-shrink-0 flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block animate-pulse-dot"
                            style={{ backgroundColor: 'var(--ev-green-primary)' }}
                          />
                          Em execução
                        </span>
                      ) : isDraft ? (
                        <span className="ev-badge flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--ev-text-secondary)', border: '1px solid var(--ev-border-subtle)' }}>
                          Rascunho
                        </span>
                      ) : isCompleted ? (
                        <span className="ev-badge-offline flex-shrink-0">
                          Finalizado
                        </span>
                      ) : isPaused ? (
                        <span className="ev-badge-warning flex-shrink-0">
                          Pausado
                        </span>
                      ) : (
                        <span className="ev-badge flex-shrink-0" style={{ backgroundColor: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)' }}>
                          {exp.status === 'error' ? 'Erro' : exp.status.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs mb-4 line-clamp-2" style={{ color: 'var(--ev-text-secondary)' }}>
                      {exp.description || 'Nenhuma descrição fornecida.'}
                    </p>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
                      <div>
                        <div className="ev-label mb-0.5" style={{ fontSize: '0.6rem' }}>Criado em</div>
                        <div className="flex items-center gap-1 font-mono text-[var(--ev-text-secondary)]">
                          <Calendar size={11} className="text-[var(--ev-text-muted)]" />
                          {formatDate(exp.createdAt)}
                        </div>
                      </div>
                      <div>
                        <div className="ev-label mb-0.5" style={{ fontSize: '0.6rem' }}>Atualizado em</div>
                        <div className="flex items-center gap-1 font-mono text-[var(--ev-text-secondary)]">
                          <Calendar size={11} className="text-[var(--ev-text-muted)]" />
                          {formatDate(exp.updatedAt)}
                        </div>
                      </div>
                      <div>
                        <div className="ev-label mb-0.5" style={{ fontSize: '0.6rem' }}>Iniciado em</div>
                        <div className="flex items-center gap-1 font-mono text-[var(--ev-text-secondary)]">
                          <Calendar size={11} className="text-[var(--ev-text-muted)]" />
                          {formatDate(exp.startedAt)}
                        </div>
                      </div>
                      <div>
                        <div className="ev-label mb-0.5" style={{ fontSize: '0.6rem' }}>Pesquisador</div>
                        <div className="flex items-center gap-1 font-mono text-[var(--ev-text-secondary)] truncate" title={exp.researcher.name}>
                          <User size={11} className="text-[var(--ev-text-muted)]" />
                          <span className="truncate max-w-[100px]">{exp.researcher.name || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 text-xs" style={{ borderTop: '1px dashed var(--ev-border-subtle)' }}>
                      <div className="flex items-center gap-1.5">
                        <Cpu size={12} className="text-[var(--ev-green-primary)]" />
                        <span style={{ color: 'var(--ev-text-secondary)' }}>Slaves vinculados:</span>
                        <strong className="font-mono text-[var(--ev-green-primary)]">{exp.slaveIds.length}</strong>
                      </div>
                      <span className="flex items-center gap-0.5 text-[var(--ev-green-primary)] hover:underline">
                        Acessar painel
                        <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Excluir button */}
                <div
                  className="flex items-center justify-end px-4 py-2 text-xs"
                  style={{ borderTop: '1px solid var(--ev-border-subtle)', backgroundColor: 'rgba(255,255,255,0.01)' }}
                >
                  {confirmDeleteId === exp.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--ev-warning)' }}>Confirmar exclusão?</span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-xs px-2 py-0.5 rounded font-semibold transition-colors"
                        style={{ backgroundColor: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.3)' }}
                      >
                        Sim, excluir
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs hover:underline text-[var(--ev-text-muted)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="flex items-center gap-1 text-[var(--ev-text-muted)] hover:text-[#e74c3c] transition-colors"
                    >
                      <Trash2 size={12} />
                      Excluir rascunho
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => {
          setNewExpName('');
          setNewExpDesc('');
          setSelectedSlaves(new Set());
          setIsModalOpen(true);
        }}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 z-30 cursor-pointer"
        style={{
          backgroundColor: 'var(--ev-green-primary)',
          color: 'var(--ev-bg-primary)',
          boxShadow: '0 0 20px var(--ev-green-glow)'
        }}
        title="Novo Experimento"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* modal de criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="ev-card w-full max-w-lg p-6 relative shadow-2xl animate-fade-in-up">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--ev-text-muted)] hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
              Criar Novo Experimento
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="ev-label block mb-1">Nome do Experimento *</label>
                <input
                  type="text"
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="w-full ev-input"
                  placeholder="Ex: Curva de Crescimento E. coli - Meio LB"
                  required
                />
              </div>
              
              <div>
                <label className="ev-label block mb-1">Descrição</label>
                <textarea
                  value={newExpDesc}
                  onChange={e => setNewExpDesc(e.target.value)}
                  className="w-full ev-input h-20 resize-none"
                  placeholder="Descreva as condições, objetivos ou anotações do experimento..."
                />
              </div>

              <div>
                <label className="ev-label block mb-2">Selecione as Slaves Disponíveis *</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {slaves.length === 0 ? (
                    <div className="text-xs text-[var(--ev-text-muted)] py-4 text-center">
                      Nenhuma slave cadastrada no sistema.
                    </div>
                  ) : (
                    slaves.map(slave => {
                      const isAvailable = slave.experimentId === null && slave.status !== 'offline';
                      const isSelected = selectedSlaves.has(slave.id);
                      return (
                        <div
                          key={slave.id}
                          className={`flex items-center justify-between p-3 rounded border transition-all duration-200 ${isAvailable ? 'cursor-pointer hover:bg-white/5' : 'opacity-40 cursor-not-allowed'}`}
                          style={{
                            borderColor: isSelected ? 'var(--ev-green-primary)' : 'var(--ev-border-subtle)',
                            backgroundColor: isSelected ? 'var(--ev-green-dim)' : 'rgba(255,255,255,0.01)'
                          }}
                          onClick={() => {
                            if (!isAvailable) return;
                            const next = new Set(selectedSlaves);
                            if (next.has(slave.id)) next.delete(slave.id);
                            else next.add(slave.id);
                            setSelectedSlaves(next);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isAvailable}
                              onChange={() => {}} // Handle no click da div
                              className="accent-[var(--ev-green-primary)] cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium font-mono" style={{ color: 'var(--ev-text-primary)' }}>
                                {slave.hostname}
                              </span>
                              <span className="text-xs text-[var(--ev-text-muted)]">
                                IP: {slave.ip}
                              </span>
                            </div>
                          </div>
                          
                          <span className="text-xs" style={{ color: isAvailable ? (isSelected ? 'var(--ev-green-primary)' : 'var(--ev-text-secondary)') : 'var(--ev-text-muted)' }}>
                            {isAvailable
                              ? (isSelected ? '✓ Selecionado' : 'Disponível')
                              : (slave.status === 'offline' ? 'Offline' : 'Em uso')}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                className="ev-btn-secondary"
                style={{ padding: '0.4rem 1rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newExpName.trim() || selectedSlaves.size === 0}
                className="ev-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ padding: '0.4rem 1rem' }}
              >
                Avançar para Configuração
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
