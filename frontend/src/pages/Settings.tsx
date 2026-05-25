/*
 * eVOLVER Settings Page — "Bioluminescence" Design
 * System configuration, user management placeholder
 */

import DashboardLayout from '@/components/DashboardLayout';
import { useLiveData } from '@/contexts/LiveDataContext';
import { Server, Bell, Shield, Database } from 'lucide-react';

export default function Settings() {
  const { master } = useLiveData();
  return (
    <DashboardLayout
      title="Settings"
      subtitle="System configuration and preferences"
    >
      <div className="max-w-2xl space-y-6">
        {/* System */}
        <div className="ev-card overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
          >
            <Server size={15} style={{ color: 'var(--ev-green-primary)' }} />
            <h3
              className="font-semibold text-sm"
              style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
            >
              System
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="ev-label block mb-1">Master Node Hostname</label>
              <input
                className="ev-input w-full"
                defaultValue={master.hostname}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
            <div>
              <label className="ev-label block mb-1">Master Node IP</label>
              <input
                className="ev-input w-full"
                defaultValue={master.ip}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
            <div>
              <label className="ev-label block mb-1">Data Polling Interval (s)</label>
              <input
                className="ev-input w-full"
                type="number"
                defaultValue={30}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
            <button className="ev-btn-primary">Save System Settings</button>
          </div>
        </div>

        {/* Notifications */}
        <div className="ev-card overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
          >
            <Bell size={15} style={{ color: 'var(--ev-green-primary)' }} />
            <h3
              className="font-semibold text-sm"
              style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
            >
              Notifications
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Critical alerts', desc: 'Device offline, sensor failure', enabled: true },
              { label: 'Warning alerts', desc: 'Threshold violations', enabled: true },
              { label: 'Info alerts', desc: 'OD induction points, milestones', enabled: false },
              { label: 'Email digest', desc: 'Daily summary of experiment status', enabled: false },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}>
                <div>
                  <div className="text-sm" style={{ color: 'var(--ev-text-primary)' }}>{item.label}</div>
                  <div className="text-xs" style={{ color: 'var(--ev-text-muted)' }}>{item.desc}</div>
                </div>
                <div
                  className="w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200"
                  style={{ backgroundColor: item.enabled ? 'var(--ev-green-primary)' : 'var(--ev-bg-elevated)', border: '1px solid var(--ev-border-default)' }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all duration-200"
                    style={{
                      backgroundColor: 'white',
                      left: item.enabled ? 'calc(100% - 18px)' : '2px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="ev-card overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
          >
            <Shield size={15} style={{ color: 'var(--ev-green-primary)' }} />
            <h3
              className="font-semibold text-sm"
              style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
            >
              Security
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="ev-label block mb-1">API Key</label>
              <div className="flex gap-2">
                <input
                  className="ev-input flex-1"
                  type="password"
                  defaultValue="evolver_sk_prod_xxxxxxxxxxxxxxxxxxx"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                />
                <button className="ev-btn-secondary">Regenerate</button>
              </div>
            </div>
            <div>
              <label className="ev-label block mb-1">Session Timeout (min)</label>
              <input
                className="ev-input w-full"
                type="number"
                defaultValue={60}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="ev-card overflow-hidden">
          <div
            className="flex items-center gap-2 px-5 py-4"
            style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
          >
            <Database size={15} style={{ color: 'var(--ev-green-primary)' }} />
            <h3
              className="font-semibold text-sm"
              style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
            >
              Data Retention
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="ev-label block mb-1">Raw Readings Retention (days)</label>
              <input
                className="ev-input w-full"
                type="number"
                defaultValue={90}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
            <div>
              <label className="ev-label block mb-1">Aggregated Data Retention (days)</label>
              <input
                className="ev-input w-full"
                type="number"
                defaultValue={365}
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>
            <button className="ev-btn-primary">Save Data Settings</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
