// client/src/features/dice-roll/components/DiceRollModal.tsx
// Modal principal de rolagem de dados

import { useEffect, useState, useCallback } from "react";
import type { DiceRollPanelData, RollPhase } from "../types/dice-roll.types";
import CombatantPanel from "./CombatantPanel";
import DiceZone from "./DiceZone";
import SuccessVisualizer from "./SuccessVisualizer";
import "../styles/dice-animations.css";

interface DiceRollModalProps {
  data: DiceRollPanelData;
  isOpen: boolean;
  onClose: () => void;
  autoCloseDelay?: number;
  skipAnimations?: boolean;
}

export function DiceRollModal({
  data,
  isOpen,
  onClose,
  autoCloseDelay = 0,
  skipAnimations = false,
}: DiceRollModalProps) {
  const [phase, setPhase] = useState<RollPhase>("intro");
  const [isClosing, setIsClosing] = useState(false);

  // Reset quando abre
  useEffect(() => {
    if (isOpen) {
      setPhase("intro");
      setIsClosing(false);
    }
  }, [isOpen]);

  // Progressão automática das fases
  useEffect(() => {
    if (!isOpen || skipAnimations) return;

    const timings: Partial<Record<RollPhase, number>> = {
      intro: 1000,
      "attacker-rolling": 2000,
      "attacker-result": 1000,
      "defender-rolling": 2000,
      "defender-result": 1000,
      comparison: 2500,
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
  }, [phase, isOpen, skipAnimations, data.defender]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Auto close para combates (3 segundos após mostrar resultado)
  useEffect(() => {
    if (phase === "outcome" && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [phase, autoCloseDelay, handleClose]);

  // Skip para o fim
  const handleSkip = useCallback(() => {
    setPhase("outcome");
  }, []);

  if (!isOpen) return null;

  // Determinar o que mostrar em cada fase
  const showAttackerRoll = phase !== "intro";
  const showDefenderRoll =
    data.defender &&
    ["defender-rolling", "defender-result", "comparison", "outcome"].includes(
      phase
    );
  const showComparison = ["comparison", "outcome"].includes(phase);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-black/80 backdrop-blur-sm
          transition-opacity duration-300
          ${isClosing ? "opacity-0" : "opacity-100"}
        `}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-5xl
          bg-slate-900 border border-white/10 rounded-2xl
          shadow-2xl overflow-hidden
          dice-roll-panel
          ${isClosing ? "panel-exit" : "panel-enter"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-wider text-white">
              {data.actionType === "attack"
                ? "COMBATE"
                : data.skillName || "AÇÃO"}
            </h2>
            <div className="flex gap-2">
              {phase !== "outcome" && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-gray-300 transition-colors"
                >
                  Pular ⏩
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Corpo principal */}
        <div className="p-6">
          {/* Grid de 3 colunas */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Painel do Atacante */}
            <CombatantPanel
              combatant={data.attacker}
              side="attacker"
              isActive={phase.includes("attacker") || phase === "intro"}
            />

            {/* Visual do Clash (centro) */}
            <div className="flex flex-col items-center justify-center">
              {/* Retratos */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-blue-900/30 border-2 border-blue-500/50 flex items-center justify-center text-4xl">
                  {data.attacker.icon}
                </div>
                <div className="text-4xl font-black text-gray-600 vs-appear">
                  VS
                </div>
                {data.defender && (
                  <div className="w-20 h-20 rounded-xl bg-red-900/30 border-2 border-red-500/50 flex items-center justify-center text-4xl">
                    {data.defender.icon}
                  </div>
                )}
              </div>

              {/* Indicador de fase */}
              <div className="mt-4 text-xs text-gray-500 uppercase tracking-wider">
                {phase === "intro" && "Preparando..."}
                {phase === "attacker-rolling" && "Atacante rola..."}
                {phase === "attacker-result" && "Resultado do ataque!"}
                {phase === "defender-rolling" && "Defensor rola..."}
                {phase === "defender-result" && "Resultado da defesa!"}
                {phase === "comparison" && "Comparando..."}
                {phase === "outcome" && "Resultado Final!"}
              </div>
            </div>

            {/* Painel do Defensor */}
            {data.defender ? (
              <CombatantPanel
                combatant={data.defender}
                side="defender"
                isActive={phase.includes("defender")}
              />
            ) : (
              <div className="flex items-center justify-center text-gray-500 italic">
                Sem oposição
              </div>
            )}
          </div>

          {/* Zonas de rolagem */}
          <div className="grid grid-cols-3 gap-6">
            {/* Zona do Atacante */}
            <DiceZone
              rollResult={showAttackerRoll ? data.attackRoll ?? null : null}
              side="attacker"
              label="Zona de Ataque"
              isRolling={phase === "attacker-rolling"}
            />

            {/* Espaço central ou visualizador de sucessos */}
            <div className="flex items-center justify-center">
              {showComparison && data.attackRoll && data.defenseRoll ? (
                <SuccessVisualizer
                  attackerSuccesses={data.attackRoll.totalSuccesses}
                  defenderSuccesses={data.defenseRoll.totalSuccesses}
                  outcome={data.outcome ?? null}
                  isVisible={showComparison}
                />
              ) : (
                <div className="text-gray-600">
                  {phase.includes("attacker") && "⚔️"}
                  {phase.includes("defender") && "🛡️"}
                </div>
              )}
            </div>

            {/* Zona do Defensor */}
            <DiceZone
              rollResult={showDefenderRoll ? data.defenseRoll ?? null : null}
              side="defender"
              label="Zona de Defesa"
              isRolling={phase === "defender-rolling"}
            />
          </div>
        </div>

        {/* Footer com resultado */}
        {phase === "outcome" && data.outcome && (
          <div
            className={`
              px-6 py-4 border-t border-white/10
              ${data.outcome.isCritical ? "bg-yellow-900/20" : ""}
              ${data.outcome.isDodge ? "bg-gray-800/50" : ""}
              ${
                data.outcome.isHit && !data.outcome.isCritical
                  ? "bg-red-900/20"
                  : ""
              }
            `}
          >
            <div className="text-center">
              <span className="text-sm text-gray-400 uppercase tracking-wider">
                {data.outcome.isDodge
                  ? "Esquivou!"
                  : data.outcome.finalDamage === 0
                  ? "Bloqueado!"
                  : data.outcome.isCritical
                  ? "Crítico!"
                  : "Dano!"}
              </span>
              {data.outcome.finalDamage > 0 && (
                <span className="ml-3 text-3xl font-black text-white">
                  {data.outcome.finalDamage}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DiceRollModal;
