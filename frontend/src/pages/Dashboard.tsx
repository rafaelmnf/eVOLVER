/*
 * eVOLVER Dashboard — "Bioluminescence" Design
 * Main monitoring view: system overview + slave cards grid
 * Real-time sensor data with sparklines, alert counters
 */

import DashboardLayout from '@/components/DashboardLayout';
import SlaveCard from '@/components/SlaveCard';
import { Link } from 'wouter';
import { formatRelativeTime } from '@/lib/mockData';
import { useLiveData } from '@/contexts/LiveDataContext';
import {
  Activity,
  FlaskConical,
  AlertTriangle,
  Cpu,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export default function Dashboard() {
  const { slaves, experiments, alerts, master } = useLiveData();
  
  const activeSlaves = slaves.filter(s => s.status === 'active').length;
  const warningSlaves = slaves.filter(s => s.status === 'warning').length;
  const offlineSlaves = slaves.filter(s => s.status === 'offline').length;
  const runningExperiments = experiments.filter(e => e.status === 'running').length;
  const unresolvedAlerts = alerts.filter(a => !a.resolved).length;

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={`System overview · Last sync ${formatRelativeTime(master.lastSync)}`}
      headerRight={
        <button
          className="flex items-center gap-2 text-xs px-3 py-2 rounded transition-all duration-200"
          style={{
            backgroundColor: 'var(--ev-bg-card)',
            border: '1px solid var(--ev-border-subtle)',
            color: 'var(--ev-text-muted)',
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
          <RefreshCw size={13} />
          Refresh
        </button>
      }
    >
      {/* System stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Cpu size={18} />}
          label="Slave Nodes"
          value={`${activeSlaves}/${slaves.length}`}
          sub={`${warningSlaves} warning · ${offlineSlaves} offline`}
          color="var(--ev-green-primary)"
          index={0}
        />
        <StatCard
          icon={<FlaskConical size={18} />}
          label="Running Experiments"
          value={String(runningExperiments)}
          sub={`${experiments.length} total`}
          color="var(--ev-green-primary)"
          index={1}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Unresolved Alerts"
          value={String(unresolvedAlerts)}
          sub={`${alerts.length} total`}
          color={unresolvedAlerts > 0 ? '#d4a017' : 'var(--ev-green-primary)'}
          index={2}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Master Uptime"
          value={master.uptime}
          sub={`Sync ${formatRelativeTime(master.lastSync)}`}
          color="var(--ev-green-primary)"
          index={3}
        />
      </div>

      {/* Active experiments */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
          >
            Active Experiments
          </h2>
          <Link href="/experimentos">
            <button
              className="flex items-center gap-1 text-xs transition-colors duration-200"
              style={{ color: 'var(--ev-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ev-green-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ev-text-muted)')}
            >
              View all
              <ChevronRight size={12} />
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {experiments
            .filter(e => e.status === 'running')
            .map((exp, i) => (
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
                    <span className="ev-badge-active ml-3 flex-shrink-0 flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block animate-pulse-dot"
                        style={{ backgroundColor: 'var(--ev-green-primary)' }}
                      />
                      Running
                    </span>
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
      </section>

      {/* Slave cards grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
          >
            Slave Nodes
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--ev-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--ev-green-primary)' }} />
              Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#d4a017' }} />
              Warning
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4a6a4a' }} />
              Offline
            </span>
          </div>
        </div>

        {slaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded ev-card" style={{ border: '1px dashed var(--ev-border-subtle)', backgroundColor: 'var(--ev-bg-card)', minHeight: '180px' }}>
            <Cpu size={36} className="mb-3 animate-pulse" style={{ color: 'var(--ev-green-primary)' }} />
            <p className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-secondary)' }}>
              Aguardando conexões das Raspberry Pi...
            </p>
            <p className="text-xs text-center mt-1" style={{ color: 'var(--ev-text-muted)' }}>
              Conecte uma Raspberry Pi Pico 2 na rede e envie dados via MQTT para vê-la aparecer aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {slaves.map((slave, i) => (
              <SlaveCard key={slave.id} slave={slave} index={i} />
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  index,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  index: number;
}) {
  return (
    <div
      className={`ev-card p-4 animate-fade-in-up stagger-${index + 1}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div style={{ color }}>{icon}</div>
        <span className="ev-label">{label}</span>
      </div>
      <div
        className="text-2xl font-bold mb-1"
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          color,
          textShadow: `0 0 12px ${color}40`,
        }}
      >
        {value}
      </div>
      <div className="text-xs" style={{ color: 'var(--ev-text-muted)' }}>
        {sub}
      </div>
    </div>
  );
}
