// client/src/features/dice-roll/components/Die.tsx
// Componente visual de um dado D6

import { useEffect, useState } from "react";
import type { VisualDie, DieVisualState } from "../types/dice-roll.types";

interface DieProps {
  die: VisualDie;
  side: "attacker" | "defender";
  successThreshold: number;
  onAnimationComplete?: () => void;
}

// Faces do dado em emoji/unicode
const DIE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};

export function Die({
  die,
  side,
  successThreshold: _successThreshold,
  onAnimationComplete,
}: DieProps) {
  const [currentState, setCurrentState] = useState<DieVisualState>("rolling");
  const [showValue, setShowValue] = useState(false);

  const isAttacker = side === "attacker";

  useEffect(() => {
    // Sequência de animação
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Delay inicial
    timers.push(
      setTimeout(() => {
        setCurrentState("rolling");
      }, die.animationDelay)
    );

    // Settling
    timers.push(
      setTimeout(() => {
        setCurrentState("settling");
        setShowValue(true);
      }, die.animationDelay + 800)
    );

    // Final ou Exploding
    timers.push(
      setTimeout(() => {
        if (die.isExploded) {
          setCurrentState("exploding");
        } else {
          setCurrentState("final");
          onAnimationComplete?.();
        }
      }, die.animationDelay + 1100)
    );

    // Se explodiu, marcar como final após explosão
    if (die.isExploded) {
      timers.push(
        setTimeout(() => {
          setCurrentState("final");
          onAnimationComplete?.();
        }, die.animationDelay + 1700)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [die, onAnimationComplete]);

  // Classes de animação
  const getAnimationClass = () => {
    switch (currentState) {
      case "rolling":
        return "dice-rolling";
      case "settling":
        return "dice-settling";
      case "exploding":
        return "dice-exploding";
      case "spawning":
        return "dice-spawning";
      default:
        return "";
    }
  };

  // Classes de resultado
  const getResultClass = () => {
    if (!showValue) return "";
    if (die.isSuccess) return "dice-success";
    return "dice-failure";
  };

  // Cor do brilho
  const getGlowStyle = () => {
    if (!showValue || !die.isSuccess) return {};

    if (die.isExploded) {
      return {
        "--glow-color": "#fbbf24", // Dourado para explosão
        boxShadow: "0 0 30px 10px rgba(251, 191, 36, 0.7)",
      } as React.CSSProperties;
    }

    return {
      "--glow-color": isAttacker ? "#3b82f6" : "#ef4444",
    } as React.CSSProperties;
  };

  return (
    <div
      className={`relative ${isAttacker ? "attacker-side" : "defender-side"}`}
    >
      {/* Dado principal */}
      <div
        className={`
          relative w-14 h-14 flex items-center justify-center
          rounded-lg text-4xl font-bold
          transition-all duration-300
          ${getAnimationClass()}
          ${getResultClass()}
          ${showValue && die.isSuccess ? "bg-slate-800" : "bg-slate-700"}
          ${showValue && !die.isSuccess ? "opacity-40 grayscale" : ""}
        `}
        style={{
          ...getGlowStyle(),
          animationDelay: `${die.animationDelay}ms`,
        }}
      >
        {/* Valor do dado */}
        <span
          className={`
            transition-all duration-200
            ${showValue ? "opacity-100 scale-100" : "opacity-0 scale-50"}
            ${die.isExploded && showValue ? "text-yellow-400" : ""}
            ${
              die.isSuccess && !die.isExploded && showValue
                ? isAttacker
                  ? "text-blue-400"
                  : "text-red-400"
                : ""
            }
            ${!die.isSuccess && showValue ? "text-gray-500" : ""}
          `}
        >
          {showValue ? DIE_FACES[die.value] || die.value : "?"}
        </span>

        {/* Anel de explosão */}
        {currentState === "exploding" && (
          <div
            className="absolute inset-0 rounded-lg border-4 border-yellow-400 pointer-events-none"
            style={{
              animation: "explosionRing 0.6s ease-out forwards",
            }}
          />
        )}
      </div>

      {/* Indicador de explosão */}
      {die.isExploded && showValue && (
        <div className="absolute -top-2 -right-2 text-lg animate-bounce">
          💥
        </div>
      )}
    </div>
  );
}

export default Die;
