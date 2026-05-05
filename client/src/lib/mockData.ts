// eVOLVER — Mock Data
// Simulates real-time sensor readings, devices, experiments, and alerts

export type SensorType = 'temperature' | 'ph' | 'od' | 'agitation';
export type DeviceStatus = 'active' | 'warning' | 'offline';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type ExperimentStatus = 'running' | 'paused' | 'completed' | 'error';

export interface SensorReading {
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  quality: 'excellent' | 'good' | 'poor' | 'error';
  history: number[];
}

export interface RaspberrySlave {
  id: string;
  hostname: string;
  ip: string;
  status: DeviceStatus;
  lastSeen: string;
  experimentId: string | null;
  sensors: {
    temperature: SensorReading;
    ph: SensorReading;
    od: SensorReading;
    agitation: SensorReading;
  };
  alertCount: number;
}

export interface RaspberryMaster {
  id: string;
  hostname: string;
  ip: string;
  status: DeviceStatus;
  slaves: string[];
  uptime: string;
  lastSync: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  startedAt: string;
  endedAt: string | null;
  duration: string;
  slaveIds: string[];
  researchers: Researcher[];
  alertCount: number;
}

export interface Researcher {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'collaborator';
  avatar: string;
}

export interface Alert {
  id: string;
  slaveId: string;
  slaveName: string;
  experimentId: string | null;
  sensor: SensorType;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

// Generate sparkline history
function generateHistory(base: number, variance: number, points = 20): number[] {
  return Array.from({ length: points }, (_, i) => {
    const noise = (Math.random() - 0.5) * variance;
    const trend = Math.sin(i / 4) * (variance * 0.3);
    return Math.round((base + noise + trend) * 100) / 100;
  });
}

// Generate time series
function generateTimeSeries(base: number, variance: number, hours = 24): TimeSeriesPoint[] {
  const now = new Date();
  return Array.from({ length: hours * 4 }, (_, i) => {
    const time = new Date(now.getTime() - (hours * 4 - i) * 15 * 60 * 1000);
    const noise = (Math.random() - 0.5) * variance;
    const trend = Math.sin(i / 16) * (variance * 0.5);
    const drift = i * (variance * 0.01);
    return {
      timestamp: time.toISOString(),
      value: Math.round((base + noise + trend + drift) * 100) / 100,
    };
  });
}

export const mockMaster: RaspberryMaster = {
  id: 'master-001',
  hostname: 'evolver-master',
  ip: '192.168.1.10',
  status: 'active',
  slaves: ['slave-001', 'slave-002', 'slave-003', 'slave-004', 'slave-005', 'slave-006', 'slave-007', 'slave-008', 'slave-009', 'slave-010'],
  uptime: '14d 06h 32m',
  lastSync: new Date(Date.now() - 3000).toISOString(),
};

export const mockSlaves: RaspberrySlave[] = [
  {
    id: 'slave-001',
    hostname: 'evolver-s01',
    ip: '192.168.1.21',
    status: 'active',
    lastSeen: new Date(Date.now() - 2000).toISOString(),
    experimentId: 'exp-001',
    alertCount: 0,
    sensors: {
      temperature: { value: 37.2, unit: '°C', trend: 'up', trendDelta: 0.2, quality: 'excellent', history: generateHistory(37, 0.8) },
      ph: { value: 7.1, unit: 'pH', trend: 'stable', trendDelta: 0.0, quality: 'excellent', history: generateHistory(7.0, 0.3) },
      od: { value: 0.842, unit: 'OD600', trend: 'up', trendDelta: 0.031, quality: 'good', history: generateHistory(0.8, 0.1) },
      agitation: { value: 220, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(220, 5) },
    },
  },
  {
    id: 'slave-002',
    hostname: 'evolver-s02',
    ip: '192.168.1.22',
    status: 'warning',
    lastSeen: new Date(Date.now() - 5000).toISOString(),
    experimentId: 'exp-001',
    alertCount: 2,
    sensors: {
      temperature: { value: 38.9, unit: '°C', trend: 'up', trendDelta: 1.4, quality: 'poor', history: generateHistory(38.5, 1.2) },
      ph: { value: 6.8, unit: 'pH', trend: 'down', trendDelta: -0.3, quality: 'good', history: generateHistory(7.0, 0.4) },
      od: { value: 1.204, unit: 'OD600', trend: 'up', trendDelta: 0.08, quality: 'good', history: generateHistory(1.1, 0.15) },
      agitation: { value: 215, unit: 'RPM', trend: 'stable', trendDelta: -2, quality: 'excellent', history: generateHistory(220, 8) },
    },
  },
  {
    id: 'slave-003',
    hostname: 'evolver-s03',
    ip: '192.168.1.23',
    status: 'active',
    lastSeen: new Date(Date.now() - 1500).toISOString(),
    experimentId: 'exp-002',
    alertCount: 0,
    sensors: {
      temperature: { value: 36.8, unit: '°C', trend: 'stable', trendDelta: 0.0, quality: 'excellent', history: generateHistory(37, 0.5) },
      ph: { value: 7.3, unit: 'pH', trend: 'up', trendDelta: 0.1, quality: 'excellent', history: generateHistory(7.2, 0.2) },
      od: { value: 0.612, unit: 'OD600', trend: 'up', trendDelta: 0.022, quality: 'excellent', history: generateHistory(0.6, 0.08) },
      agitation: { value: 180, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(180, 4) },
    },
  },
  {
    id: 'slave-004',
    hostname: 'evolver-s04',
    ip: '192.168.1.24',
    status: 'offline',
    lastSeen: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    experimentId: null,
    alertCount: 1,
    sensors: {
      temperature: { value: 0, unit: '°C', trend: 'stable', trendDelta: 0, quality: 'error', history: Array(20).fill(0) },
      ph: { value: 0, unit: 'pH', trend: 'stable', trendDelta: 0, quality: 'error', history: Array(20).fill(0) },
      od: { value: 0, unit: 'OD600', trend: 'stable', trendDelta: 0, quality: 'error', history: Array(20).fill(0) },
      agitation: { value: 0, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'error', history: Array(20).fill(0) },
    },
  },
  {
    id: 'slave-005',
    hostname: 'evolver-s05',
    ip: '192.168.1.25',
    status: 'active',
    lastSeen: new Date(Date.now() - 3000).toISOString(),
    experimentId: 'exp-002',
    alertCount: 0,
    sensors: {
      temperature: { value: 37.0, unit: '°C', trend: 'stable', trendDelta: 0.0, quality: 'excellent', history: generateHistory(37, 0.4) },
      ph: { value: 7.0, unit: 'pH', trend: 'stable', trendDelta: 0.0, quality: 'excellent', history: generateHistory(7.0, 0.15) },
      od: { value: 0.445, unit: 'OD600', trend: 'up', trendDelta: 0.015, quality: 'excellent', history: generateHistory(0.43, 0.06) },
      agitation: { value: 200, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(200, 3) },
    },
  },
  {
    id: 'slave-006',
    hostname: 'evolver-s06',
    ip: '192.168.1.26',
    status: 'active',
    lastSeen: new Date(Date.now() - 2500).toISOString(),
    experimentId: 'exp-001',
    alertCount: 0,
    sensors: {
      temperature: { value: 37.4, unit: '°C', trend: 'down', trendDelta: -0.1, quality: 'excellent', history: generateHistory(37.3, 0.6) },
      ph: { value: 7.2, unit: 'pH', trend: 'stable', trendDelta: 0.0, quality: 'excellent', history: generateHistory(7.2, 0.2) },
      od: { value: 0.988, unit: 'OD600', trend: 'up', trendDelta: 0.042, quality: 'good', history: generateHistory(0.95, 0.12) },
      agitation: { value: 225, unit: 'RPM', trend: 'up', trendDelta: 5, quality: 'excellent', history: generateHistory(220, 6) },
    },
  },
  {
    id: 'slave-007',
    hostname: 'evolver-s07',
    ip: '192.168.1.27',
    status: 'active',
    lastSeen: new Date(Date.now() - 1000).toISOString(),
    experimentId: null,
    alertCount: 0,
    sensors: {
      temperature: { value: 37.0, unit: '°C', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(37, 0.2) },
      ph: { value: 7.0, unit: 'pH', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(7.0, 0.1) },
      od: { value: 0.1, unit: 'OD600', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(0.1, 0.05) },
      agitation: { value: 200, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(200, 2) },
    },
  },
  {
    id: 'slave-008',
    hostname: 'evolver-s08',
    ip: '192.168.1.28',
    status: 'active',
    lastSeen: new Date(Date.now() - 1200).toISOString(),
    experimentId: null,
    alertCount: 0,
    sensors: {
      temperature: { value: 37.0, unit: '°C', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(37, 0.2) },
      ph: { value: 7.0, unit: 'pH', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(7.0, 0.1) },
      od: { value: 0.1, unit: 'OD600', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(0.1, 0.05) },
      agitation: { value: 200, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(200, 2) },
    },
  },
  {
    id: 'slave-009',
    hostname: 'evolver-s09',
    ip: '192.168.1.29',
    status: 'active',
    lastSeen: new Date(Date.now() - 900).toISOString(),
    experimentId: null,
    alertCount: 0,
    sensors: {
      temperature: { value: 37.0, unit: '°C', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(37, 0.2) },
      ph: { value: 7.0, unit: 'pH', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(7.0, 0.1) },
      od: { value: 0.1, unit: 'OD600', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(0.1, 0.05) },
      agitation: { value: 200, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(200, 2) },
    },
  },
  {
    id: 'slave-010',
    hostname: 'evolver-s10',
    ip: '192.168.1.30',
    status: 'active',
    lastSeen: new Date(Date.now() - 2000).toISOString(),
    experimentId: null,
    alertCount: 0,
    sensors: {
      temperature: { value: 37.0, unit: '°C', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(37, 0.2) },
      ph: { value: 7.0, unit: 'pH', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(7.0, 0.1) },
      od: { value: 0.1, unit: 'OD600', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(0.1, 0.05) },
      agitation: { value: 200, unit: 'RPM', trend: 'stable', trendDelta: 0, quality: 'excellent', history: generateHistory(200, 2) },
    },
  },
];

export const mockExperiments: Experiment[] = [
  {
    id: 'exp-001',
    name: 'E. coli Growth Curve — LB Medium',
    description: 'Characterization of E. coli BL21 growth kinetics in LB medium at 37°C with IPTG induction at OD600 = 0.6.',
    status: 'running',
    startedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    endedAt: null,
    duration: '18h 24m',
    slaveIds: ['slave-001', 'slave-002', 'slave-006'],
    alertCount: 2,
    researchers: [
      { id: 'r1', name: 'Dr. Ana Lima', email: 'ana.lima@lab.br', role: 'owner', avatar: 'AL' },
      { id: 'r2', name: 'Carlos Mota', email: 'carlos.mota@lab.br', role: 'collaborator', avatar: 'CM' },
      { id: 'r3', name: 'Beatriz Souza', email: 'beatriz.souza@lab.br', role: 'collaborator', avatar: 'BS' },
    ],
  },
  {
    id: 'exp-002',
    name: 'S. cerevisiae Fermentation — YPD',
    description: 'Yeast fermentation optimization in YPD medium. Monitoring ethanol production and cell density.',
    status: 'running',
    startedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    endedAt: null,
    duration: '6h 12m',
    slaveIds: ['slave-003', 'slave-005'],
    alertCount: 0,
    researchers: [
      { id: 'r4', name: 'Prof. João Ferreira', email: 'joao.ferreira@lab.br', role: 'owner', avatar: 'JF' },
      { id: 'r2', name: 'Carlos Mota', email: 'carlos.mota@lab.br', role: 'collaborator', avatar: 'CM' },
    ],
  },
  {
    id: 'exp-003',
    name: 'CHO Cell Culture — Biopharmaceutical',
    description: 'CHO cell culture for recombinant protein production. Completed 72h run.',
    status: 'completed',
    startedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    duration: '72h 00m',
    slaveIds: [],
    alertCount: 5,
    researchers: [
      { id: 'r1', name: 'Dr. Ana Lima', email: 'ana.lima@lab.br', role: 'owner', avatar: 'AL' },
    ],
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    slaveId: 'slave-002',
    slaveName: 'evolver-s02',
    experimentId: 'exp-001',
    sensor: 'temperature',
    severity: 'warning',
    message: 'Temperature above upper threshold (38.9°C > 38.5°C)',
    value: 38.9,
    threshold: 38.5,
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    resolved: false,
    resolvedAt: null,
  },
  {
    id: 'alert-002',
    slaveId: 'slave-002',
    slaveName: 'evolver-s02',
    experimentId: 'exp-001',
    sensor: 'ph',
    severity: 'warning',
    message: 'pH below lower threshold (6.8 < 6.9)',
    value: 6.8,
    threshold: 6.9,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    resolved: false,
    resolvedAt: null,
  },
  {
    id: 'alert-003',
    slaveId: 'slave-004',
    slaveName: 'evolver-s04',
    experimentId: null,
    sensor: 'temperature',
    severity: 'critical',
    message: 'Device offline — no data received for 8+ minutes',
    value: 0,
    threshold: 0,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    resolved: false,
    resolvedAt: null,
  },
  {
    id: 'alert-004',
    slaveId: 'slave-001',
    slaveName: 'evolver-s01',
    experimentId: 'exp-001',
    sensor: 'od',
    severity: 'info',
    message: 'OD600 reached induction threshold (0.842 ≥ 0.6)',
    value: 0.842,
    threshold: 0.6,
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    resolved: true,
    resolvedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
];

export const mockTimeSeries: Record<string, Record<SensorType, TimeSeriesPoint[]>> = {
  'slave-001': {
    temperature: generateTimeSeries(37, 0.8),
    ph: generateTimeSeries(7.0, 0.3),
    od: generateTimeSeries(0.5, 0.15),
    agitation: generateTimeSeries(220, 5),
  },
  'slave-002': {
    temperature: generateTimeSeries(37.5, 1.5),
    ph: generateTimeSeries(7.1, 0.4),
    od: generateTimeSeries(0.9, 0.2),
    agitation: generateTimeSeries(215, 8),
  },
};

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getSensorLabel(type: SensorType): string {
  const labels: Record<SensorType, string> = {
    temperature: 'Temperature',
    ph: 'pH',
    od: 'OD600',
    agitation: 'Agitation',
  };
  return labels[type];
}

export function getQualityLabel(quality: string): string {
  const labels: Record<string, string> = {
    excellent: 'Excellent',
    good: 'Good',
    poor: 'Poor',
    error: 'No Signal',
  };
  return labels[quality] ?? quality;
}
