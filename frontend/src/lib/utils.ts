import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata uma data ISO para o padrão brasileiro DD/MM/YYYY HH:mm.
 * Retorna "—" para valores ausentes/inválidos.
 */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Intervalo de envio de dados do experimento (segundos). Faixa OBRIGATÓRIA 20–200.
export const DATA_SEND_INTERVAL_RANGE = { min: 20, max: 200, unit: "s" } as const;

/** Erro de validação do intervalo (null = válido). Faixa obrigatória 20–200s. */
export function validateDataSendInterval(v: number | null | undefined): string | null {
  const { min, max, unit } = DATA_SEND_INTERVAL_RANGE;
  if (v === null || v === undefined || Number.isNaN(v)) {
    return `Tempo de envio é obrigatório (${min}–${max} ${unit}).`;
  }
  if (v < min || v > max) {
    return `Tempo de envio deve estar entre ${min} e ${max} ${unit}.`;
  }
  return null;
}
