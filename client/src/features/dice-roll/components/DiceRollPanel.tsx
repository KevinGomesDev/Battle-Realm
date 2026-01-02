// client/src/features/dice-roll/components/DiceRollPanel.tsx
// Painel compacto de rolagem de dados (integrado na UI, não modal)

import { useEffect, useState, useCallback } from "react";
import type { DiceRollPanelData, RollPhase } from "../types/dice-roll.types";
import "../styles/dice-animations.css";

interface DiceRollPanelProps {
  data: DiceRollPanelData | null;
  isVisible: boolean;
  onClose: () => void;
  autoCloseDelay?: number;
}

// Componente de dado compacto
const CompactDie = ({
  value,
  isSuccess,
  delay,
  isRolling,
}: {
  value: number;
  isSuccess: boolean;
  delay: number;
  isRolling: boolean;
}) => (
  <div
    className={`
      w-6 h-6 rounded flex items-center justify-center text-xs font-bold
      transition-all duration-300
      ${isRolling ? "animate-pulse scale-110" : ""}
      ${
        isSuccess
          ? "bg-green-500/80 text-white border border-green-400"
          : "bg-slate-700/80 text-gray-400 border border-slate-600"
      }
    `}
    style={{
      animationDelay: `${delay}ms`,
      opacity: isRolling ? 0.7 : 1,
    }}
  >
    {isRolling ? "?" : value}
  </div>
);

export function DiceRollPanel({
  data,
  isVisible,
  onClose,
  autoCloseDelay = 3000,
}: DiceRollPanelProps) {
  const [phase, setPhase] = useState<RollPhase>("intro");
  const [isClosing, setIsClosing] = useState(false);

  // Reset quando abre
  useEffect(() => {
    if (isVisible && data) {
      setPhase("intro");
      setIsClosing(false);
    }
  }, [isVisible, data]);

  // Progressão automática das fases (mais rápida que o modal)
  useEffect(() => {
    if (!isVisible || !data) return;

    const timings: Partial<Record<RollPhase, number>> = {
      intro: 400,
      "attacker-rolling": 800,
      "attacker-result": 400,
      "defender-rolling": 800,
      "defender-result": 400,
      comparison: 600,
    };

    const nextPhase: Partial<Record<RollPhase, RollPhase>> = {
      intro: "attacker-rolling",
      "attacker-rolling": "attacker-result",
      "attacker-result": data.defender ? "defender-rolling" : "outcome",
      "defender-rolling": "defender-result",
      "defender-result": "comparison",
      comparison: "outcome",
    };

    const delay = timings[phase];
    const next = nextPhase[phase];

    if (delay && next) {
      const timer = setTimeout(() => setPhase(next), delay);
      return () => clearTimeout(timer);
    }
  }, [phase, isVisible, data]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Auto close após mostrar resultado
  useEffect(() => {
    if (phase === "outcome" && autoCloseDelay > 0) {
      const timer = setTimeout(handleClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [phase, autoCloseDelay, handleClose]);

  // Skip para o fim
  const handleSkip = useCallback(() => {
    setPhase("outcome");
  }, []);

  if (!isVisible || !data) return null;

  const showAttackerRoll = phase !== "intro";
  const showDefenderRoll =
    data.defender &&
    ["defender-rolling", "defender-result", "comparison", "outcome"].includes(
      phase
    );
  const showOutcome = phase === "outcome";

  return (
    <div
      className={`
        bg-slate-900/95 border border-white/20 rounded-lg
        shadow-lg overflow-hidden
        transition-all duration-200
        ${isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"}
      `}
    >
      {/* Header compacto */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          {data.actionType === "attack"
            ? "⚔️ Combate"
            : `✨ ${data.skillName || "Ação"}`}
        </span>
        <div className="flex gap-1">
          {phase !== "outcome" && (
            <button
              onClick={handleSkip}
              className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded text-gray-300 transition-colors"
            >
              ⏩
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-2 py-0.5 text-[10px] bg-slate-600 hover:bg-slate-500 rounded text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-3">
        {/* VS Display compacto */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{data.attacker.icon}</span>
            <span className="text-xs text-blue-400 font-medium truncate max-w-[60px]">
              {data.attacker.name.split(" ")[0]}
            </span>
          </div>
          <span className="text-xs font-black text-gray-500">VS</span>
          {data.defender && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400 font-medium truncate max-w-[60px]">
                {data.defender.name.split(" ")[0]}
              </span>
              <span className="text-lg">{data.defender.icon}</span>
            </div>
          )}
        </div>

        {/* Seção de Ataque */}
        {showAttackerRoll && data.attackRoll && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-blue-400 uppercase font-bold">
                Ataque
              </span>
              <div className="flex-1 h-px bg-blue-500/30" />
              <span className="text-xs font-bold text-blue-300">
                {phase.includes("attacker") && phase !== "attacker-result"
                  ? "..."
                  : `${data.attackRoll.totalSuccesses} sucessos`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.attackRoll.diceResults.map(
                (roll: { value: number; isSuccess: boolean }, i: number) => (
                  <CompactDie
                    key={i}
                    value={roll.value}
                    isSuccess={roll.isSuccess}
                    delay={i * 50}
                    isRolling={phase === "attacker-rolling"}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Seção de Defesa */}
        {showDefenderRoll && data.defenseRoll && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-red-400 uppercase font-bold">
                Defesa
              </span>
              <div className="flex-1 h-px bg-red-500/30" />
              <span className="text-xs font-bold text-red-300">
                {phase.includes("defender") && phase !== "defender-result"
                  ? "..."
                  : `${data.defenseRoll.totalSuccesses} sucessos`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.defenseRoll.diceResults.map(
                (roll: { value: number; isSuccess: boolean }, i: number) => (
                  <CompactDie
                    key={i}
                    value={roll.value}
                    isSuccess={roll.isSuccess}
                    delay={i * 50}
                    isRolling={phase === "defender-rolling"}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Resultado */}
        {showOutcome && data.outcome && (
          <div
            className={`
              mt-2 p-2 rounded text-center
              ${
                data.outcome.isCritical
                  ? "bg-yellow-900/40 border border-yellow-500/50"
                  : ""
              }
              ${
                data.outcome.isDodge
                  ? "bg-gray-700/50 border border-gray-500/50"
                  : ""
              }
              ${
                data.outcome.isHit && !data.outcome.isCritical
                  ? "bg-red-900/40 border border-red-500/50"
                  : ""
              }
              ${
                !data.outcome.isHit && !data.outcome.isDodge
                  ? "bg-blue-900/40 border border-blue-500/50"
                  : ""
              }
            `}
          >
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              {data.outcome.isDodge
                ? "Esquivou!"
                : data.outcome.finalDamage === 0
                ? "Bloqueado!"
                : data.outcome.isCritical
                ? "Crítico!"
                : "Acertou!"}
            </div>
            {data.outcome.finalDamage > 0 && (
              <div className="text-xl font-black text-white mt-0.5">
                -{data.outcome.finalDamage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DiceRollPanel;
