import React, { useState } from "react";
import type { TroopPassive, TroopTemplate, BaseAttributes } from "./types";
import { AvatarSelector } from "./AnimatedCharacterSprite";

const RESOURCE_TYPES = [
  { id: "ore", name: "Ore", color: "text-amber-400" },
  { id: "supplies", name: "Supplies", color: "text-green-400" },
  { id: "arcane", name: "Arcane", color: "text-purple-400" },
  { id: "experience", name: "Experience", color: "text-blue-400" },
  { id: "devotion", name: "Devotion", color: "text-yellow-400" },
] as const;

const TROOP_SLOTS = [
  { index: 0, defaultName: "Tropa 1" },
  { index: 1, defaultName: "Tropa 2" },
  { index: 2, defaultName: "Tropa 3" },
  { index: 3, defaultName: "Tropa 4" },
  { index: 4, defaultName: "Tropa 5" },
];

const ATTRIBUTE_LABELS: Record<string, string> = {
  combat: "Combate",
  acuity: "Perspicácia",
  focus: "Foco",
  armor: "Armadura",
  vitality: "Vitalidade",
};

interface Step3TroopsProps {
  templates: TroopTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<TroopTemplate[]>>;
  passives: TroopPassive[];
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  // Optional hook-based props
  activeSlot?: number;
  setActiveSlot?: (slot: number) => void;
  updateTemplate?: (slotIndex: number, updates: Partial<TroopTemplate>) => void;
  updateAttribute?: (
    slotIndex: number,
    attr: keyof BaseAttributes,
    value: number
  ) => void;
}

export const Step3Troops: React.FC<Step3TroopsProps> = ({
  templates,
  setTemplates,
  passives,
  error,
  isLoading,
  onSubmit,
  onBack,
  activeSlot: externalActiveSlot,
  setActiveSlot: externalSetActiveSlot,
  updateTemplate: externalUpdateTemplate,
  updateAttribute: externalUpdateAttribute,
}) => {
  // Use external state if provided, otherwise use local state
  const [localActiveSlot, setLocalActiveSlot] = useState(0);
  const activeSlot = externalActiveSlot ?? localActiveSlot;
  const setActiveSlot = externalSetActiveSlot ?? setLocalActiveSlot;

  const updateTemplate =
    externalUpdateTemplate ??
    ((slotIndex: number, updates: Partial<TroopTemplate>) => {
      setTemplates((prev) =>
        prev.map((t) => (t.slotIndex === slotIndex ? { ...t, ...updates } : t))
      );
    });

  const updateAttribute =
    externalUpdateAttribute ??
    ((slotIndex: number, attr: keyof BaseAttributes, value: number) => {
      const safeValue = Math.max(0, Math.min(10, value));
      updateTemplate(slotIndex, { [attr]: safeValue });
    });

  const currentTemplate = templates[activeSlot];
  const currentTotal =
    currentTemplate.combat +
    currentTemplate.acuity +
    currentTemplate.focus +
    currentTemplate.armor +
    currentTemplate.vitality;

  const allTemplatesValid = templates.every((t) => {
    const total = t.combat + t.acuity + t.focus + t.armor + t.vitality;
    return t.name && t.passiveId && t.resourceType && total === 10;
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Slot Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TROOP_SLOTS.map((slot) => {
          const t = templates[slot.index];
          const total = t.combat + t.acuity + t.focus + t.armor + t.vitality;
          const isValid =
            t.name && t.passiveId && t.resourceType && total === 10;

          return (
            <button
              key={slot.index}
              type="button"
              onClick={() => setActiveSlot(slot.index)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all ${
                activeSlot === slot.index
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              } ${isValid ? "ring-2 ring-green-500" : ""}`}
            >
              {t.name || slot.defaultName}
              {isValid && <span className="ml-2 text-green-400">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Current Template Editor */}
      <div className="bg-slate-700/50 rounded-lg p-4 space-y-4">
        {/* Nome da Tropa */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-semibold text-white">
              Nome da Tropa
            </label>
            {currentTemplate.name === `Tropa ${activeSlot + 1}` && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                ★ Auto-gerado
              </span>
            )}
          </div>
          <input
            type="text"
            value={currentTemplate.name}
            onChange={(e) =>
              updateTemplate(activeSlot, { name: e.target.value })
            }
            placeholder="Ex: Guardas Reais"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {/* Aparência da Tropa */}
        <div className="flex justify-center">
          <AvatarSelector
            selectedAvatar={currentTemplate.avatar || "[1].png"}
            onSelectAvatar={(avatar) => updateTemplate(activeSlot, { avatar })}
            spriteSize={80}
          />
        </div>

        {/* Passiva */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-semibold text-white">
              Passiva da Tropa
            </label>
            {currentTemplate.passiveId &&
              passives.length > 0 &&
              currentTemplate.passiveId ===
                passives[activeSlot % passives.length]?.id && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                  ✓ Auto-selecionado
                </span>
              )}
          </div>
          <select
            value={currentTemplate.passiveId}
            onChange={(e) =>
              updateTemplate(activeSlot, { passiveId: e.target.value })
            }
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
            required
          >
            <option value="">Selecione uma passiva...</option>
            {passives.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {currentTemplate.passiveId && (
            <p className="text-slate-400 text-xs mt-1">
              {
                passives.find((p) => p.id === currentTemplate.passiveId)
                  ?.description
              }
            </p>
          )}
        </div>

        {/* Recurso */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-semibold text-white">
              Recurso de Recrutamento
            </label>
            {currentTemplate.resourceType ===
              RESOURCE_TYPES[activeSlot % RESOURCE_TYPES.length]?.id && (
              <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                ★ Distribuído
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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

        {/* Atributos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">
              Distribuir 10 Pontos de Atributo
            </label>
            <span
              className={`text-sm font-bold ${
                currentTotal === 10
                  ? "text-green-400"
                  : currentTotal > 10
                  ? "text-red-400"
                  : "text-yellow-400"
              }`}
            >
              {currentTotal} / 10
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {(["combat", "acuity", "focus", "armor", "vitality"] as const).map(
              (attr) => (
                <div key={attr} className="bg-slate-800/50 rounded p-3">
                  <label className="block text-xs text-slate-400 mb-1">
                    {ATTRIBUTE_LABELS[attr]}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateAttribute(
                          activeSlot,
                          attr,
                          currentTemplate[attr] - 1
                        )
                      }
                      className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded text-white"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-white">
                      {currentTemplate[attr]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateAttribute(
                          activeSlot,
                          attr,
                          currentTemplate[attr] + 1
                        )
                      }
                      className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-slate-700/30 rounded p-3">
        <h4 className="text-sm font-semibold text-white mb-2">
          Resumo das Tropas
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          {templates.map((t, i) => {
            const total = t.combat + t.acuity + t.focus + t.armor + t.vitality;
            const isValid =
              t.name && t.passiveId && t.resourceType && total === 10;
            return (
              <div
                key={i}
                className={`p-2 rounded cursor-pointer transition-all ${
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

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Info about defaults */}
      <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
        <p className="text-blue-400 text-sm">
          <span className="font-semibold">💡 Dica:</span> Suas tropas já têm
          nomes, passivas e recursos distribuídos automaticamente. Personalize
          conforme desejar ou finalize a criação do reino agora!
        </p>
      </div>

      {/* Buttons */}
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
