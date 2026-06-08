import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Link, useLocation } from 'wouter';
import { Experiment } from '@/lib/mockData';
import { useLiveData } from '@/contexts/LiveDataContext';
import { ChevronRight, Plus, X, FlaskConical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Experiments() {
  const { experiments: liveExperiments, slaves } = useLiveData();
  const [experiments, setExperiments] = useState(liveExperiments);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [selectedSlaves, setSelectedSlaves] = useState<Set<string>>(new Set());
  
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleCreate = () => {
    if (!user) return;
    const newId = `exp-00${liveExperiments.length + 1}`;
    
    const newExp: Experiment = {
      id: newId,
      name: newExpName || 'Untitled Experiment',
      description: newExpDesc,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      duration: '0h 0m',
      slaveIds: Array.from(selectedSlaves),
      alertCount: 0,
      researchers: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'owner',
          avatar: user.name.substring(0, 2).toUpperCase()
        }
      ]
    };

    // Update slaves to belong to this new experiment
    slaves.forEach(slave => {
      if (selectedSlaves.has(slave.id)) {
        slave.experimentId = newId;
      }
    });

    liveExperiments.push(newExp);
    setExperiments([...liveExperiments]);
    setIsModalOpen(false);
    setLocation(`/experimento/${newId}`);
  };
  return (
    <DashboardLayout
      title="Experiments"
      subtitle="View and manage all bioreactor experiments"
      headerRight={
        <button
          onClick={() => {
            setNewExpName('');
            setNewExpDesc('');
            setSelectedSlaves(new Set());
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-all duration-200"
          style={{
            backgroundColor: 'var(--ev-green-dim)',
            border: '1px solid var(--ev-green-muted)',
            color: 'var(--ev-green-primary)',
          }}
        >
          <Plus size={14} />
          New Experiment
        </button>
      }
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
            <Link key={exp.id} href={`/experimento/${exp.id}`}>
              <div
                className="ev-card p-4 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
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
                  {exp.status === 'running' ? (
                    <span className="ev-badge-active ml-3 flex-shrink-0 flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block animate-pulse-dot"
                        style={{ backgroundColor: 'var(--ev-green-primary)' }}
                      />
                      Running
                    </span>
                  ) : exp.status === 'completed' ? (
                    <span className="ev-badge ml-3 flex-shrink-0 flex items-center gap-1" style={{ backgroundColor: 'var(--ev-bg-card)', color: 'var(--ev-text-muted)', border: '1px solid var(--ev-border-subtle)' }}>
                      Completed
                    </span>
                  ) : (
                    <span className="ev-badge ml-3 flex-shrink-0 flex items-center gap-1" style={{ backgroundColor: 'var(--ev-bg-card)', color: 'var(--ev-text-muted)', border: '1px solid var(--ev-border-subtle)' }}>
                      {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <div className="ev-label mb-0.5">Duration</div>
                    <div
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
                    >
                      {exp.duration}
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
                    <div className="ev-label mb-0.5">Researchers</div>
                    <div
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
                    >
                      {exp.researchers.length}
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
                  <div className="flex -space-x-1">
                    {exp.researchers.slice(0, 3).map(r => (
                      <div
                        key={r.id}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: 'var(--ev-green-dim)',
                          border: '1px solid var(--ev-green-muted)',
                          color: 'var(--ev-green-primary)',
                          fontFamily: 'IBM Plex Mono, monospace',
                          fontSize: '0.6rem',
                        }}
                        title={r.name}
                      >
                        {r.avatar}
                      </div>
                    ))}
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
              New Experiment
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="ev-label block mb-1">Name</label>
                <input
                  type="text"
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="w-full bg-transparent border rounded px-3 py-2 text-sm focus:outline-none transition-colors"
                  style={{ borderColor: 'var(--ev-border-subtle)', color: 'var(--ev-text-primary)' }}
                  placeholder="E. coli Growth Curve"
                />
              </div>
              
              <div>
                <label className="ev-label block mb-1">Description</label>
                <textarea
                  value={newExpDesc}
                  onChange={e => setNewExpDesc(e.target.value)}
                  className="w-full bg-transparent border rounded px-3 py-2 text-sm focus:outline-none h-20 resize-none transition-colors"
                  style={{ borderColor: 'var(--ev-border-subtle)', color: 'var(--ev-text-primary)' }}
                  placeholder="Experiment description..."
                />
              </div>

              <div>
                <label className="ev-label block mb-2">Available Slave Nodes</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {slaves.map(slave => {
                    const isAvailable = slave.experimentId === null && slave.status !== 'offline';
                    const isSelected = selectedSlaves.has(slave.id);
                    return (
                      <div
                        key={slave.id}
                        className={`flex items-center justify-between p-2 rounded border transition-colors duration-200 ${isAvailable ? 'cursor-pointer hover:bg-white/5' : 'opacity-40 cursor-not-allowed'}`}
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
                        <div className="flex flex-col">
                          <span className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}>{slave.hostname}</span>
                          <span className="text-xs" style={{ color: 'var(--ev-text-muted)' }}>{slave.ip}</span>
                        </div>
                        <span className="text-xs" style={{ color: isAvailable ? (isSelected ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)') : '#d4a017' }}>
                          {isAvailable ? (isSelected ? '✓ Selected' : 'Available') : (slave.status === 'offline' ? 'Offline' : 'In Use')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded text-sm transition-colors hover:bg-white/5"
                style={{ color: 'var(--ev-text-muted)', border: '1px solid var(--ev-border-subtle)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newExpName || selectedSlaves.size === 0}
                className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: 'var(--ev-green-primary)', color: 'var(--ev-bg-primary)' }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
