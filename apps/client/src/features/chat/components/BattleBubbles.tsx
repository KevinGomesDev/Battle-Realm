// client/src/features/chat/components/BattleBubbles.tsx
// Overlay de balões de fala - exibe mensagens como notificações flutuantes
// Simplificado: não tenta seguir unidades no canvas, mas mostra nome da unidade

import React, { useMemo, useEffect, useState } from "react";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

interface ActiveBubble {
  message: string;
  expiresAt: number;
}

interface BattleBubblesProps {
  units: BattleUnit[];
  currentUserId: string;
  /** Map de unitId -> mensagem ativa */
  activeBubbles: Map<string, ActiveBubble>;
}

interface DisplayBubble {
  unitId: string;
  unitName: string;
  message: string;
  isOwned: boolean;
  expiresAt: number;
}

export const BattleBubbles: React.FC<BattleBubblesProps> = ({
  units,
  currentUserId,
  activeBubbles,
}) => {
  const [, forceUpdate] = useState(0);

  // Re-render a cada segundo para remover bubbles expirados
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const bubbleElements = useMemo(() => {
    const elements: DisplayBubble[] = [];
    const now = Date.now();

    activeBubbles.forEach((bubble, unitId) => {
      if (bubble.expiresAt <= now) return;

      const unit = units.find((u) => u.id === unitId);
      if (!unit) return;

      elements.push({
        unitId,
        unitName: unit.name || "Unidade",
        message: bubble.message,
        isOwned: unit.ownerId === currentUserId,
        expiresAt: bubble.expiresAt,
      });
    });

    // Ordenar por expiração (mais recentes primeiro)
    return elements.sort((a, b) => b.expiresAt - a.expiresAt);
  }, [units, activeBubbles, currentUserId]);

  if (bubbleElements.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {bubbleElements.map((bubble) => (
        <div
          key={`bubble-${bubble.unitId}-${bubble.expiresAt}`}
          className={`
            px-4 py-2 rounded-lg shadow-lg 
            animate-in fade-in slide-in-from-top-4 duration-300
            max-w-md text-center
            ${
              bubble.isOwned
                ? "bg-gradient-to-r from-stellar-gold/90 to-stellar-amber/90 text-surface-900"
                : "bg-gradient-to-r from-red-700/90 to-red-900/90 text-astral-chrome"
            }
          `}
        >
          <span className="font-bold text-xs uppercase tracking-wide opacity-75">
            {bubble.unitName}:
          </span>{" "}
          <span className="text-sm">{bubble.message}</span>
        </div>
      ))}
    </div>
  );
};
