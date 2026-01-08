import React from "react";
import type { TroopPassive, TroopTemplate, BaseAttributes } from "./types";
import { AvatarSelector } from "./AnimatedCharacterSprite";
import { AttributesPanel } from "./AttributesPanel";

const RESOURCE_TYPES = [
  { id: "ore", name: "Ore", color: "text-amber-400" },
  { id: "supplies", name: "Supplies", color: "text-green-400" },
  { id: "arcane", name: "Arcane", color: "text-stellar-amber" },
  { id: "experience", name: "Experience", color: "text-blue-400" },
  { id: "devotion", name: "Devotion", color: "text-yellow-400" },
] as const;

interface Step3TroopsProps {
  templates: TroopTemplate[];
  setTemplates: (templates: TroopTemplate[]) => void;
  passives: TroopPassive[];
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  activeSlot: number;
  setActiveSlot: (slot: number) => void;
  updateTemplate: (index: number, data: Partial<TroopTemplate>) => void;
  updateAttribute: (
    index: number,
    attr: keyof BaseAttributes,
    value: number
  ) => void;
  /** Avatar do regente para impedir duplicação */
  regentAvatar?: string;
}

export const Step3Troops: React.FC<Step3TroopsProps> = ({
  templates,
  setTemplates: _setTemplates,
  passives,
  error,
  isLoading,
  onSubmit,
  onBack,
  activeSlot,
  setActiveSlot,
  updateTemplate,
  updateAttribute,
  regentAvatar,
}) => {
  const currentTemplate = templates[activeSlot];
  const currentTotal =
    currentTemplate.combat +
    currentTemplate.speed +
    currentTemplate.focus +
    currentTemplate.resistance +
    currentTemplate.will +
    currentTemplate.vitality;

  // Calcular avatares em uso: regente + outras tropas (não a atual)
  const usedAvatarsForCurrentSlot = [
    // Avatar do regente
    ...(regentAvatar ? [regentAvatar] : []),
    // Avatares das outras tropas (não a do slot atual)
    ...templates
      .filter((_, i) => i !== activeSlot)
      .map((t) => t.avatar)
      .filter((a): a is string => !!a),
  ];

  const allTemplatesValid = templates.every((t) => {
    const total =
      t.combat + t.speed + t.focus + t.resistance + t.will + t.vitality;
    return t.name && t.passiveId && t.resourceType && total === 10;
  });

  const handleAttributeChange = (key: keyof BaseAttributes, value: number) => {
    updateAttribute(activeSlot, key, value);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-slate-700/30 rounded">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          {templates.map((t, i) => {
            const total =
              t.combat + t.speed + t.focus + t.resistance + t.will + t.vitality;
            const isValid =
              t.name && t.passiveId && t.resourceType && total === 10;
            return (
              <div
                key={i}
                className={`p-2 flex gap-2 rounded cursor-pointer transition-all ${
                  isValid
                    ? "bg-green-900/30 border border-green-700"
                    : "bg-slate-800"
                } ${activeSlot === i ? "ring-2 ring-blue-500" : ""}`}
                onClick={() => setActiveSlot(i)}
              >
                <div className="font-medium text-white truncate">
                  {t.name || `Slot ${i + 1}`}
                </div>
                <div
                  className={`${
                    total === 10 ? "text-green-400" : "text-slate-400"
                  }`}
                >
                  Pts: {total}/10
                </div>
                {isValid && <span className="text-green-400">✓ Válido</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Identidade</h3>
            {currentTemplate.name === `Tropa ${activeSlot + 1}` && (
              <span className="text-xs bg-blue-700/50 text-blue-200 px-2 py-1 rounded">
                ★ Auto-gerado
              </span>
            )}
          </div>

          <AvatarSelector
            selectedAvatar={currentTemplate.avatar || "1"}
            onSelectAvatar={(avatar) => updateTemplate(activeSlot, { avatar })}
            spriteSize={88}
            usedAvatars={usedAvatarsForCurrentSlot}
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">
              Nome da Tropa
            </label>
            <input
              type="text"
              value={currentTemplate.name}
              onChange={(e) =>
                updateTemplate(activeSlot, { name: e.target.value })
              }
              placeholder="Ex: Guardas Reais"
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">
                Recurso de Recrutamento
              </label>
              {currentTemplate.resourceType ===
                RESOURCE_TYPES[activeSlot % RESOURCE_TYPES.length]?.id && (
                <span className="text-xs bg-blue-700/50 text-blue-200 px-2 py-0.5 rounded">
                  ★ Distribuído
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RESOURCE_TYPES.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() =>
                    updateTemplate(activeSlot, {
                      resourceType: res.id as TroopTemplate["resourceType"],
                    })
                  }
                  className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                    currentTemplate.resourceType === res.id
                      ? `bg-slate-600 ${res.color} ring-2 ring-blue-500`
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {res.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AttributesPanel
          title="Atributos"
          attributes={currentTemplate}
          totalPoints={currentTotal}
          maxPoints={10}
          onChange={handleAttributeChange}
        />

        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Passiva</h3>
            {currentTemplate.passiveId &&
              passives.length > 0 &&
              currentTemplate.passiveId ===
                passives[activeSlot % passives.length]?.code && (
                <span className="text-xs bg-green-700/40 text-green-200 px-2 py-0.5 rounded">
                  ✓ Auto-selecionado
                </span>
              )}
          </div>

          <select
            value={currentTemplate.passiveId}
            onChange={(e) =>
              updateTemplate(activeSlot, { passiveId: e.target.value })
            }
            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded text-white focus:outline-none focus:border-amber-500/50"
            required
          >
            <option value="">Selecione uma passiva...</option>
            {passives.map((p) => (
              <option key={p.code} value={p.code} title={p.description}>
                {p.name}
              </option>
            ))}
          </select>

          {currentTemplate.passiveId && (
            <p className="text-slate-300 text-xs bg-slate-900/40 rounded p-2 border border-slate-700/40">
              {
                passives.find((p) => p.code === currentTemplate.passiveId)
                  ?.description
              }
            </p>
          )}

          <div className="rounded-lg bg-slate-900/40 border border-slate-700/40 p-3 space-y-1 text-sm text-slate-200">
            <div className="flex justify-between">
              <span>Recurso</span>
              <span className="font-semibold">
                {currentTemplate.resourceType || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Pontos</span>
              <span className="font-semibold">{currentTotal} / 10</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span
                className={
                  currentTemplate.name &&
                  currentTemplate.passiveId &&
                  currentTemplate.resourceType &&
                  currentTotal === 10
                    ? "text-green-400"
                    : "text-amber-400"
                }
              >
                {currentTemplate.name &&
                currentTemplate.passiveId &&
                currentTemplate.resourceType &&
                currentTotal === 10
                  ? "Pronto"
                  : "Incompleto"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={!allTemplatesValid || isLoading}
          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Criando Reino...
            </>
          ) : (
            <>Finalizar Criação ✓</>
          )}
        </button>
      </div>
    </form>
  );
};
