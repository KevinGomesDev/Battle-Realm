// client/src/features/arena/components/ChallengeCard.tsx
// Card para exibir um desafio

import React, { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import type { Challenge } from "@boundless/shared/types/arena.types";

interface ChallengeCardProps {
  challenge: Challenge;
  variant: "incoming" | "outgoing" | "open";
  selectedKingdomId?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onJoin?: () => void;
  isLoading?: boolean;
}

/**
 * Card que exibe um desafio (recebido, enviado ou aberto)
 */
export const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  variant,
  selectedKingdomId,
  onAccept,
  onDecline,
  onCancel,
  onJoin,
  isLoading,
}) => {
  // Usar state para o tempo atual para permitir atualizações
  const [now, setNow] = useState(() => Date.now());

  // Atualizar o tempo a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLeft = Math.max(0, Math.floor((challenge.expiresAt - now) / 1000));
  const isExpiringSoon = timeLeft < 10;

  const formatTimeLeft = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  const formatPower = (power: number): string => {
    if (power >= 1000) {
      return `${(power / 1000).toFixed(1)}k`;
    }
    return power.toString();
  };

  return (
    <div
      className={`
        p-4 rounded-xl border-2 transition-all duration-300
        ${
          variant === "incoming"
            ? "border-stellar-amber bg-stellar-deep/30 animate-pulse-subtle"
            : variant === "outgoing"
            ? "border-mystic-purple bg-mystic-deep/20"
            : "border-surface-500 bg-surface-800/50 hover:border-surface-400"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {variant === "incoming"
              ? "⚔️"
              : variant === "outgoing"
              ? "📤"
              : "🏟️"}
          </span>
          <div>
            <p className="text-xs text-astral-steel uppercase tracking-wider">
              {variant === "incoming"
                ? "Desafio Recebido"
                : variant === "outgoing"
                ? "Seu Desafio"
                : "Desafio Aberto"}
            </p>
            <p
              className="text-astral-chrome font-bold"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {challenge.challenger.kingdomName}
            </p>
          </div>
        </div>

        {/* Timer */}
        <div
          className={`
            px-2 py-1 rounded-lg text-xs font-mono font-bold
            ${
              isExpiringSoon
                ? "bg-red-900/50 text-red-400 animate-pulse"
                : "bg-surface-700 text-astral-silver"
            }
          `}
        >
          ⏱️ {formatTimeLeft(timeLeft)}
        </div>
      </div>

      {/* Challenger Info */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <p className="text-sm text-astral-steel">Desafiante</p>
          <p className="text-astral-chrome">{challenge.challenger.username}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-astral-silver">
            <span>⚡ {formatPower(challenge.challenger.power)}</span>
            <span>•</span>
            <span>👥 {challenge.challenger.unitCount} unidades</span>
          </div>
        </div>

        {/* VS */}
        <div className="text-2xl text-stellar-amber font-bold">VS</div>

        {/* Challenged Info */}
        <div className="flex-1 text-right">
          {challenge.challenged ? (
            <>
              <p className="text-sm text-astral-steel">Desafiado</p>
              <p className="text-astral-chrome">
                {challenge.challenged.username}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-astral-silver justify-end">
                <span>⚡ {formatPower(challenge.challenged.power)}</span>
                <span>•</span>
                <span>👥 {challenge.challenged.unitCount} unidades</span>
              </div>
            </>
          ) : (
            <p className="text-astral-steel italic">Qualquer desafiante</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {variant === "incoming" && (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={onAccept}
              disabled={!selectedKingdomId || isLoading}
              isLoading={isLoading}
              className="flex-1"
            >
              ✅ Aceitar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onDecline}
              disabled={isLoading}
              className="flex-1"
            >
              ❌ Recusar
            </Button>
          </>
        )}

        {variant === "outgoing" && (
          <Button
            variant="danger"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            🚫 Cancelar
          </Button>
        )}

        {variant === "open" && (
          <Button
            variant="mystic"
            size="sm"
            onClick={onJoin}
            disabled={!selectedKingdomId || isLoading}
            isLoading={isLoading}
            className="flex-1"
          >
            ⚔️ Aceitar Desafio
          </Button>
        )}
      </div>
    </div>
  );
};
