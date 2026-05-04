/*
 * eVOLVER Experiment Page — "Bioluminescence" Design
 * Time series charts per sensor, alerts table, researcher list
 * Recharts with green-on-dark styling
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import {
  mockExperiments,
  mockAlerts,
  mockSlaves,
  mockTimeSeries,
  Alert,
  formatRelativeTime,
  getSensorLabel,
} from '@/lib/mockData';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  FlaskConical,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type SensorTab = 'temperature' | 'ph' | 'od' | 'agitation';

const sensorConfig: Record<SensorTab, { label: string; unit: string; color: string; refMin?: number; refMax?: number }> = {
  temperature: { label: 'Temperature', unit: '°C', color: '#1db954', refMin: 36, refMax: 38.5 },
  ph: { label: 'pH', unit: 'pH', color: '#22d45f', refMin: 6.9, refMax: 7.5 },
  od: { label: 'OD600', unit: 'OD', color: '#1db954', refMin: 0, refMax: 2.0 },
  agitation: { label: 'Agitation', unit: 'RPM', color: '#22d45f', refMin: 150, refMax: 250 },
};

export default function Experiment() {
  const params = useParams<{ id: string }>();
  const expId = params.id ?? 'exp-001';
  const experiment = mockExperiments.find(e => e.id === expId) ?? mockExperiments[0];
  const expAlerts = mockAlerts.filter(a => a.experimentId === expId);
  const expSlaves = mockSlaves.filter(s => experiment.slaveIds.includes(s.id));

  const [activeTab, setActiveTab] = useState<SensorTab>('temperature');
  const [activeSlave, setActiveSlave] = useState(expSlaves[0]?.id ?? 'slave-001');
  const [resolvedAlerts, setResolvedAlerts] = useState<Set<string>>(
    new Set(mockAlerts.filter(a => a.resolved).map(a => a.id))
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const timeSeriesData = mockTimeSeries[activeSlave]?.[activeTab] ?? mockTimeSeries['slave-001'][activeTab];
  const cfg = sensorConfig[activeTab];

  // Format chart data
  const chartData = timeSeriesData.map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    value: p.value,
  }));

  const statusConfig = {
    running: { badge: 'ev-badge-active', label: 'Running', dot: 'var(--ev-green-primary)', pulse: true },
    paused: { badge: 'ev-badge-warning', label: 'Paused', dot: '#d4a017', pulse: false },
    completed: { badge: 'ev-badge-offline', label: 'Completed', dot: '#4a6a4a', pulse: false },
    error: { badge: 'ev-badge-danger', label: 'Error', dot: '#e74c3c', pulse: false },
  };
  const stCfg = statusConfig[experiment.status];

  function handleResolve(alertId: string) {
    if (confirmingId === alertId) {
      setResolvedAlerts(prev => { const next = new Set(prev); next.add(alertId); return next; });
      setConfirmingId(null);
    } else {
      setConfirmingId(alertId);
    }
  }

  const activeAlerts = expAlerts.filter(a => !resolvedAlerts.has(a.id));
  const resolvedAlertsList = expAlerts.filter(a => resolvedAlerts.has(a.id));

  return (
    <DashboardLayout
      title={experiment.name}
      subtitle={`Experiment · ${experiment.id}`}
    >
      {/* Experiment header */}
      <div className="ev-card p-5 mb-6 animate-fade-in-up">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--ev-green-dim)', border: '1px solid var(--ev-green-muted)' }}
            >
              <FlaskConical size={18} style={{ color: 'var(--ev-green-primary)' }} />
            </div>
            <div>
              <h2
                className="text-lg font-bold mb-1"
                style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)', letterSpacing: '-0.01em' }}
              >
                {experiment.name}
              </h2>
              <p className="text-sm" style={{ color: 'var(--ev-text-secondary)', maxWidth: 600 }}>
                {experiment.description}
              </p>
            </div>
          </div>
          <span className={`${stCfg.badge} flex items-center gap-1.5 flex-shrink-0`}>
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${stCfg.pulse ? 'animate-pulse-dot' : ''}`}
              style={{ backgroundColor: stCfg.dot }}
            />
            {stCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-6 mt-5 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
          <MetaItem label="Started" value={new Date(experiment.startedAt).toLocaleString('en-GB')} />
          <MetaItem label="Duration" value={experiment.duration} />
          <MetaItem label="Slave Nodes" value={String(experiment.slaveIds.length)} />
          <MetaItem label="Researchers" value={String(experiment.researchers.length)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Charts */}
        <div className="col-span-2 space-y-5">
          {/* Slave selector */}
          <div className="flex items-center gap-2">
            <span className="ev-label mr-2">Slave:</span>
            {expSlaves.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSlave(s.id)}
                className="text-xs px-3 py-1.5 rounded transition-all duration-200"
                style={{
                  backgroundColor: activeSlave === s.id ? 'var(--ev-green-dim)' : 'var(--ev-bg-card)',
                  border: `1px solid ${activeSlave === s.id ? 'var(--ev-green-muted)' : 'var(--ev-border-subtle)'}`,
                  color: activeSlave === s.id ? 'var(--ev-green-primary)' : 'var(--ev-text-secondary)',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: activeSlave === s.id ? 600 : 400,
                }}
              >
                {s.hostname}
              </button>
            ))}
          </div>

          {/* Sensor tabs */}
          <div className="ev-card overflow-hidden">
            <div
              className="flex"
              style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
            >
              {(Object.keys(sensorConfig) as SensorTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-xs font-medium transition-all duration-200"
                  style={{
                    backgroundColor: activeTab === tab ? 'var(--ev-green-dim)' : 'transparent',
                    color: activeTab === tab ? 'var(--ev-green-primary)' : 'var(--ev-text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--ev-green-primary)' : '2px solid transparent',
                    fontFamily: 'DM Sans, sans-serif',
                    letterSpacing: '0.05em',
                  }}
                >
                  {sensorConfig[tab].label}
                </button>
              ))}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="ev-label">{cfg.label}</span>
                  <div
                    className="text-xs mt-1"
                    style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
                  >
                    Range: {cfg.refMin} – {cfg.refMax} {cfg.unit}
                  </div>
                </div>
                <div
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--ev-bg-elevated)',
                    border: '1px solid var(--ev-border-subtle)',
                    color: 'var(--ev-text-muted)',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  Last 24h · 15min intervals
                </div>
              </div>

              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={cfg.color} stopOpacity={0.6} />
                        <stop offset="50%" stopColor={cfg.color} stopOpacity={1} />
                        <stop offset="100%" stopColor={cfg.color} stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(29,185,84,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: 'var(--ev-text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--ev-border-subtle)' }}
                      interval={11}
                    />
                    <YAxis
                      tick={{ fill: 'var(--ev-text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    {cfg.refMin !== undefined && (
                      <ReferenceLine
                        y={cfg.refMin}
                        stroke="rgba(212,160,23,0.3)"
                        strokeDasharray="4 4"
                        label={{ value: 'min', fill: '#d4a017', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                      />
                    )}
                    {cfg.refMax !== undefined && (
                      <ReferenceLine
                        y={cfg.refMax}
                        stroke="rgba(212,160,23,0.3)"
                        strokeDasharray="4 4"
                        label={{ value: 'max', fill: '#d4a017', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--ev-bg-elevated)',
                        border: '1px solid var(--ev-border-default)',
                        borderRadius: '5px',
                        color: 'var(--ev-text-primary)',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '12px',
                      }}
                      labelStyle={{ color: 'var(--ev-text-muted)', marginBottom: '4px' }}
                      formatter={(value: number) => [`${value} ${cfg.unit}`, cfg.label]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: cfg.color, stroke: 'var(--ev-bg-primary)', strokeWidth: 2 }}
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Alerts table */}
          <div className="ev-card overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
            >
              <h3
                className="font-semibold text-sm"
                style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
              >
                Alerts
              </h3>
              <div className="flex items-center gap-2">
                {activeAlerts.length > 0 && (
                  <span className="ev-badge-warning">{activeAlerts.length} active</span>
                )}
                {resolvedAlertsList.length > 0 && (
                  <button
                    onClick={() => setShowResolved(!showResolved)}
                    className="flex items-center gap-1 text-xs transition-colors duration-200"
                    style={{ color: 'var(--ev-text-muted)' }}
                  >
                    {showResolved ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showResolved ? 'Hide' : 'Show'} resolved ({resolvedAlertsList.length})
                  </button>
                )}
              </div>
            </div>

            {expAlerts.length === 0 ? (
              <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--ev-text-muted)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--ev-green-primary)' }} />
                <span className="text-sm">No alerts for this experiment.</span>
              </div>
            ) : (
              <table className="ev-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Sensor</th>
                    <th>Message</th>
                    <th>Device</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAlerts.map(alert => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      resolved={false}
                      confirmingId={confirmingId}
                      onResolve={handleResolve}
                      onCancelConfirm={() => setConfirmingId(null)}
                    />
                  ))}
                  {showResolved && resolvedAlertsList.map(alert => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      resolved={true}
                      confirmingId={confirmingId}
                      onResolve={handleResolve}
                      onCancelConfirm={() => setConfirmingId(null)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Researchers + Slave status */}
        <div className="space-y-5">
          {/* Researchers */}
          <div className="ev-card overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
            >
              <Users size={14} style={{ color: 'var(--ev-green-primary)' }} />
              <h3
                className="font-semibold text-sm"
                style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
              >
                Researchers
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {experiment.researchers.map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-2 rounded transition-colors duration-200"
                  style={{ borderRadius: '5px' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(29,185,84,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--ev-green-dim)',
                      border: '1px solid var(--ev-green-muted)',
                      color: 'var(--ev-green-primary)',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                  >
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--ev-text-primary)' }}
                    >
                      {r.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--ev-text-muted)' }}>
                      {r.email}
                    </div>
                  </div>
                  <span
                    className={r.role === 'owner' ? 'ev-badge-active' : 'ev-badge-offline'}
                    style={{ fontSize: '0.65rem', flexShrink: 0 }}
                  >
                    {r.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Slave status */}
          <div className="ev-card overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
            >
              <Clock size={14} style={{ color: 'var(--ev-green-primary)' }} />
              <h3
                className="font-semibold text-sm"
                style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
              >
                Slave Status
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {expSlaves.map(slave => (
                <div
                  key={slave.id}
                  className="p-3 rounded"
                  style={{
                    backgroundColor: 'var(--ev-bg-elevated)',
                    border: '1px solid var(--ev-border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}
                    >
                      {slave.hostname}
                    </span>
                    <span
                      className={
                        slave.status === 'active'
                          ? 'ev-badge-active'
                          : slave.status === 'warning'
                          ? 'ev-badge-warning'
                          : 'ev-badge-offline'
                      }
                      style={{ fontSize: '0.65rem' }}
                    >
                      {slave.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {(['temperature', 'ph', 'od', 'agitation'] as const).map(s => (
                      <div key={s} className="flex items-center justify-between">
                        <span className="ev-label" style={{ fontSize: '0.6rem' }}>
                          {getSensorLabel(s)}
                        </span>
                        <span
                          className="text-xs"
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            color: slave.sensors[s].quality === 'poor' ? '#d4a017' : 'var(--ev-green-primary)',
                          }}
                        >
                          {slave.status === 'offline' ? '—' : `${slave.sensors[s].value} ${slave.sensors[s].unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="text-xs mt-2"
                    style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
                  >
                    Last seen {formatRelativeTime(slave.lastSeen)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="ev-label mb-1">{label}</div>
      <div
        className="text-sm font-medium"
        style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  resolved,
  confirmingId,
  onResolve,
  onCancelConfirm,
}: {
  alert: Alert;
  resolved: boolean;
  confirmingId: string | null;
  onResolve: (id: string) => void;
  onCancelConfirm: () => void;
}) {
  const isConfirming = confirmingId === alert.id;

  const severityConfig = {
    critical: { icon: AlertCircle, color: '#e74c3c', label: 'Critical' },
    warning: { icon: AlertTriangle, color: '#d4a017', label: 'Warning' },
    info: { icon: Info, color: '#2e86c1', label: 'Info' },
  };
  const cfg = severityConfig[alert.severity];
  const Icon = cfg.icon;

  return (
    <tr style={{ opacity: resolved ? 0.5 : 1 }}>
      <td>
        <div className="flex items-center gap-1.5">
          <Icon size={12} style={{ color: cfg.color }} />
          <span style={{ color: cfg.color, fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', fontWeight: 600 }}>
            {cfg.label}
          </span>
        </div>
      </td>
      <td>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-secondary)' }}>
          {getSensorLabel(alert.sensor)}
        </span>
      </td>
      <td>
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
          {formatRelativeTime(alert.timestamp)}
        </span>
      </td>
      <td>
        {!resolved ? (
          isConfirming ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onResolve(alert.id)}
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
                onClick={onCancelConfirm}
                className="text-xs"
                style={{ color: 'var(--ev-text-muted)' }}
              >
                Cancel
              </button>
            </div>
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
          )
        ) : (
          <span style={{ color: 'var(--ev-green-primary)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem' }}>
            ✓
          </span>
        )}
      </td>
    </tr>
  );
}
