import React from "react";
import { AttributeRow } from "./AttributeRow";
import { AvatarSelector } from "./AnimatedCharacterSprite";

interface Step2RegentProps {
  regentName: string;
  setRegentName: (value: string) => void;
  selectedAvatar?: string;
  setSelectedAvatar?: (value: string) => void;
  attributes: {
    combat: number;
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  };
  updateAttribute: (
    key: "combat" | "acuity" | "focus" | "armor" | "vitality",
    value: number
  ) => void;
  error: string | null;
  isLoading: boolean;
  totalPoints: number;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  // Manter props antigas para compatibilidade temporária
  selectedClass?: string;
  setSelectedClass?: (value: string) => void;
  classes?: any[];
}

export const Step2Regent: React.FC<Step2RegentProps> = ({
  regentName,
  setRegentName,
  selectedAvatar = "[1].png",
  setSelectedAvatar,
  attributes,
  updateAttribute,
  error,
  isLoading,
  totalPoints,
  onSubmit,
  onBack,
}) => {
  const isRegentValid = regentName.length >= 2 && totalPoints === 30;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Regent Name */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-semibold text-white">
            Nome do Regente
          </label>
          {regentName === "Lord Ashburn" && (
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
              ★ Padrão
            </span>
          )}
        </div>
        <input
          type="text"
          value={regentName}
          onChange={(e) => setRegentName(e.target.value)}
          placeholder="Ex: Lord Ashburn"
          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          required
        />
      </div>

      {/* Avatar Selection */}
      <div className="flex justify-center">
        <AvatarSelector
          selectedAvatar={selectedAvatar}
          onSelectAvatar={(avatar) => setSelectedAvatar?.(avatar)}
          spriteSize={96}
        />
      </div>

      {/* Info about Regents */}
      <div className="bg-purple-900/20 border border-purple-700 rounded p-3">
        <p className="text-purple-400 text-sm">
          <span className="font-semibold">💡 Sobre Regentes:</span> Diferente de
          Heróis, Regentes não possuem classe fixa. No nível 1 (e a cada 3
          níveis), seu Regente pode escolher uma skill de{" "}
          <strong>qualquer</strong> classe!
        </p>
      </div>

      {/* Attribute Distribution */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-white">
            Distribuir 30 Pontos de Atributo
          </label>
          <span
            className={`text-sm font-bold ${
              totalPoints === 30
                ? "text-green-400"
                : totalPoints > 30
                ? "text-red-400"
                : "text-yellow-400"
            }`}
          >
            {totalPoints} / 30
          </span>
        </div>

        <div className="space-y-3 bg-slate-700 rounded p-4">
          {Object.entries(attributes).map(([key, value]) => (
            <AttributeRow
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              value={value}
              onChange={(v: number) =>
                updateAttribute(
                  key as "combat" | "acuity" | "focus" | "armor" | "vitality",
                  v
                )
              }
            />
          ))}
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
          <span className="font-semibold">💡 Dica:</span> Seus atributos já
          estão distribuídos otimamente (7-5-5-4-4). Você pode ajustá-los
          conforme preferir mantendo o total em 30 pontos.
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
          disabled={!isRegentValid || isLoading}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              Carregando...
            </>
          ) : (
            <>Próximo →</>
          )}
        </button>
      </div>
    </form>
  );
};
