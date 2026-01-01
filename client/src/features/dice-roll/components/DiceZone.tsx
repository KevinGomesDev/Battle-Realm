// client/src/features/dice-roll/components/DiceZone.tsx
// Zona de rolagem de dados

import { useMemo } from "react";
import type { DiceRollResult } from "../types/dice-roll.types";
import { toVisualRollResult } from "../types/dice-roll.types";
import Die from "./Die";

interface DiceZoneProps {
  rollResult: DiceRollResult | null;
  side: "attacker" | "defender";
  label: string;
  isRolling: boolean;
  onAllDiceSettled?: () => void;
}

export function DiceZone({
  rollResult,
  side,
  label,
  isRolling,
  onAllDiceSettled,
}: DiceZoneProps) {
  const isAttacker = side === "attacker";

  // Converter para resultado visual
  const visualResult = useMemo(() => {
    if (!rollResult) return null;
    return toVisualRollResult(rollResult, 0);
  }, [rollResult]);

  // Cores do tema
  const borderClass = isAttacker ? "border-blue-500/30" : "border-red-500/30";
  const bgClass = isAttacker ? "bg-blue-950/20" : "bg-red-950/20";
  const labelClass = isAttacker ? "text-blue-400" : "text-red-400";

  return (
    <div
      className={`
        flex flex-col rounded-lg border-2 p-4 min-h-[200px]
        ${borderClass} ${bgClass}
        ${isAttacker ? "attacker-side" : "defender-side"}
      `}
    >
      {/* Label */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-xs font-bold uppercase tracking-wider ${labelClass}`}
        >
          {label}
        </span>
        {rollResult && (
          <span className="text-xs text-gray-400">
            {rollResult.diceCount} dado{rollResult.diceCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Zona de dados */}
      <div className="flex-1 flex items-center justify-center">
        {!rollResult && !isRolling && (
          <div className="text-gray-500 text-sm italic">
            Aguardando rolagem...
          </div>
        )}

        {isRolling && !rollResult && (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-12 h-12 bg-slate-700 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}

        {visualResult && (
          <div
            className={`
              flex flex-wrap gap-3 justify-center
              ${isAttacker ? "flex-row" : "flex-row-reverse"}
            `}
          >
            {visualResult.dice.map((die) => (
              <Die
                key={die.id}
                die={die}
                side={side}
                successThreshold={visualResult.threshold}
                onAnimationComplete={onAllDiceSettled}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resumo */}
      {visualResult && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Sucessos:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: visualResult.successes }).map((_, i) => (
                <span
                  key={i}
                  className={`text-lg star-appear ${labelClass}`}
                  style={{ animationDelay: `${1500 + i * 100}ms` }}
                >
                  ★
                </span>
              ))}
              {visualResult.successes === 0 && (
                <span className="text-gray-500 text-sm">Nenhum</span>
              )}
            </div>
          </div>

          {visualResult.explosions > 0 && (
            <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
              💥 {visualResult.explosions} Explosão
              {visualResult.explosions > 1 ? "ões" : ""}!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DiceZone;
