// client/src/features/chat/components/BattleChat.tsx
// Chat para batalha - abre com Enter, exibe balões sobre unidades

import React, { useEffect, useCallback } from "react";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ChatBox } from "./ChatBox";
import { BattleBubbles } from "./BattleBubbles";
import type { BattleUnit } from "../../../../../shared/types/battle.types";

interface BattleChatInnerProps {
  currentUnitId?: string;
  units?: BattleUnit[];
  currentUserId?: string;
}

const BattleChatInner: React.FC<BattleChatInnerProps> = ({
  currentUnitId,
  units = [],
  currentUserId = "",
}) => {
  const { state, openChat, closeChat, toggleChat } = useChat();

  // Handler para tecla Enter
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignorar se estiver em um input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        toggleChat();
      }
    },
    [toggleChat]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!state.isOpen) {
    // Indicador sutil de que o chat existe + Balões de fala
    return (
      <>
        {/* Balões de fala das unidades */}
        <BattleBubbles
          units={units}
          currentUserId={currentUserId}
          activeBubbles={state.activeBubbles}
        />

        <div className="fixed bottom-4 right-4 z-40">
          <button
            onClick={openChat}
            className="
              flex items-center gap-2 px-3 py-1.5
              bg-surface-900/80 backdrop-blur-sm
              border border-surface-500/30 rounded-lg
              text-astral-steel hover:text-astral-chrome
              hover:border-stellar-amber/50
              transition-all text-xs
            "
            title="Pressione Enter para abrir o chat"
          >
            <span>💬</span>
            <span className="hidden sm:inline">Enter para chat</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Balões de fala das unidades */}
      <BattleBubbles
        units={units}
        currentUserId={currentUserId}
        activeBubbles={state.activeBubbles}
      />

      <div className="fixed bottom-4 right-4 z-40 w-72">
        <ChatBox
          currentUnitId={currentUnitId}
          variant="compact"
          placeholder="Mensagem... (Enter para enviar)"
          maxHeight="150px"
          title="Chat de Batalha"
          onClose={closeChat}
        />
      </div>
    </>
  );
};

// Componente wrapper com Provider
interface BattleChatProps {
  battleId: string;
  currentUnitId?: string;
  units?: BattleUnit[];
  currentUserId?: string;
}

export const BattleChat: React.FC<BattleChatProps> = ({
  battleId,
  currentUnitId,
  units = [],
  currentUserId = "",
}) => {
  return (
    <ChatProvider context="BATTLE" contextId={battleId}>
      <BattleChatInner
        currentUnitId={currentUnitId}
        units={units}
        currentUserId={currentUserId}
      />
    </ChatProvider>
  );
};

// Hook para acessar balões de dentro do ArenaBattleCanvas
// (precisa ser usado dentro de ChatProvider)
export { useChat as useBattleChat };
