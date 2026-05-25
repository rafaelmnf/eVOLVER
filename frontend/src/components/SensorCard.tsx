/*
 * eVOLVER SensorCard — "Bioluminescence" Design
 * Displays current sensor value, trend, sparkline, and quality badge
 * IBM Plex Mono for values, green glow on active sensors
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SensorReading, SensorType, getSensorLabel, getQualityLabel } from '@/lib/mockData';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';

interface SensorCardProps {
  type: SensorType;
  reading: SensorReading;
  compact?: boolean;
}

export default function SensorCard({ type, reading, compact = false }: SensorCardProps) {
  const isError = reading.quality === 'error';
  const isWarning = reading.quality === 'poor';

  const sparkData = reading.history.map((v, i) => ({ i, v }));

  const trendIcon = reading.trend === 'up'
    ? <TrendingUp size={12} />
    : reading.trend === 'down'
    ? <TrendingDown size={12} />
    : <Minus size={12} />;

  const trendColor = reading.trend === 'up'
    ? 'var(--ev-green-primary)'
    : reading.trend === 'down'
    ? '#c0392b'
    : 'var(--ev-text-muted)';

  const qualityBadgeClass = reading.quality === 'excellent' || reading.quality === 'good'
    ? 'ev-badge-active'
    : reading.quality === 'poor'
    ? 'ev-badge-warning'
    : 'ev-badge-offline';

  return (
    <div
      className="ev-card p-3 flex flex-col gap-2"
      style={{
        backgroundColor: 'var(--ev-bg-card)',
        opacity: isError ? 0.5 : 1,
      }}
    >
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="ev-label">{getSensorLabel(type)}</span>
        <span className={qualityBadgeClass} style={{ fontSize: '0.65rem' }}>
          {getQualityLabel(reading.quality)}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span
          className="leading-none"
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: compact ? '1.75rem' : '2.25rem',
            fontWeight: 500,
            color: isError ? 'var(--ev-text-muted)' : isWarning ? '#d4a017' : 'var(--ev-green-primary)',
            textShadow: isError ? 'none' : isWarning ? '0 0 12px rgba(212,160,23,0.3)' : '0 0 12px rgba(29,185,84,0.3)',
          }}
        >
          {isError ? '—' : reading.value}
        </span>
        <span
          className="mb-1 text-sm"
          style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}
        >
          {reading.unit}
        </span>
      </div>

      {/* Trend */}
      {!isError && (
        <div className="flex items-center gap-1 text-xs" style={{ color: trendColor, fontFamily: 'IBM Plex Mono, monospace' }}>
          {trendIcon}
          <span>
            {reading.trendDelta > 0 ? '+' : ''}{reading.trendDelta} {reading.unit}
          </span>
        </div>
      )}

      {/* Sparkline */}
      {!isError && (
        <div style={{ height: 36, marginTop: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isWarning ? '#d4a017' : '#1db954'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={isWarning ? '#d4a017' : '#1db954'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={isWarning ? '#d4a017' : '#1db954'}
                strokeWidth={1.5}
                fill={`url(#grad-${type})`}
                dot={false}
                isAnimationActive={true}
                animationDuration={800}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    return (
                      <div
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: 'var(--ev-bg-elevated)',
                          border: '1px solid var(--ev-border-default)',
                          color: 'var(--ev-green-primary)',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}
                      >
                        {payload[0].value} {reading.unit}
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {isError && (
        <div
          className="h-9 flex items-center justify-center text-xs rounded"
          style={{
            backgroundColor: 'rgba(42, 26, 26, 0.5)',
            color: 'var(--ev-text-muted)',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          NO SIGNAL
        </div>
      )}
    </div>
  );
}
