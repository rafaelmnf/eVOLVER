/*
 * SlaveConfigForm — Formulário reutilizável de configuração por slave ("Bioluminescence")
 *
 * Renderiza os limites de DO, RPM e Temperatura + atuadores (bombas de DO e
 * velocidade do agitador). Valida faixas de segurança e, quando há valores fora
 * da faixa, exige confirmação expressa (checkbox) antes de habilitar o Salvar.
 *
 * Componente CONTROLADO: recebe `value` e dispara `onChange` — assim a tela que o
 * usa (ConfigureExperiment) pode manter um cache de edições por slave.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save, Thermometer, Gauge, Droplet } from 'lucide-react';

export interface SensorLimits {
  targetValue?: number | null;
  minLimit?: number | null;
  maxLimit?: number | null;
}

export interface SlaveConfig {
  temperature: SensorLimits;
  // RPM: min/max + velocidade do agitador (targetValue)
  agitation: SensorLimits;
  // DO: min/max + atuadores (tempos das bombas)
  od: SensorLimits & { feedPumpTime?: number | null; wastePumpTime?: number | null };
}

// Faixas de segurança (limites informados fora disso exigem confirmação expressa)
export const SAFETY_RANGES = {
  temperature: { min: 30, max: 38.5, unit: '°C' },
  agitation: { min: 100, max: 300, unit: 'RPM' },
  od: { min: 0.1, max: 2.5, unit: 'OD' },
} as const;

export function emptySlaveConfig(): SlaveConfig {
  return {
    temperature: { minLimit: null, maxLimit: null },
    agitation: { minLimit: null, maxLimit: null, targetValue: null },
    od: { minLimit: null, maxLimit: null, feedPumpTime: null, wastePumpTime: null },
  };
}

/** Retorna a lista de avisos de segurança para os limites informados. */
export function validateSafety(config: SlaveConfig): string[] {
  const warnings: string[] = [];

  const check = (
    label: string,
    range: { min: number; max: number; unit: string },
    ...values: (number | null | undefined)[]
  ) => {
    for (const v of values) {
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      if (v < range.min || v > range.max) {
        warnings.push(
          `${label}: ${v} ${range.unit} fora da faixa segura (${range.min}–${range.max} ${range.unit}).`
        );
      }
    }
  };

  check('Temperatura', SAFETY_RANGES.temperature, config.temperature.minLimit, config.temperature.maxLimit);
  check('RPM', SAFETY_RANGES.agitation, config.agitation.minLimit, config.agitation.maxLimit, config.agitation.targetValue);
  check('DO', SAFETY_RANGES.od, config.od.minLimit, config.od.maxLimit);

  return warnings;
}

/** Mapeia a resposta de GET /api/slaves/:slaveId/config para o shape do formulário. */
export function mapApiConfigToForm(apiConfig: Record<string, any> | undefined | null): SlaveConfig {
  const base = emptySlaveConfig();
  if (!apiConfig) return base;
  const t = apiConfig.temperature;
  const a = apiConfig.agitation;
  const o = apiConfig.od;
  return {
    temperature: {
      minLimit: t?.minLimit ?? null,
      maxLimit: t?.maxLimit ?? null,
      targetValue: t?.targetValue ?? null,
    },
    agitation: {
      minLimit: a?.minLimit ?? null,
      maxLimit: a?.maxLimit ?? null,
      targetValue: a?.targetValue ?? null,
    },
    od: {
      minLimit: o?.minLimit ?? null,
      maxLimit: o?.maxLimit ?? null,
      feedPumpTime: o?.feedPumpTime ?? null,
      wastePumpTime: o?.wastePumpTime ?? null,
    },
  };
}

/** Indica se há ao menos um valor preenchido (usado para inferir "já configurado"). */
export function hasAnyConfigValue(cfg: SlaveConfig): boolean {
  const vals = [
    cfg.temperature.minLimit, cfg.temperature.maxLimit,
    cfg.agitation.minLimit, cfg.agitation.maxLimit, cfg.agitation.targetValue,
    cfg.od.minLimit, cfg.od.maxLimit, cfg.od.feedPumpTime, cfg.od.wastePumpTime,
  ];
  return vals.some((v) => v !== null && v !== undefined);
}

/** Monta o body por sensor esperado pelo PUT /api/experiments/:id/slaves/:slaveId/config. */
export function buildConfigPayload(cfg: SlaveConfig) {
  return {
    temperature: {
      targetValue: cfg.temperature.targetValue ?? null,
      minLimit: cfg.temperature.minLimit ?? null,
      maxLimit: cfg.temperature.maxLimit ?? null,
    },
    agitation: {
      targetValue: cfg.agitation.targetValue ?? null,
      minLimit: cfg.agitation.minLimit ?? null,
      maxLimit: cfg.agitation.maxLimit ?? null,
    },
    od: {
      targetValue: cfg.od.targetValue ?? null,
      minLimit: cfg.od.minLimit ?? null,
      maxLimit: cfg.od.maxLimit ?? null,
      feedPumpTime: cfg.od.feedPumpTime ?? null,
      wastePumpTime: cfg.od.wastePumpTime ?? null,
    },
  };
}

interface SlaveConfigFormProps {
  value: SlaveConfig;
  onChange: (next: SlaveConfig) => void;
  onSave: () => void;
  saving?: boolean;
  title?: string;
}

// Parser que converte o texto do input em número ou null (campo vazio)
function parseNum(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function numValue(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function SlaveConfigForm({ value, onChange, onSave, saving, title }: SlaveConfigFormProps) {
  const warnings = useMemo(() => validateSafety(value), [value]);
  const [confirmed, setConfirmed] = useState(false);

  const hasWarnings = warnings.length > 0;
  const canSave = !saving && (!hasWarnings || confirmed);

  // Sempre que o conjunto de avisos mudar, reset do checkbox para forçar reconfirmação
  const warningsKey = warnings.join('|');
  useEffect(() => {
    setConfirmed(false);
  }, [warningsKey]);

  const set = (next: Partial<SlaveConfig>) => onChange({ ...value, ...next });

  return (
    <div className="space-y-5">
      {title && (
        <h3 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
          {title}
        </h3>
      )}

      {/* Temperatura */}
      <Section icon={<Thermometer size={14} />} label="Temperatura" hint={`Faixa segura: ${SAFETY_RANGES.temperature.min}–${SAFETY_RANGES.temperature.max} °C`}>
        <Field label="Mín (°C)" value={numValue(value.temperature.minLimit)} onChange={(v) => set({ temperature: { ...value.temperature, minLimit: parseNum(v) } })} />
        <Field label="Máx (°C)" value={numValue(value.temperature.maxLimit)} onChange={(v) => set({ temperature: { ...value.temperature, maxLimit: parseNum(v) } })} />
      </Section>

      {/* RPM / Agitação */}
      <Section icon={<Gauge size={14} />} label="RPM (Agitação)" hint={`Faixa segura: ${SAFETY_RANGES.agitation.min}–${SAFETY_RANGES.agitation.max} RPM`}>
        <Field label="Mín (RPM)" value={numValue(value.agitation.minLimit)} onChange={(v) => set({ agitation: { ...value.agitation, minLimit: parseNum(v) } })} />
        <Field label="Máx (RPM)" value={numValue(value.agitation.maxLimit)} onChange={(v) => set({ agitation: { ...value.agitation, maxLimit: parseNum(v) } })} />
        <Field label="Velocidade do agitador (RPM)" value={numValue(value.agitation.targetValue)} onChange={(v) => set({ agitation: { ...value.agitation, targetValue: parseNum(v) } })} />
      </Section>

      {/* DO */}
      <Section icon={<Droplet size={14} />} label="DO (Oxigênio Dissolvido)" hint={`Faixa segura: ${SAFETY_RANGES.od.min}–${SAFETY_RANGES.od.max} OD`}>
        <Field label="Mín (OD)" value={numValue(value.od.minLimit)} onChange={(v) => set({ od: { ...value.od, minLimit: parseNum(v) } })} />
        <Field label="Máx (OD)" value={numValue(value.od.maxLimit)} onChange={(v) => set({ od: { ...value.od, maxLimit: parseNum(v) } })} />
        <Field label="Bomba alimentação (s)" value={numValue(value.od.feedPumpTime)} onChange={(v) => set({ od: { ...value.od, feedPumpTime: parseNum(v) } })} />
        <Field label="Bomba descarte (s)" value={numValue(value.od.wastePumpTime)} onChange={(v) => set({ od: { ...value.od, wastePumpTime: parseNum(v) } })} />
      </Section>

      {/* Aviso de segurança + confirmação expressa */}
      {hasWarnings && (
        <div
          className="rounded p-3 space-y-2"
          style={{ backgroundColor: 'rgba(192,57,43,0.10)', border: '1px solid rgba(192,57,43,0.35)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--ev-danger)' }}>
            <AlertTriangle size={15} />
            <span className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace' }}>
              Valores fora da faixa de segurança
            </span>
          </div>
          <ul className="text-xs space-y-1" style={{ color: 'var(--ev-text-secondary)' }}>
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-xs cursor-pointer mt-1" style={{ color: 'var(--ev-text-secondary)' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Confirmo expressamente o uso destes valores fora da faixa de segurança.
          </label>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={!canSave}
        className="ev-btn-primary flex items-center justify-center gap-2 py-2.5 w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save size={15} />
        {saving ? 'Salvando...' : 'Salvar configuração'}
      </button>
    </div>
  );
}

function Section({ icon, label, hint, children }: { icon: React.ReactNode; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="ev-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2" style={{ color: 'var(--ev-green-primary)' }}>
          {icon}
          <span className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk, monospace', color: 'var(--ev-text-primary)' }}>
            {label}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--ev-text-muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {hint}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="ev-label block mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full ev-input"
        placeholder="—"
      />
    </div>
  );
}
