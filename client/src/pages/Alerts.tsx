/*
 * eVOLVER Alerts Page — "Bioluminescence" Design
 * Full alerts management: filter by severity/status, resolve inline
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { mockAlerts, Alert, formatRelativeTime, getSensorLabel } from '@/lib/mockData';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Filter,
} from 'lucide-react';

type FilterType = 'all' | 'critical' | 'warning' | 'info' | 'resolved';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [filter, setFilter] = useState<FilterType>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleResolve(id: string) {
    if (confirmingId === id) {
      setAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a)
      );
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  }

  const filtered = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'resolved') return a.resolved;
    return !a.resolved && a.severity === filter;
  });

  const counts = {
    all: alerts.length,
    critical: alerts.filter(a => !a.resolved && a.severity === 'critical').length,
    warning: alerts.filter(a => !a.resolved && a.severity === 'warning').length,
    info: alerts.filter(a => !a.resolved && a.severity === 'info').length,
    resolved: alerts.filter(a => a.resolved).length,
  };

  const filterConfig: { key: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: 'All', icon: <Filter size={13} />, color: 'var(--ev-text-secondary)' },
    { key: 'critical', label: 'Critical', icon: <AlertCircle size={13} />, color: '#e74c3c' },
    { key: 'warning', label: 'Warning', icon: <AlertTriangle size={13} />, color: '#d4a017' },
    { key: 'info', label: 'Info', icon: <Info size={13} />, color: '#2e86c1' },
    { key: 'resolved', label: 'Resolved', icon: <CheckCircle2 size={13} />, color: 'var(--ev-green-primary)' },
  ];

  return (
    <DashboardLayout
      title="Alerts"
      subtitle="System events and threshold violations"
    >
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Critical', count: counts.critical, color: '#e74c3c', bg: 'rgba(192,57,43,0.08)', border: 'rgba(192,57,43,0.25)' },
          { label: 'Warning', count: counts.warning, color: '#d4a017', bg: 'rgba(212,160,23,0.08)', border: 'rgba(212,160,23,0.25)' },
          { label: 'Info', count: counts.info, color: '#2e86c1', bg: 'rgba(46,134,193,0.08)', border: 'rgba(46,134,193,0.25)' },
          { label: 'Resolved', count: counts.resolved, color: 'var(--ev-green-primary)', bg: 'var(--ev-green-dim)', border: 'var(--ev-green-muted)' },
        ].map(s => (
          <div
            key={s.label}
            className="rounded p-4 animate-fade-in-up"
            style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
          >
            <div className="ev-label mb-2">{s.label}</div>
            <div
              className="text-3xl font-bold"
              style={{ fontFamily: 'IBM Plex Mono, monospace', color: s.color }}
            >
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 mb-4 p-1 rounded"
        style={{ backgroundColor: 'var(--ev-bg-card)', border: '1px solid var(--ev-border-subtle)', display: 'inline-flex' }}
      >
        {filterConfig.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-200"
            style={{
              backgroundColor: filter === f.key ? 'var(--ev-bg-elevated)' : 'transparent',
              color: filter === f.key ? f.color : 'var(--ev-text-muted)',
              border: filter === f.key ? '1px solid var(--ev-border-default)' : '1px solid transparent',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: filter === f.key ? 600 : 400,
            }}
          >
            {f.icon}
            {f.label}
            <span
              className="px-1.5 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: 'rgba(29,185,84,0.1)',
                color: 'var(--ev-text-muted)',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '0.65rem',
              }}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Alerts table */}
      <div className="ev-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle2 size={32} style={{ color: 'var(--ev-green-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--ev-text-secondary)' }}>
              No alerts matching the current filter.
            </p>
          </div>
        ) : (
          <table className="ev-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Sensor</th>
                <th>Message</th>
                <th>Device</th>
                <th>Experiment</th>
                <th>Value</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert, i) => {
                const isConfirming = confirmingId === alert.id;
                const severityConfig = {
                  critical: { icon: AlertCircle, color: '#e74c3c', label: 'CRITICAL' },
                  warning: { icon: AlertTriangle, color: '#d4a017', label: 'WARNING' },
                  info: { icon: Info, color: '#2e86c1', label: 'INFO' },
                };
                const cfg = severityConfig[alert.severity];
                const Icon = cfg.icon;

                return (
                  <tr
                    key={alert.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 30}ms`, opacity: alert.resolved ? 0.5 : 1 }}
                  >
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Icon size={12} style={{ color: cfg.color }} />
                        <span
                          style={{
                            color: cfg.color,
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}>
                        {getSensorLabel(alert.sensor)}
                      </span>
                    </td>
                    <td style={{ maxWidth: 280 }}>
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
                        {alert.experimentId ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'IBM Plex Mono, monospace',
                          color: alert.resolved ? 'var(--ev-text-muted)' : cfg.color,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {alert.value > 0 ? alert.value : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-muted)', fontSize: '0.8rem' }}>
                        {formatRelativeTime(alert.timestamp)}
                      </span>
                    </td>
                    <td>
                      {alert.resolved ? (
                        <span className="ev-badge-active" style={{ fontSize: '0.65rem' }}>✓ Resolved</span>
                      ) : (
                        <span className="ev-badge-warning" style={{ fontSize: '0.65rem' }}>Active</span>
                      )}
                    </td>
                    <td>
                      {!alert.resolved && (
                        isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResolve(alert.id)}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: 'var(--ev-green-dim)',
                                color: 'var(--ev-green-primary)',
                                border: '1px solid var(--ev-green-muted)',
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="text-xs"
                              style={{ color: 'var(--ev-text-muted)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            className="text-xs px-2 py-0.5 rounded transition-all duration-150"
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
                            Resolve
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
