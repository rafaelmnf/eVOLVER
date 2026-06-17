/*
 * Fab — Floating Action Button ("Bioluminescence")
 * Botão redondo fixo no canto inferior direito, com glow verde do tema.
 */
import { Plus } from 'lucide-react';

interface FabProps {
  onClick: () => void;
  title?: string;
  icon?: React.ReactNode;
}

export default function Fab({ onClick, title = 'Novo experimento', icon }: FabProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        backgroundColor: 'var(--ev-green-primary)',
        color: 'var(--ev-bg-primary)',
        boxShadow: '0 0 0 1px var(--ev-green-muted), 0 8px 24px var(--ev-green-glow)',
      }}
    >
      {icon ?? <Plus size={24} strokeWidth={2.5} />}
    </button>
  );
}
