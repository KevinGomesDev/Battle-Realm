// client/src/features/dice-roll/components/SuccessVisualizer.tsx
// Visualizador de comparação de sucessos

import { useEffect, useState } from "react";
import type { RollOutcome } from "../types/dice-roll.types";

interface SuccessVisualizerProps {
  attackerSuccesses: number;
  defenderSuccesses: number;
  outcome: RollOutcome | null;
  isVisible: boolean;
}

export function SuccessVisualizer({
  attackerSuccesses,
  defenderSuccesses,
  outcome,
  isVisible,
}: SuccessVisualizerProps) {
  const [showHits, setShowHits] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setShowHits(false);
      setShowOutcome(false);
      return;
    }

    // Mostrar hits após delay
    const hitTimer = setTimeout(() => setShowHits(true), 500);
    const outcomeTimer = setTimeout(() => setShowOutcome(true), 1500);

    return () => {
      clearTimeout(hitTimer);
      clearTimeout(outcomeTimer);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  // Calcular hits que passam
  const hitsBlocked = Math.min(attackerSuccesses, defenderSuccesses);
  const hitsThroughCount = Math.max(0, attackerSuccesses - defenderSuccesses);

  // Cor do resultado
  const getOutcomeColor = () => {
    if (!outcome) return "text-gray-400";
    if (outcome.isCritical) return "text-yellow-400";
    if (outcome.isHit) return "text-red-400";
    if (outcome.isDodge || outcome.isPartialBlock) return "text-gray-400";
    return "text-blue-400";
  };

  // Texto do resultado
  const getOutcomeText = () => {
    if (!outcome) return "";
    if (outcome.isDodge) return "ESQUIVOU!";
    if (outcome.isPartialBlock && outcome.finalDamage === 0)
      return "BLOQUEADO!";
    if (outcome.isCritical) return "CRÍTICO!";
    if (outcome.isHit) return `${outcome.finalDamage} DANO`;
    return "ACERTOU!";
  };

  return (
    <div className="flex flex-col items-center py-6 border-t border-b border-white/10 bg-slate-900/50">
      {/* Comparação de sucessos */}
      <div className="flex items-center gap-8 mb-4">
        {/* Atacante */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400 uppercase mb-2">Atacante</span>
          <div className="flex gap-1">
            {Array.from({ length: attackerSuccesses }).map((_, i) => (
              <span
                key={i}
                className={`
                  text-2xl star-appear
                  ${i < hitsBlocked ? "text-gray-500" : "text-blue-400"}
                `}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                ★
              </span>
            ))}
            {attackerSuccesses === 0 && (
              <span className="text-gray-500 text-sm">—</span>
            )}
          </div>
          <span className="text-lg font-bold text-blue-400 mt-1">
            {attackerSuccesses} HIT{attackerSuccesses !== 1 ? "S" : ""}
          </span>
        </div>

        {/* VS */}
        <div className="text-4xl font-black text-gray-600 vs-appear">VS</div>

        {/* Defensor */}
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400 uppercase mb-2">Defensor</span>
          <div className="flex gap-1">
            {Array.from({ length: defenderSuccesses }).map((_, i) => (
              <span
                key={i}
                className="text-2xl star-appear text-red-400"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                ★
              </span>
            ))}
            {defenderSuccesses === 0 && (
              <span className="text-gray-500 text-sm">—</span>
            )}
          </div>
          <span className="text-lg font-bold text-red-400 mt-1">
            {defenderSuccesses} BLOCK{defenderSuccesses !== 1 ? "S" : ""}
          </span>
        </div>
      </div>

      {/* Animação de hits passando */}
      {showHits && hitsThroughCount > 0 && (
        <div className="flex items-center gap-2 my-4">
          <span className="text-gray-400 text-sm">→</span>
          {Array.from({ length: hitsThroughCount }).map((_, i) => (
            <span
              key={i}
              className="text-xl hit-travel text-yellow-400"
              style={
                {
                  "--start-x": "-50px",
                  "--end-x": "50px",
                  animationDelay: `${i * 150}ms`,
                } as React.CSSProperties
              }
            >
              ⚔️
            </span>
          ))}
          <span className="text-gray-400 text-sm">→</span>
        </div>
      )}

      {/* Resultado final */}
      {showOutcome && outcome && (
        <div className={`mt-4 damage-appear ${getOutcomeColor()}`}>
          <div className="text-center">
            <div className="text-sm uppercase tracking-wider text-gray-400 mb-1">
              Resultado
            </div>
            <div className="text-4xl font-black">{getOutcomeText()}</div>
            {outcome.finalDamage > 0 && (
              <div className="text-6xl font-black mt-2 animate-pulse">
                {outcome.finalDamage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SuccessVisualizer;
