/*
 * eVOLVER SlaveCard — "Bioluminescence" Design
 * Card for each Raspberry Slave showing hostname, status, 4 sensor readings
 * Active slaves have green glow; offline are dimmed
 */

import { Link } from 'wouter';
import { Wifi, WifiOff, AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { RaspberrySlave, formatRelativeTime } from '@/lib/mockData';
import SensorCard from './SensorCard';

interface SlaveCardProps {
  slave: RaspberrySlave;
  index: number;
}

export default function SlaveCard({ slave, index }: SlaveCardProps) {
  const isActive = slave.status === 'active';
  const isOffline = slave.status === 'offline';
  const isWarning = slave.status === 'warning';

  const statusConfig = {
    active: { badge: 'ev-badge-active', dot: 'var(--ev-green-primary)', label: 'Active', pulse: true },
    warning: { badge: 'ev-badge-warning', dot: '#d4a017', label: 'Warning', pulse: false },
    offline: { badge: 'ev-badge-offline', dot: '#4a6a4a', label: 'Offline', pulse: false },
  };

  const cfg = statusConfig[slave.status];

  return (
    <div
      className={`ev-card animate-fade-in-up stagger-${Math.min(index + 1, 6)} flex flex-col`}
      style={{
        opacity: isOffline ? 0.6 : 1,
        boxShadow: isActive ? '0 0 0 0 transparent' : undefined,
      }}
    >
      {/* Card header */}
      <div
        className="flex items-start justify-between p-4 pb-3"
        style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isActive ? 'var(--ev-green-dim)' : isWarning ? 'rgba(61,42,0,0.5)' : '#1a0a0a',
              border: `1px solid ${isActive ? 'var(--ev-green-muted)' : isWarning ? '#6b4f00' : '#2a1a1a'}`,
            }}
          >
            {isOffline
              ? <WifiOff size={14} style={{ color: '#4a6a4a' }} />
              : <Wifi size={14} style={{ color: isWarning ? '#d4a017' : 'var(--ev-green-primary)' }} />
            }
          </div>
          <div>
            <div
              className="font-semibold text-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}
            >
              {slave.hostname}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {slave.ip}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className={`${cfg.badge} flex items-center gap-1.5`}>
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.pulse ? 'animate-pulse-dot' : ''}`}
              style={{ backgroundColor: cfg.dot }}
            />
            {cfg.label}
          </span>
          {slave.alertCount > 0 && (
            <span className="ev-badge-danger flex items-center gap-1">
              <AlertTriangle size={9} />
              {slave.alertCount} alert{slave.alertCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Sensors grid */}
      <div className="p-3 grid grid-cols-2 gap-2 flex-1">
        <SensorCard type="temperature" reading={slave.sensors.temperature} compact />
        <SensorCard type="ph" reading={slave.sensors.ph} compact />
        <SensorCard type="od" reading={slave.sensors.od} compact />
        <SensorCard type="agitation" reading={slave.sensors.agitation} compact />
      </div>

      {/* Card footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderTop: '1px solid var(--ev-border-subtle)' }}
      >
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ev-text-muted)' }}>
          <Clock size={11} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {formatRelativeTime(slave.lastSeen)}
          </span>
          {slave.experimentId && (
            <>
              <span style={{ color: 'var(--ev-border-default)' }}>·</span>
              <span style={{ color: 'var(--ev-text-secondary)' }}>{slave.experimentId}</span>
            </>
          )}
        </div>
        <Link href={`/dispositivos`}>
          <button
            className="flex items-center gap-1 text-xs transition-colors duration-200"
            style={{ color: 'var(--ev-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ev-green-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ev-text-muted)')}
          >
            Details
            <ChevronRight size={11} />
          </button>
        </Link>
      </div>
    </div>
  );
}
