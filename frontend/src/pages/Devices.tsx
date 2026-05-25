/*
 * eVOLVER Devices Page — "Bioluminescence" Design
 * Visual topology: Master → Slaves → Sensors
 * Real-time status per node, inline configuration form per device
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { mockMaster, mockSlaves, RaspberrySlave, formatRelativeTime, getSensorLabel } from '@/lib/mockData';
import {
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Server,
  Thermometer,
  Droplets,
  Eye,
  Wind,
} from 'lucide-react';

const sensorIcons = {
  temperature: Thermometer,
  ph: Droplets,
  od: Eye,
  agitation: Wind,
};

interface DeviceConfig {
  sampleInterval: number;
  tempMin: number;
  tempMax: number;
  phMin: number;
  phMax: number;
  odMin: number;
  odMax: number;
  agitationMin: number;
  agitationMax: number;
  agitationSetpoint: number;
  tempSetpoint: number;
}

const defaultConfig: DeviceConfig = {
  sampleInterval: 30,
  tempMin: 35.0,
  tempMax: 39.0,
  phMin: 6.8,
  phMax: 7.6,
  odMin: 0.0,
  odMax: 3.0,
  agitationMin: 100,
  agitationMax: 300,
  agitationSetpoint: 220,
  tempSetpoint: 37.0,
};

export default function Devices() {
  const [expandedSlave, setExpandedSlave] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, DeviceConfig>>(
    Object.fromEntries(mockSlaves.map(s => [s.id, { ...defaultConfig }]))
  );
  const [savedConfigs, setSavedConfigs] = useState<Set<string>>(new Set());
  const [dirtyConfigs, setDirtyConfigs] = useState<Set<string>>(new Set());

  function handleConfigChange(slaveId: string, field: keyof DeviceConfig, value: number) {
    setConfigs(prev => ({ ...prev, [slaveId]: { ...prev[slaveId], [field]: value } }));
    setDirtyConfigs(prev => { const next = new Set(prev); next.add(slaveId); return next; });
    setSavedConfigs(prev => { const next = new Set(prev); next.delete(slaveId); return next; });
  }

  function handleSave(slaveId: string) {
    setSavedConfigs(prev => { const next = new Set(prev); next.add(slaveId); return next; });
    setDirtyConfigs(prev => { const next = new Set(prev); next.delete(slaveId); return next; });
  }

  function handleReset(slaveId: string) {
    setConfigs(prev => ({ ...prev, [slaveId]: { ...defaultConfig } }));
    setDirtyConfigs(prev => { const next = new Set(prev); next.delete(slaveId); return next; });
    setSavedConfigs(prev => { const next = new Set(prev); next.delete(slaveId); return next; });
  }

  return (
    <DashboardLayout
      title="Devices"
      subtitle="Network topology and device configuration"
    >
      {/* Topology diagram */}
      <section className="mb-8">
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
        >
          Network Topology
        </h2>

        <div
          className="ev-card p-6 overflow-x-auto"
          style={{
            backgroundImage: `url("https://d2xsxph8kpxj0f.cloudfront.net/310519663627503585/AZ5VV6WHuX2Vmf83b4b6Ym/evolver-topology-bg-k5PERzQTRiUjrCpQcVcwQy.webp")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div style={{ backgroundColor: 'rgba(10,15,10,0.85)', borderRadius: '4px', padding: '24px' }}>
            {/* Master node */}
            <div className="flex flex-col items-center mb-8">
              <MasterNode />
            </div>

            {/* Connection lines + Slave nodes */}
            <div className="relative">
              {/* Horizontal line */}
              <div
                className="absolute left-0 right-0"
                style={{
                  top: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, var(--ev-green-muted), transparent)',
                  marginLeft: '8%',
                  marginRight: '8%',
                }}
              />

              <div className="grid grid-cols-6 gap-3 pt-6">
                {mockSlaves.map((slave, i) => (
                  <div key={slave.id} className="flex flex-col items-center gap-2">
                    {/* Vertical connector */}
                    <div
                      style={{
                        width: '1px',
                        height: '24px',
                        backgroundColor: slave.status === 'offline' ? '#2a1a1a' : 'var(--ev-green-muted)',
                        marginBottom: '-8px',
                      }}
                    />
                    <TopologySlaveNode
                      slave={slave}
                      index={i}
                      expanded={expandedSlave === slave.id}
                      onToggle={() => setExpandedSlave(expandedSlave === slave.id ? null : slave.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Device list with configuration */}
      <section>
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
        >
          Device Configuration
        </h2>

        <div className="space-y-3">
          {mockSlaves.map((slave, i) => (
            <SlaveConfigPanel
              key={slave.id}
              slave={slave}
              index={i}
              config={configs[slave.id]}
              expanded={expandedSlave === slave.id}
              onToggle={() => setExpandedSlave(expandedSlave === slave.id ? null : slave.id)}
              onChange={(field, value) => handleConfigChange(slave.id, field, value)}
              onSave={() => handleSave(slave.id)}
              onReset={() => handleReset(slave.id)}
              isDirty={dirtyConfigs.has(slave.id)}
              isSaved={savedConfigs.has(slave.id)}
            />
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}

function MasterNode() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="px-6 py-4 rounded flex items-center gap-4"
        style={{
          backgroundColor: 'var(--ev-bg-elevated)',
          border: '2px solid var(--ev-green-muted)',
          boxShadow: '0 0 24px var(--ev-green-glow)',
          minWidth: 240,
        }}
      >
        <div
          className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--ev-green-dim)', border: '1px solid var(--ev-green-muted)' }}
        >
          <Server size={20} style={{ color: 'var(--ev-green-primary)' }} />
        </div>
        <div>
          <div
            className="font-bold text-sm"
            style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}
          >
            {mockMaster.hostname}
          </div>
          <div className="text-xs" style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {mockMaster.ip} · MASTER
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ backgroundColor: 'var(--ev-green-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--ev-green-primary)' }}>
              Online · up {mockMaster.uptime}
            </span>
          </div>
        </div>
      </div>
      {/* Vertical connector down */}
      <div
        style={{
          width: '1px',
          height: '24px',
          backgroundColor: 'var(--ev-green-muted)',
        }}
      />
    </div>
  );
}

function TopologySlaveNode({
  slave,
  index,
  expanded,
  onToggle,
}: {
  slave: RaspberrySlave;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isActive = slave.status === 'active';
  const isOffline = slave.status === 'offline';
  const isWarning = slave.status === 'warning';

  return (
    <button
      onClick={onToggle}
      className={`flex flex-col items-center gap-1.5 p-3 rounded w-full transition-all duration-200 animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
      style={{
        backgroundColor: expanded ? 'var(--ev-green-dim)' : 'var(--ev-bg-elevated)',
        border: `1px solid ${expanded ? 'var(--ev-green-muted)' : isOffline ? '#2a1a1a' : isWarning ? 'rgba(212,160,23,0.3)' : 'var(--ev-border-subtle)'}`,
        boxShadow: isActive && !isOffline ? '0 0 12px var(--ev-green-glow)' : 'none',
        opacity: isOffline ? 0.5 : 1,
      }}
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center"
        style={{
          backgroundColor: isOffline ? '#1a0a0a' : isWarning ? 'rgba(61,42,0,0.5)' : 'var(--ev-green-dim)',
          border: `1px solid ${isOffline ? '#2a1a1a' : isWarning ? '#6b4f00' : 'var(--ev-green-muted)'}`,
        }}
      >
        {isOffline
          ? <WifiOff size={14} style={{ color: '#4a6a4a' }} />
          : <Wifi size={14} style={{ color: isWarning ? '#d4a017' : 'var(--ev-green-primary)' }} />
        }
      </div>
      <div
        className="text-xs font-semibold text-center"
        style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)', fontSize: '0.65rem' }}
      >
        {slave.hostname}
      </div>
      <div
        className="text-xs"
        style={{ color: isOffline ? '#4a6a4a' : isWarning ? '#d4a017' : 'var(--ev-green-primary)', fontSize: '0.6rem' }}
      >
        {slave.status}
      </div>
      {slave.alertCount > 0 && (
        <AlertTriangle size={10} style={{ color: '#d4a017' }} />
      )}

      {/* Sensor dots */}
      <div className="flex gap-1 mt-1">
        {(['temperature', 'ph', 'od', 'agitation'] as const).map(s => {
          const q = slave.sensors[s].quality;
          const color = q === 'excellent' || q === 'good'
            ? 'var(--ev-green-primary)'
            : q === 'poor' ? '#d4a017' : '#4a6a4a';
          return (
            <div
              key={s}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
              title={getSensorLabel(s)}
            />
          );
        })}
      </div>
    </button>
  );
}

function SlaveConfigPanel({
  slave,
  index,
  config,
  expanded,
  onToggle,
  onChange,
  onSave,
  onReset,
  isDirty,
  isSaved,
}: {
  slave: RaspberrySlave;
  index: number;
  config: DeviceConfig;
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: keyof DeviceConfig, value: number) => void;
  onSave: () => void;
  onReset: () => void;
  isDirty: boolean;
  isSaved: boolean;
}) {
  const isOffline = slave.status === 'offline';
  const isWarning = slave.status === 'warning';

  return (
    <div
      className={`ev-card overflow-hidden animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors duration-200"
        style={{
          backgroundColor: expanded ? 'rgba(29,185,84,0.04)' : 'transparent',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isOffline ? '#1a0a0a' : isWarning ? 'rgba(61,42,0,0.5)' : 'var(--ev-green-dim)',
              border: `1px solid ${isOffline ? '#2a1a1a' : isWarning ? '#6b4f00' : 'var(--ev-green-muted)'}`,
            }}
          >
            <Cpu size={14} style={{ color: isOffline ? '#4a6a4a' : isWarning ? '#d4a017' : 'var(--ev-green-primary)' }} />
          </div>
          <div className="text-left">
            <div
              className="font-semibold text-sm"
              style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--ev-text-primary)' }}
            >
              {slave.hostname}
            </div>
            <div
              className="text-xs"
              style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
            >
              {slave.ip} · Last seen {formatRelativeTime(slave.lastSeen)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="ev-badge-warning" style={{ fontSize: '0.65rem' }}>Unsaved changes</span>
          )}
          {isSaved && (
            <span className="ev-badge-active" style={{ fontSize: '0.65rem' }}>✓ Saved</span>
          )}
          <span
            className={
              slave.status === 'active'
                ? 'ev-badge-active'
                : slave.status === 'warning'
                ? 'ev-badge-warning'
                : 'ev-badge-offline'
            }
          >
            {slave.status}
          </span>

          {/* Current sensor values */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            {(['temperature', 'ph', 'od', 'agitation'] as const).map(s => {
              const Icon = sensorIcons[s];
              return (
                <div key={s} className="flex items-center gap-1" style={{ color: 'var(--ev-text-muted)' }}>
                  <Icon size={11} />
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: isOffline ? 'var(--ev-text-muted)' : 'var(--ev-text-secondary)' }}>
                    {isOffline ? '—' : `${slave.sensors[s].value} ${slave.sensors[s].unit}`}
                  </span>
                </div>
              );
            })}
          </div>

          {expanded ? <ChevronUp size={16} style={{ color: 'var(--ev-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--ev-text-muted)' }} />}
        </div>
      </button>

      {/* Config form */}
      {expanded && (
        <div
          className="px-5 pb-5"
          style={{ borderTop: '1px solid var(--ev-border-subtle)' }}
        >
          <div className="grid grid-cols-3 gap-6 pt-4">
            {/* General */}
            <div>
              <div className="ev-label mb-3">General</div>
              <ConfigField
                label="Sample Interval (s)"
                value={config.sampleInterval}
                min={5}
                max={300}
                step={5}
                onChange={v => onChange('sampleInterval', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="Temp Setpoint (°C)"
                value={config.tempSetpoint}
                min={20}
                max={45}
                step={0.5}
                onChange={v => onChange('tempSetpoint', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="Agitation Setpoint (RPM)"
                value={config.agitationSetpoint}
                min={0}
                max={500}
                step={10}
                onChange={v => onChange('agitationSetpoint', v)}
                disabled={isOffline}
              />
            </div>

            {/* Alert thresholds */}
            <div>
              <div className="ev-label mb-3">Alert Thresholds — Temperature & pH</div>
              <ConfigField
                label="Temp Min (°C)"
                value={config.tempMin}
                min={20}
                max={45}
                step={0.5}
                onChange={v => onChange('tempMin', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="Temp Max (°C)"
                value={config.tempMax}
                min={20}
                max={45}
                step={0.5}
                onChange={v => onChange('tempMax', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="pH Min"
                value={config.phMin}
                min={4}
                max={10}
                step={0.1}
                onChange={v => onChange('phMin', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="pH Max"
                value={config.phMax}
                min={4}
                max={10}
                step={0.1}
                onChange={v => onChange('phMax', v)}
                disabled={isOffline}
              />
            </div>

            {/* OD & Agitation thresholds */}
            <div>
              <div className="ev-label mb-3">Alert Thresholds — OD & Agitation</div>
              <ConfigField
                label="OD Min"
                value={config.odMin}
                min={0}
                max={5}
                step={0.01}
                onChange={v => onChange('odMin', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="OD Max"
                value={config.odMax}
                min={0}
                max={5}
                step={0.01}
                onChange={v => onChange('odMax', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="Agitation Min (RPM)"
                value={config.agitationMin}
                min={0}
                max={500}
                step={10}
                onChange={v => onChange('agitationMin', v)}
                disabled={isOffline}
              />
              <ConfigField
                label="Agitation Max (RPM)"
                value={config.agitationMax}
                min={0}
                max={500}
                step={10}
                onChange={v => onChange('agitationMax', v)}
                disabled={isOffline}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--ev-border-subtle)' }}>
            <button
              onClick={onSave}
              disabled={isOffline || !isDirty}
              className="ev-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} />
              Save Configuration
            </button>
            <button
              onClick={onReset}
              className="ev-btn-secondary flex items-center gap-2"
            >
              <RotateCcw size={13} />
              Reset to Defaults
            </button>
            {isOffline && (
              <span className="text-xs" style={{ color: '#c0392b', fontFamily: 'IBM Plex Mono, monospace' }}>
                Device offline — configuration changes will apply when reconnected.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="ev-input w-full disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontSize: '0.8rem', fontFamily: 'IBM Plex Mono, monospace' }}
      />
    </div>
  );
}
