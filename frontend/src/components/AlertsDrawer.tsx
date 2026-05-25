/*
 * eVOLVER AlertsDrawer — "Bioluminescence" Design
 * Slide-in drawer from right showing alerts ordered by severity
 * Inline resolve action with confirmation
 */

import { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Alert, formatRelativeTime, getSensorLabel } from '@/lib/mockData';
import { useLiveData } from '@/contexts/LiveDataContext';

interface AlertsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function AlertsDrawer({ open, onClose }: AlertsDrawerProps) {
  const { alerts, resolveAlert } = useLiveData();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const unresolvedAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  function handleResolve(id: string) {
    if (confirmingId === id) {
      resolveAlert(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-screen z-50 flex flex-col overflow-hidden"
        style={{
          width: '400px',
          backgroundColor: 'var(--ev-bg-secondary)',
          borderLeft: '1px solid var(--ev-border-default)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
          boxShadow: open ? '-8px 0 40px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
        >
          <div>
            <h2
              className="font-bold text-base"
              style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
            >
              Alerts
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ev-text-muted)' }}>
              {unresolvedAlerts.length} unresolved
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors duration-200"
            style={{ color: 'var(--ev-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ev-text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ev-text-muted)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto">
          {unresolvedAlerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <CheckCircle2 size={32} style={{ color: 'var(--ev-green-primary)', marginBottom: '12px' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--ev-text-secondary)' }}>
                No unresolved alerts
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ev-text-muted)' }}>
                All systems operating within parameters.
              </p>
            </div>
          )}

          {unresolvedAlerts.length > 0 && (
            <div className="p-4 space-y-3">
              <div className="ev-label mb-2">Active</div>
              {unresolvedAlerts.map((alert, i) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  confirmingId={confirmingId}
                  onResolve={handleResolve}
                  onCancelConfirm={() => setConfirmingId(null)}
                  index={i}
                />
              ))}
            </div>
          )}

          {resolvedAlerts.length > 0 && (
            <div className="p-4 space-y-3">
              <div className="ev-label mb-2" style={{ opacity: 0.6 }}>Resolved</div>
              {resolvedAlerts.map((alert, i) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  confirmingId={confirmingId}
                  onResolve={handleResolve}
                  onCancelConfirm={() => setConfirmingId(null)}
                  index={i}
                  resolved
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AlertItem({
  alert,
  confirmingId,
  onResolve,
  onCancelConfirm,
  index,
  resolved = false,
}: {
  alert: Alert;
  confirmingId: string | null;
  onResolve: (id: string) => void;
  onCancelConfirm: () => void;
  index: number;
  resolved?: boolean;
}) {
  const isConfirming = confirmingId === alert.id;

  const severityConfig = {
    critical: {
      icon: AlertCircle,
      color: '#e74c3c',
      bg: 'rgba(192, 57, 43, 0.08)',
      border: 'rgba(192, 57, 43, 0.25)',
      label: 'CRITICAL',
    },
    warning: {
      icon: AlertTriangle,
      color: '#d4a017',
      bg: 'rgba(212, 160, 23, 0.08)',
      border: 'rgba(212, 160, 23, 0.25)',
      label: 'WARNING',
    },
    info: {
      icon: Info,
      color: '#2e86c1',
      bg: 'rgba(46, 134, 193, 0.08)',
      border: 'rgba(46, 134, 193, 0.25)',
      label: 'INFO',
    },
  };

  const cfg = severityConfig[alert.severity];
  const Icon = cfg.icon;

  return (
    <div
      className="rounded p-3 animate-slide-in-right"
      style={{
        backgroundColor: resolved ? 'transparent' : cfg.bg,
        border: `1px solid ${resolved ? 'var(--ev-border-subtle)' : cfg.border}`,
        opacity: resolved ? 0.5 : 1,
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icon size={15} style={{ color: resolved ? 'var(--ev-text-muted)' : cfg.color, marginTop: 1, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-bold"
              style={{
                color: resolved ? 'var(--ev-text-muted)' : cfg.color,
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.05em',
              }}
            >
              {cfg.label}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {getSensorLabel(alert.sensor)}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ev-text-secondary)' }}>
            {alert.message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs" style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
              <span style={{ color: 'var(--ev-text-secondary)' }}>{alert.slaveName}</span>
              {' · '}
              {formatRelativeTime(alert.timestamp)}
            </div>
            {!resolved && (
              <div className="flex items-center gap-2">
                {isConfirming ? (
                  <>
                    <button
                      onClick={() => onResolve(alert.id)}
                      className="text-xs px-2 py-0.5 rounded font-medium transition-all duration-150"
                      style={{
                        backgroundColor: 'var(--ev-green-dim)',
                        color: 'var(--ev-green-primary)',
                        border: '1px solid var(--ev-green-muted)',
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={onCancelConfirm}
                      className="text-xs px-2 py-0.5 rounded transition-all duration-150"
                      style={{ color: 'var(--ev-text-muted)' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onResolve(alert.id)}
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
                )}
              </div>
            )}
            {resolved && (
              <span className="text-xs" style={{ color: 'var(--ev-green-primary)', fontFamily: 'IBM Plex Mono, monospace' }}>
                ✓ Resolved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
