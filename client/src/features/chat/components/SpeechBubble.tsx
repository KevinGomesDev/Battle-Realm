// client/src/features/chat/components/SpeechBubble.tsx
// Balão de fala para unidades em batalha

import React from "react";

interface SpeechBubbleProps {
  message: string;
  /** Posição em pixels */
  x: number;
  y: number;
  /** Se é unidade própria ou inimiga */
  isOwned?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  message,
  x,
  y,
  isOwned = true,
}) => {
  // Limitar tamanho da mensagem para exibição
  const displayMessage =
    message.length > 50 ? message.substring(0, 47) + "..." : message;

  return (
    <div
      className="absolute pointer-events-none z-50 animate-fade-in"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
      }}
    >
      {/* Balão */}
      <div
        className={`
          relative px-2 py-1 rounded-lg
          max-w-[150px] text-center
          shadow-lg
          ${
            isOwned
              ? "bg-stellar-gold/90 border border-stellar-amber"
              : "bg-red-800/90 border border-red-500"
          }
        `}
      >
        <p
          className={`
            text-xs font-medium break-words
            ${isOwned ? "text-surface-900" : "text-astral-chrome"}
          `}
        >
          {displayMessage}
        </p>

        {/* Triângulo apontando para baixo */}
        <div
          className={`
            absolute left-1/2 -translate-x-1/2 top-full
            w-0 h-0
            border-l-4 border-r-4 border-t-4
            border-l-transparent border-r-transparent
            ${isOwned ? "border-t-stellar-gold/90" : "border-t-red-800/90"}
          `}
        />
      </div>
    </div>
  );
};
