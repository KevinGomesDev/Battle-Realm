// client/src/features/dice-roll/components/CombatantPanel.tsx
// Painel de informações do combatente (atacante/defensor)

import type { RollPanelCombatant } from "../types/dice-roll.types";
import { getThresholdColors } from "../types/dice-roll.types";

interface CombatantPanelProps {
  combatant: RollPanelCombatant;
  side: "attacker" | "defender";
  isActive: boolean;
}

// Mini dados para mostrar threshold
const MiniDie = ({ face, isSuccess }: { face: number; isSuccess: boolean }) => (
  <div
    className={`
      w-6 h-6 rounded flex items-center justify-center text-xs font-bold
      transition-all duration-300
      ${
        isSuccess
          ? "bg-green-500/30 text-green-300 ring-1 ring-green-400"
          : "bg-gray-700/50 text-gray-500"
      }
    `}
  >
    {face}
  </div>
);

export function CombatantPanel({
  combatant,
  side,
  isActive,
}: CombatantPanelProps) {
  const isAttacker = side === "attacker";
  const { successFaces } = getThresholdColors(4 - combatant.advantageMod);

  // Cores do tema
  const themeClasses = isAttacker
    ? "border-blue-500/50 bg-blue-950/30"
    : "border-red-500/50 bg-red-950/30";

  const headerClasses = isAttacker
    ? "bg-blue-600/20 border-blue-500/30"
    : "bg-red-600/20 border-red-500/30";

  const accentColor = isAttacker ? "text-blue-400" : "text-red-400";

  return (
    <div
      className={`
        flex flex-col rounded-lg border-2 overflow-hidden
        transition-all duration-300
        ${themeClasses}
        ${isActive ? "ring-2 ring-white/30 scale-[1.02]" : "opacity-80"}
      `}
    >
      {/* Header com ícone e nome */}
      <div className={`px-4 py-3 border-b ${headerClasses}`}>
        <div className="flex items-center gap-3">
          {/* Ícone/Retrato */}
          <div
            className={`
              w-12 h-12 rounded-lg flex items-center justify-center text-2xl
              bg-slate-800 border
              ${isAttacker ? "border-blue-500/50" : "border-red-500/50"}
            `}
          >
            {combatant.icon}
          </div>

          {/* Nome e fonte */}
          <div className="flex-1">
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">
              {combatant.name}
            </h3>
            <p className={`text-xs ${accentColor}`}>
              Combat: {combatant.combat} ({combatant.diceCount} Dados)
            </p>
          </div>
        </div>
      </div>

      {/* Modificadores */}
      <div className="px-4 py-2 space-y-1">
        <p className="text-xs text-gray-400 uppercase tracking-wider">
          Modificadores:
        </p>
        {combatant.modifiers.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Nenhum</p>
        ) : (
          <div className="space-y-1">
            {combatant.modifiers.map((mod, i) => (
              <div
                key={i}
                className={`
                  flex items-center gap-2 text-xs px-2 py-1 rounded
                  ${
                    mod.type === "buff"
                      ? "bg-green-900/30 text-green-300"
                      : mod.type === "debuff"
                      ? "bg-red-900/30 text-red-300"
                      : "bg-gray-800/30 text-gray-300"
                  }
                `}
              >
                <span>
                  {mod.type === "buff"
                    ? "▲"
                    : mod.type === "debuff"
                    ? "▼"
                    : "•"}
                </span>
                <span>{mod.icon}</span>
                <span className="flex-1">{mod.name}</span>
                <span className="font-bold">
                  {typeof mod.value === "number" && mod.value > 0 ? "+" : ""}
                  {mod.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Margem de sucesso */}
      <div className="px-4 py-3 border-t border-white/5">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
          Margem de Sucesso: {4 - combatant.advantageMod}+
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <MiniDie
              key={face}
              face={face}
              isSuccess={successFaces.includes(face)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CombatantPanel;
