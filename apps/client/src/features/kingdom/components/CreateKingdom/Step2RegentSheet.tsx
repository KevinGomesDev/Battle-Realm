import React from "react";
import { AvatarSelector } from "./AnimatedCharacterSprite";
import { AttributesPanel } from "./AttributesPanel";
import type { AbilityDefinition as SkillDefinition } from "@boundless/shared/types/ability.types";

type SkillOption = SkillDefinition & { className: string; classColor: string };

interface Step2RegentSheetProps {
  regentName: string;
  setRegentName: (value: string) => void;
  regentDescription: string;
  setRegentDescription: (value: string) => void;
  selectedAvatar: string;
  setSelectedAvatar: (value: string) => void;
  selectedSkillId: string | undefined;
  setSelectedSkillId: (value: string) => void;
  attributes: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  };
  updateAttribute: (
    key: "combat" | "speed" | "focus" | "resistance" | "will" | "vitality",
    value: number
  ) => void;
  totalPoints: number;
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  skills: SkillOption[];
}

export const Step2RegentSheet: React.FC<Step2RegentSheetProps> = ({
  regentName,
  setRegentName,
  regentDescription,
  setRegentDescription,
  selectedAvatar,
  setSelectedAvatar,
  selectedSkillId,
  setSelectedSkillId,
  attributes,
  updateAttribute,
  totalPoints,
  error,
  isLoading,
  onSubmit,
  onBack,
  skills,
}) => {
  const isFormValid =
    regentName.length >= 2 &&
    totalPoints === 30 &&
    selectedAvatar &&
    !!selectedSkillId;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Layout em três blocos lado a lado no desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Aparência e Identidade */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Aparência</h3>
          <AvatarSelector
            selectedAvatar={selectedAvatar}
            onSelectAvatar={setSelectedAvatar}
            spriteSize={88}
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={regentName}
              onChange={(e) => setRegentName(e.target.value)}
              placeholder="Nome do seu regente..."
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-lg 
                         text-white placeholder:text-slate-500 
                         focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-white">
              História{" "}
              <span className="text-slate-500 font-normal">(opcional)</span>
            </label>
            <textarea
              value={regentDescription}
              onChange={(e) => setRegentDescription(e.target.value)}
              placeholder="Backstory do seu regente..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-lg 
                         text-white placeholder:text-slate-500 resize-none
                         focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              maxLength={300}
            />
          </div>
        </div>

        <AttributesPanel
          title="Atributos"
          attributes={attributes}
          totalPoints={totalPoints}
          maxPoints={30}
          onChange={updateAttribute}
        />

        {/* Habilidade Inicial */}
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">
            Habilidade Inicial <span className="text-red-400">*</span>
          </h3>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
            {skills.map((skill) => (
              <button
                key={skill.code}
                type="button"
                onClick={() =>
                  setSelectedSkillId(
                    selectedSkillId === skill.code ? "" : skill.code
                  )
                }
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedSkillId === skill.code
                    ? "bg-amber-900/30 border-amber-500/50"
                    : "bg-slate-700/30 border-slate-600/30 hover:border-slate-500/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {skill.name}
                  </span>
                  <span className={`text-xs ${skill.classColor}`}>
                    {skill.className}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {skill.description}
                </p>
                <span
                  className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                    skill.activationType === "PASSIVE"
                      ? "bg-stellar-deep/50 text-stellar-light"
                      : "bg-blue-900/50 text-blue-300"
                  }`}
                >
                  {skill.activationType === "PASSIVE" ? "Passiva" : "Ativa"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 
                     text-slate-300 font-semibold rounded-lg transition-all
                     border border-slate-600/30"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 
                     hover:from-amber-500 hover:to-amber-600
                     disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed 
                     text-white font-semibold rounded-lg transition-all
                     shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              Criando...
            </>
          ) : (
            <>Próximo - Tropas →</>
          )}
        </button>
      </div>
    </form>
  );
};
