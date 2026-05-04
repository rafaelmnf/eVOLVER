/*
 * eVOLVER DashboardLayout — "Bioluminescence" Design
 * Wraps all authenticated pages with Sidebar + main content area
 * Dot-grid background texture on main content
 */

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import AlertsDrawer from './AlertsDrawer';
import { Bell } from 'lucide-react';
import { mockAlerts } from '@/lib/mockData';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  headerRight,
}: DashboardLayoutProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const unresolvedAlerts = mockAlerts.filter(a => !a.resolved).length;

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: 'var(--ev-bg-primary)' }}
    >
      <Sidebar />

      {/* Main content */}
      <main
        className="flex-1 ml-[260px] min-h-screen ev-dot-grid"
        style={{ backgroundColor: 'var(--ev-bg-primary)' }}
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
          style={{
            backgroundColor: 'rgba(10, 15, 10, 0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--ev-border-subtle)',
          }}
        >
          <div>
            {title && (
              <h1
                className="text-xl font-bold leading-tight"
                style={{
                  fontFamily: 'Space Grotesk, monospace',
                  color: 'var(--ev-text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--ev-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {headerRight}

            {/* Alerts button */}
            <button
              onClick={() => setAlertsOpen(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded text-sm transition-all duration-200"
              style={{
                backgroundColor: unresolvedAlerts > 0 ? 'rgba(192, 57, 43, 0.1)' : 'var(--ev-bg-card)',
                border: `1px solid ${unresolvedAlerts > 0 ? 'rgba(192,57,43,0.3)' : 'var(--ev-border-subtle)'}`,
                color: unresolvedAlerts > 0 ? '#e74c3c' : 'var(--ev-text-secondary)',
              }}
            >
              <Bell size={15} />
              {unresolvedAlerts > 0 && (
                <span
                  className="font-mono font-bold text-xs"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {unresolvedAlerts} unresolved
                </span>
              )}
            </button>

            {/* System time */}
            <div
              className="text-xs font-mono px-3 py-2 rounded"
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                color: 'var(--ev-text-muted)',
                backgroundColor: 'var(--ev-bg-card)',
                border: '1px solid var(--ev-border-subtle)',
              }}
            >
              <LiveClock />
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="px-8 py-6">
          {children}
        </div>
      </main>

      {/* Alerts Drawer */}
      <AlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB'));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}
