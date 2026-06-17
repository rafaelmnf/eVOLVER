/*
 * eVOLVER Sidebar — "Bioluminescence" Design
 * Fixed left sidebar, 260px, dark substrate background
 * Navigation + system status + active experiment indicator
 */

import { Link, useLocation } from 'wouter';
import {
  Activity,
  FlaskConical,
  Cpu,
  Bell,
  Settings,
  ChevronRight,
  Wifi,
  WifiOff,
  LogOut,
} from 'lucide-react';
import { useLiveData } from '@/contexts/LiveDataContext';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/experimentos', label: 'Experiments', icon: FlaskConical },
];

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { slaves, master, isConnected } = useLiveData();
  const isMasterOnline = isConnected && master.status === 'active';

  const activeSlaves = slaves.filter(s => s.status === 'active').length;
  const offlineSlaves = slaves.filter(s => s.status === 'offline').length;

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] flex flex-col z-40"
      style={{
        backgroundColor: 'var(--ev-bg-secondary)',
        borderRight: '1px solid var(--ev-border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}
      >
        <div
          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--ev-green-dim)', border: '1px solid var(--ev-green-muted)' }}
        >
          <FlaskConical size={16} style={{ color: 'var(--ev-green-primary)' }} />
        </div>
        <div>
          <div
            className="font-bold text-base leading-tight"
            style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}
          >
            eVOLVER
          </div>
          <div className="ev-label" style={{ fontSize: '0.65rem' }}>
            Bioreactor Monitor
          </div>
        </div>
      </div>

      {/* Master Status */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}>
        <div className="ev-card p-3 rounded" style={{ backgroundColor: 'var(--ev-bg-card)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="ev-label">Master Node</span>
            <span className="ev-badge-active flex items-center gap-1" style={{ borderColor: isMasterOnline ? 'var(--ev-green-muted)' : 'var(--ev-border-default)', backgroundColor: isMasterOnline ? 'var(--ev-green-dim)' : 'var(--ev-bg-elevated)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full inline-block animate-pulse-dot"
                style={{ backgroundColor: isMasterOnline ? 'var(--ev-green-primary)' : '#d4a017' }}
              />
              {isMasterOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div
            className="text-xs font-mono"
            style={{ color: 'var(--ev-text-secondary)', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            {master.hostname}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--ev-text-muted)' }}>
            {master.ip} · up {master.uptime}
          </div>
        </div>
      </div>

      {/* Researcher Profile card (more highlighted below Master) */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ev-border-subtle)' }}>
        <div className="ev-card-elevated p-3 rounded flex flex-col gap-3" style={{ boxShadow: '0 0 10px rgba(29, 185, 84, 0.05)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                backgroundColor: 'var(--ev-green-dim)',
                border: '1px solid var(--ev-green-primary)',
                color: 'var(--ev-green-primary)',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'PE'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="ev-label" style={{ fontSize: '0.6rem' }}>Pesquisador</span>
              <span className="text-sm font-bold truncate text-[var(--ev-text-primary)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {user?.name || 'Pesquisador'}
              </span>
              <span className="text-xs truncate text-[var(--ev-text-secondary)] font-mono">
                {user?.email || 'user@evolver'}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--ev-border-subtle)] flex justify-end">
            <button
              onClick={handleLogout}
              className="text-xs flex items-center gap-1.5 text-[var(--ev-danger)] hover:underline cursor-pointer font-semibold transition-colors"
            >
              <LogOut size={12} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="ev-label px-3 mb-3 font-semibold uppercase tracking-wider">Navegação</div>
        <ul className="space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location === path || (path === '/experimentos' && location.startsWith('/experimento'));
            return (
              <li key={path}>
                <Link href={path}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: isActive ? 'var(--ev-green-dim)' : 'transparent',
                      color: isActive ? 'var(--ev-green-primary)' : 'var(--ev-text-secondary)',
                      border: isActive ? '1px solid var(--ev-green-muted)' : '1px solid transparent',
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(29,185,84,0.05)';
                        (e.currentTarget as HTMLDivElement).style.color = 'var(--ev-text-primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                        (e.currentTarget as HTMLDivElement).style.color = 'var(--ev-text-secondary)';
                      }
                    }}
                  >
                    <Icon size={16} />
                    <span className="flex-1">{label === 'Experiments' ? 'Experimentos' : label}</span>
                    {isActive && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Slave Summary */}
        <div className="mt-6">
          <div className="ev-label px-3 mb-3">Slaves do Sistema</div>
          <div className="px-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2" style={{ color: 'var(--ev-text-secondary)' }}>
                <Wifi size={12} style={{ color: 'var(--ev-green-primary)' }} />
                Ativas
              </div>
              <span
                className="font-mono font-bold"
                style={{ color: 'var(--ev-green-primary)', fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {activeSlaves}/{slaves.length}
              </span>
            </div>
            {offlineSlaves > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2" style={{ color: 'var(--ev-text-muted)' }}>
                  <WifiOff size={12} style={{ color: '#c0392b' }} />
                  Offline
                </div>
                <span
                  className="font-mono font-bold"
                  style={{ color: '#c0392b', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {offlineSlaves}
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3 mt-auto"
        style={{
          borderTop: '1px solid var(--ev-border-subtle)',
          backgroundColor: 'rgba(255,255,255,0.01)',
        }}
      >
        <div className="text-[0.65rem] flex justify-between" style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
          <span>eVOLVER v1.0.0</span>
          <span>© 2026 Lab Systems</span>
        </div>
      </div>
    </aside>
  );
}
