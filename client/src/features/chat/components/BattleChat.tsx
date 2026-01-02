// client/src/features/chat/components/BattleChat.tsx
// Chat para batalha - abre com Enter, exibe balões sobre unidades

import React, { useEffect, useCallback } from "react";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ChatBox } from "./ChatBox";
import { BattleBubbles } from "./BattleBubbles";
import type { ArenaUnit } from "../../arena/types/arena.types";

interface BattleChatInnerProps {
  currentUnitId?: string;
  units?: ArenaUnit[];
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

        <div className="fixed bottom-4 left-4 z-40">
          <button
            onClick={openChat}
            className="
              flex items-center gap-2 px-3 py-1.5
              bg-citadel-obsidian/80 backdrop-blur-sm
              border border-metal-iron/30 rounded-lg
              text-parchment-dark hover:text-parchment-light
              hover:border-metal-bronze/50
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

      <div className="fixed bottom-4 left-4 z-40 w-72">
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
  units?: ArenaUnit[];
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
