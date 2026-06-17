/*
 * StatusBadge — Badge colorido de status de experimento ("Bioluminescence")
 * Mapeia o status para cor/label/pulse, reaproveitando as classes .ev-badge-*.
 *
 *  draft     -> cinza (Rascunho)
 *  running   -> verde piscante (Em execução)
 *  paused    -> amarelo (Pausado)
 *  completed -> cinza escuro (Finalizado)
 *  error     -> vermelho (Erro)
 *  stopped   -> cinza (Parado)
 */
import { ExperimentStatus } from '@/lib/mockData';

interface StatusConfig {
  className: string;
  label: string;
  dot: string;
  pulse: boolean;
  style?: React.CSSProperties;
}

const STATUS_CONFIG: Record<ExperimentStatus, StatusConfig> = {
  draft: {
    className: 'ev-badge-offline',
    label: 'Rascunho',
    dot: '#8aab8a',
    pulse: false,
  },
  running: {
    className: 'ev-badge-active',
    label: 'Em execução',
    dot: 'var(--ev-green-primary)',
    pulse: true,
  },
  paused: {
    className: 'ev-badge-warning',
    label: 'Pausado',
    dot: '#d4a017',
    pulse: false,
  },
  completed: {
    className: 'ev-badge',
    label: 'Finalizado',
    dot: '#4a6a4a',
    pulse: false,
    style: {
      backgroundColor: 'var(--ev-bg-elevated)',
      color: 'var(--ev-text-secondary)',
      border: '1px solid var(--ev-border-default)',
    },
  },
  error: {
    className: 'ev-badge-danger',
    label: 'Erro',
    dot: '#e74c3c',
    pulse: false,
  },
  stopped: {
    className: 'ev-badge-offline',
    label: 'Parado',
    dot: '#4a6a4a',
    pulse: false,
  },
};

export default function StatusBadge({
  status,
  className = '',
}: {
  status: ExperimentStatus;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  return (
    <span
      className={`${cfg.className} flex-shrink-0 inline-flex items-center gap-1 ${className}`}
      style={cfg.style}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.pulse ? 'animate-pulse-dot' : ''}`}
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}
