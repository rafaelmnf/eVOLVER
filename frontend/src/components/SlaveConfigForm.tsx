import { useState, useEffect } from 'react';
import { Save, AlertTriangle, Thermometer, Eye, Wind } from 'lucide-react';

interface SensorConfigInput {
  sensor: 'temperature' | 'od' | 'agitation';
  target_value?: number | null;
  min_limit: number;
  max_limit: number;
  feed_pump_time?: number | null;
  waste_pump_time?: number | null;
}

interface SlaveConfigFormProps {
  slaveId: string;
  onSave: (configs: SensorConfigInput[]) => Promise<void>;
  initialConfigs?: SensorConfigInput[];
  disabled?: boolean;
}

// Limites seguros recomendados
const SAFE_LIMITS = {
  temperature: { min: 30.0, max: 38.5 },
  od: { min: 0.1, max: 2.5 },
  agitation: { min: 100, max: 300 },
  pump: { min: 1, max: 60 }
};

export default function SlaveConfigForm({
  slaveId,
  onSave,
  initialConfigs = [],
  disabled = false
}: SlaveConfigFormProps) {
  // Estados para Temperatura
  const [tempMin, setTempMin] = useState<number>(35.0);
  const [tempMax, setTempMax] = useState<number>(38.0);

  // Estados para DO (Densidade Ótica)
  const [odMin, setOdMin] = useState<number>(0.2);
  const [odMax, setOdMax] = useState<number>(1.5);
  const [feedPumpTime, setFeedPumpTime] = useState<number>(5);
  const [wastePumpTime, setWastePumpTime] = useState<number>(5);

  // Estados para RPM
  const [rpmMin, setRpmMin] = useState<number>(150);
  const [rpmMax, setRpmMax] = useState<number>(250);
  const [rpmTarget, setRpmTarget] = useState<number>(200);

  // Estado para controle de salvamento e modal de aviso
  const [isSaving, setIsSaving] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessages, setWarningMessages] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carrega configurações iniciais se fornecidas
  useEffect(() => {
    if (initialConfigs && initialConfigs.length > 0) {
      const tempCfg = initialConfigs.find(c => c.sensor === 'temperature');
      if (tempCfg) {
        setTempMin(Number(tempCfg.min_limit));
        setTempMax(Number(tempCfg.max_limit));
      }

      const odCfg = initialConfigs.find(c => c.sensor === 'od');
      if (odCfg) {
        setOdMin(Number(odCfg.min_limit));
        setOdMax(Number(odCfg.max_limit));
        setFeedPumpTime(odCfg.feed_pump_time ? Number(odCfg.feed_pump_time) : 5);
        setWastePumpTime(odCfg.waste_pump_time ? Number(odCfg.waste_pump_time) : 5);
      }

      const rpmCfg = initialConfigs.find(c => c.sensor === 'agitation');
      if (rpmCfg) {
        setRpmMin(Number(rpmCfg.min_limit));
        setRpmMax(Number(rpmCfg.max_limit));
        setRpmTarget(rpmCfg.target_value ? Number(rpmCfg.target_value) : 200);
      }
    }
  }, [initialConfigs, slaveId]);

  // Função para validar se os valores estão fora dos limites seguros
  const checkSafeLimits = (): string[] => {
    const warnings: string[] = [];

    // Temperatura
    if (tempMin < SAFE_LIMITS.temperature.min || tempMin > SAFE_LIMITS.temperature.max) {
      warnings.push(`Temperatura Mínima recomendada é entre ${SAFE_LIMITS.temperature.min}°C e ${SAFE_LIMITS.temperature.max}°C (Informado: ${tempMin}°C).`);
    }
    if (tempMax < SAFE_LIMITS.temperature.min || tempMax > SAFE_LIMITS.temperature.max) {
      warnings.push(`Temperatura Máxima recomendada é entre ${SAFE_LIMITS.temperature.min}°C e ${SAFE_LIMITS.temperature.max}°C (Informado: ${tempMax}°C).`);
    }
    if (tempMin >= tempMax) {
      warnings.push(`A Temperatura Mínima (${tempMin}°C) deve ser menor que a Temperatura Máxima (${tempMax}°C).`);
    }

    // DO / OD
    if (odMin < SAFE_LIMITS.od.min || odMin > SAFE_LIMITS.od.max) {
      warnings.push(`Densidade Ótica Mínima recomendada é entre ${SAFE_LIMITS.od.min} e ${SAFE_LIMITS.od.max} OD (Informado: ${odMin} OD).`);
    }
    if (odMax < SAFE_LIMITS.od.min || odMax > SAFE_LIMITS.od.max) {
      warnings.push(`Densidade Ótica Máxima recomendada é entre ${SAFE_LIMITS.od.min} e ${SAFE_LIMITS.od.max} OD (Informado: ${odMax} OD).`);
    }
    if (odMin >= odMax) {
      warnings.push(`A Densidade Ótica Mínima (${odMin}) deve ser menor que a Densidade Ótica Máxima (${odMax}).`);
    }
    if (feedPumpTime < SAFE_LIMITS.pump.min || feedPumpTime > SAFE_LIMITS.pump.max) {
      warnings.push(`Tempo de Bomba de Alimentação recomendado é entre ${SAFE_LIMITS.pump.min}s e ${SAFE_LIMITS.pump.max}s (Informado: ${feedPumpTime}s).`);
    }
    if (wastePumpTime < SAFE_LIMITS.pump.min || wastePumpTime > SAFE_LIMITS.pump.max) {
      warnings.push(`Tempo de Bomba de Descarte recomendado é entre ${SAFE_LIMITS.pump.min}s e ${SAFE_LIMITS.pump.max}s (Informado: ${wastePumpTime}s).`);
    }

    // RPM / Agitação
    if (rpmMin < SAFE_LIMITS.agitation.min || rpmMin > SAFE_LIMITS.agitation.max) {
      warnings.push(`Rotação Mínima recomendada é entre ${SAFE_LIMITS.agitation.min} e ${SAFE_LIMITS.agitation.max} RPM (Informado: ${rpmMin} RPM).`);
    }
    if (rpmMax < SAFE_LIMITS.agitation.min || rpmMax > SAFE_LIMITS.agitation.max) {
      warnings.push(`Rotação Máxima recomendada é entre ${SAFE_LIMITS.agitation.min} e ${SAFE_LIMITS.agitation.max} RPM (Informado: ${rpmMax} RPM).`);
    }
    if (rpmMin >= rpmMax) {
      warnings.push(`A Rotação Mínima (${rpmMin} RPM) deve ser menor que a Rotação Máxima (${rpmMax} RPM).`);
    }
    if (rpmTarget < rpmMin || rpmTarget > rpmMax) {
      warnings.push(`O Alvo do Agitador (${rpmTarget} RPM) deve estar entre os limites mínimo (${rpmMin} RPM) e máximo (${rpmMax} RPM) definidos.`);
    }

    return warnings;
  };

  const handlePreSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    const warnings = checkSafeLimits();
    if (warnings.length > 0) {
      setWarningMessages(warnings);
      setShowWarningModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    setShowWarningModal(false);
    setSuccessMessage(null);

    const configsPayload: SensorConfigInput[] = [
      {
        sensor: 'temperature',
        min_limit: tempMin,
        max_limit: tempMax,
        target_value: 37.0 // valor fixo default
      },
      {
        sensor: 'od',
        min_limit: odMin,
        max_limit: odMax,
        feed_pump_time: feedPumpTime,
        waste_pump_time: wastePumpTime,
        target_value: null
      },
      {
        sensor: 'agitation',
        min_limit: rpmMin,
        max_limit: rpmMax,
        target_value: rpmTarget
      }
    ];

    try {
      await onSave(configsPayload);
      setSuccessMessage('Configuração salva com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handlePreSave} className="space-y-6">
      {successMessage && (
        <div className="p-3 text-xs rounded border transition-all animate-fade-in-up"
             style={{ backgroundColor: 'rgba(29,185,84,0.1)', borderColor: 'var(--ev-green-muted)', color: 'var(--ev-green-primary)' }}>
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bloco de Temperatura */}
        <div className="ev-card-elevated p-4 space-y-4">
          <div className="flex items-center gap-2 text-[var(--ev-green-primary)] border-b border-[var(--ev-border-subtle)] pb-2 mb-2">
            <Thermometer size={16} />
            <h4 className="font-semibold text-xs uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, monospace' }}>
              Temperatura (°C)
            </h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Valor Mínimo</label>
              <input
                type="number"
                step="0.1"
                required
                disabled={disabled || isSaving}
                value={tempMin}
                onChange={e => setTempMin(parseFloat(e.target.value))}
                className="w-full ev-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Valor Máximo</label>
              <input
                type="number"
                step="0.1"
                required
                disabled={disabled || isSaving}
                value={tempMax}
                onChange={e => setTempMax(parseFloat(e.target.value))}
                className="w-full ev-input font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bloco de Rotação (RPM) */}
        <div className="ev-card-elevated p-4 space-y-4">
          <div className="flex items-center gap-2 text-[var(--ev-green-primary)] border-b border-[var(--ev-border-subtle)] pb-2 mb-2">
            <Wind size={16} />
            <h4 className="font-semibold text-xs uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, monospace' }}>
              Rotação (RPM)
            </h4>
          </div>

          <div className="space-y-3">
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Valor Mínimo</label>
              <input
                type="number"
                step="1"
                required
                disabled={disabled || isSaving}
                value={rpmMin}
                onChange={e => setRpmMin(parseInt(e.target.value, 10))}
                className="w-full ev-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Valor Máximo</label>
              <input
                type="number"
                step="1"
                required
                disabled={disabled || isSaving}
                value={rpmMax}
                onChange={e => setRpmMax(parseInt(e.target.value, 10))}
                className="w-full ev-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Velocidade do Agitador (Target)</label>
              <input
                type="number"
                step="1"
                required
                disabled={disabled || isSaving}
                value={rpmTarget}
                onChange={e => setRpmTarget(parseInt(e.target.value, 10))}
                className="w-full ev-input font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bloco de Densidade Ótica (DO) */}
        <div className="ev-card-elevated p-4 space-y-4">
          <div className="flex items-center gap-2 text-[var(--ev-green-primary)] border-b border-[var(--ev-border-subtle)] pb-2 mb-2">
            <Eye size={16} />
            <h4 className="font-semibold text-xs uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, monospace' }}>
              Densidade Ótica (DO)
            </h4>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>DO Mínima</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={disabled || isSaving}
                  value={odMin}
                  onChange={e => setOdMin(parseFloat(e.target.value))}
                  className="w-full ev-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>DO Máxima</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={disabled || isSaving}
                  value={odMax}
                  onChange={e => setOdMax(parseFloat(e.target.value))}
                  className="w-full ev-input font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Bomba Alimentação (s)</label>
              <input
                type="number"
                step="0.5"
                required
                disabled={disabled || isSaving}
                value={feedPumpTime}
                onChange={e => setFeedPumpTime(parseFloat(e.target.value))}
                className="w-full ev-input font-mono text-xs"
                placeholder="tempo ativo"
              />
            </div>
            <div>
              <label className="ev-label block mb-1" style={{ fontSize: '0.65rem' }}>Bomba Descarte (s)</label>
              <input
                type="number"
                step="0.5"
                required
                disabled={disabled || isSaving}
                value={wastePumpTime}
                onChange={e => setWastePumpTime(parseFloat(e.target.value))}
                className="w-full ev-input font-mono text-xs"
                placeholder="tempo ativo"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ação principal */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={disabled || isSaving}
          className="ev-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Save size={14} />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Modal de confirmação para valores fora da faixa recomendada */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="ev-card w-full max-w-md p-6 relative shadow-2xl animate-fade-in-up">
            <div className="flex items-center gap-2.5 text-[#d4a017] mb-3">
              <AlertTriangle size={24} />
              <h3 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk, monospace' }}>
                Valores fora da Faixa Recomendada!
              </h3>
            </div>
            <p className="text-xs text-[var(--ev-text-secondary)] mb-4 leading-relaxed">
              Alguns parâmetros configurados estão fora das faixas recomendadas de segurança do sistema.
              Deseja salvar e aplicar essas configurações de qualquer forma?
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2 mb-6 p-3 rounded bg-black/40 border border-[var(--ev-border-subtle)] custom-scrollbar">
              {warningMessages.map((msg, idx) => (
                <div key={idx} className="text-[11px] text-[#d4a017] font-mono leading-tight">
                  • {msg}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="ev-btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Voltar e Ajustar
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="ev-btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: '#d4a017', color: '#0a0f0a' }}
              >
                Sim, desejo salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
