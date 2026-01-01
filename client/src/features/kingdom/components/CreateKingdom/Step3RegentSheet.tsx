import React from "react";
import { AvatarSelector } from "./AnimatedCharacterSprite";

// Skills disponíveis (de todas as 3 classes)
// TODO: Idealmente buscar do servidor via socket
const AVAILABLE_SKILLS = [
  // Guerreiro
  {
    code: "WARRIOR_EXTRA_ATTACK",
    name: "Ataque Extra",
    description:
      "Quando usa a Ação de Ataque, você pode realizar um ataque a mais.",
    category: "PASSIVE",
    className: "Guerreiro",
    classColor: "text-red-400",
  },
  {
    code: "WARRIOR_SECOND_WIND",
    name: "Retomar Fôlego",
    description: "Recupera HP igual à sua Vitalidade. Uma vez por batalha.",
    category: "ACTIVE",
    className: "Guerreiro",
    classColor: "text-red-400",
  },
  {
    code: "WARRIOR_ACTION_SURGE",
    name: "Surto de Ação",
    description: "Você recebe uma ação extra em seu turno.",
    category: "ACTIVE",
    className: "Guerreiro",
    classColor: "text-red-400",
  },
  // Clérigo
  {
    code: "CLERIC_HEAL",
    name: "Curar",
    description: "Cura um aliado adjacente em 1d6 + Foco de HP.",
    category: "ACTIVE",
    className: "Clérigo",
    classColor: "text-yellow-400",
  },
  {
    code: "CLERIC_CELESTIAL_EXPULSION",
    name: "Expulsão Celestial",
    description:
      "Você e aliados adjacentes não podem ser afetados por Maldições.",
    category: "PASSIVE",
    className: "Clérigo",
    classColor: "text-yellow-400",
  },
  {
    code: "CLERIC_BLESS",
    name: "Abençoar",
    description: "Aliados em área ganham +1 em todos os testes por 3 turnos.",
    category: "ACTIVE",
    className: "Clérigo",
    classColor: "text-yellow-400",
  },
  // Mago
  {
    code: "WIZARD_ARCANE_MASTERY",
    name: "Maestria Arcana",
    description:
      "Pode conjurar qualquer magia arcana. +1 dado em testes de Foco.",
    category: "PASSIVE",
    className: "Mago",
    classColor: "text-blue-400",
  },
  {
    code: "WIZARD_FIREBALL",
    name: "Bola de Fogo",
    description: "Causa 2d6 de dano de fogo em todos os alvos em uma área.",
    category: "ACTIVE",
    className: "Mago",
    classColor: "text-blue-400",
  },
  {
    code: "WIZARD_TELEPORT",
    name: "Teleportar",
    description: "Teleporta para qualquer posição dentro do alcance.",
    category: "ACTIVE",
    className: "Mago",
    classColor: "text-blue-400",
  },
];

// Descrição dos atributos
const ATTRIBUTE_INFO = {
  combat: {
    name: "Combate",
    description: "Determina sua eficiência em ataques corpo a corpo",
    icon: "⚔️",
  },
  acuity: {
    name: "Acuidade",
    description: "Precisão em ataques à distância e percepção",
    icon: "🎯",
  },
  focus: {
    name: "Foco",
    description: "Poder mágico e resistência mental",
    icon: "✨",
  },
  armor: {
    name: "Armadura",
    description: "Redução de dano recebido",
    icon: "🛡️",
  },
  vitality: {
    name: "Vitalidade",
    description: "Pontos de vida máximos",
    icon: "❤️",
  },
};

interface Step3RegentSheetProps {
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
    acuity: number;
    focus: number;
    armor: number;
    vitality: number;
  };
  updateAttribute: (
    key: "combat" | "acuity" | "focus" | "armor" | "vitality",
    value: number
  ) => void;
  totalPoints: number;
  error: string | null;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export const Step3RegentSheet: React.FC<Step3RegentSheetProps> = ({
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
}) => {
  const isFormValid =
    regentName.length >= 2 && totalPoints === 30 && selectedAvatar;

  const pointsColor =
    totalPoints === 30
      ? "text-green-400"
      : totalPoints > 30
      ? "text-red-400"
      : "text-amber-400";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Título */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-amber-400">👑 Seu Regente</h2>
        <p className="text-slate-400 mt-1">
          Crie o líder do seu reino como uma ficha de RPG
        </p>
      </div>

      {/* Layout em duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Esquerda - Avatar e Identidade */}
        <div className="space-y-4">
          {/* Avatar Selector */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 text-center">
              Aparência
            </h3>
            <AvatarSelector
              selectedAvatar={selectedAvatar}
              onSelectAvatar={setSelectedAvatar}
              spriteSize={96}
            />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={regentName}
              onChange={(e) => setRegentName(e.target.value)}
              placeholder="Nome do seu regente..."
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg 
                         text-white placeholder:text-slate-500 
                         focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              História{" "}
              <span className="text-slate-500 font-normal">(opcional)</span>
            </label>
            <textarea
              value={regentDescription}
              onChange={(e) => setRegentDescription(e.target.value)}
              placeholder="Backstory do seu regente..."
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-lg 
                         text-white placeholder:text-slate-500 resize-none
                         focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              maxLength={300}
            />
          </div>
        </div>

        {/* Coluna Direita - Atributos e Skill */}
        <div className="space-y-4">
          {/* Atributos */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300">
                Atributos
              </h3>
              <span className={`text-sm font-bold ${pointsColor}`}>
                {totalPoints} / 30 pontos
              </span>
            </div>

            <div className="space-y-3">
              {(Object.keys(attributes) as Array<keyof typeof attributes>).map(
                (key) => {
                  const info = ATTRIBUTE_INFO[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xl w-8">{info.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white font-medium">
                            {info.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateAttribute(key, attributes[key] - 1)
                              }
                              disabled={attributes[key] <= 0}
                              className="w-7 h-7 rounded bg-slate-700/50 hover:bg-slate-600/50 
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       text-white font-bold transition-all"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-white font-bold">
                              {attributes[key]}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateAttribute(key, attributes[key] + 1)
                              }
                              disabled={totalPoints >= 30}
                              className="w-7 h-7 rounded bg-slate-700/50 hover:bg-slate-600/50 
                                       disabled:opacity-30 disabled:cursor-not-allowed
                                       text-white font-bold transition-all"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Skill Inicial */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Habilidade Inicial{" "}
              <span className="text-slate-500 font-normal">(opcional)</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {AVAILABLE_SKILLS.map((skill) => (
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
                      skill.category === "PASSIVE"
                        ? "bg-purple-900/50 text-purple-300"
                        : "bg-blue-900/50 text-blue-300"
                    }`}
                  >
                    {skill.category === "PASSIVE" ? "Passiva" : "Ativa"}
                  </span>
                </button>
              ))}
            </div>

            {/* Info sobre Regentes */}
            <div className="mt-3 p-2 bg-purple-900/20 rounded-lg border border-purple-700/30">
              <p className="text-xs text-purple-300">
                💡 <strong>Regentes</strong> podem escolher skills de{" "}
                <em>qualquer</em> classe! A cada 3 níveis, você aprende uma
                nova.
              </p>
            </div>
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
