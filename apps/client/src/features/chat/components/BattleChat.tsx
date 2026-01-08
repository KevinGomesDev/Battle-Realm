// client/src/features/chat/components/BattleChat.tsx
// Chat para batalha - abre com Enter, exibe balões sobre unidades

import React, { useEffect } from "react";
import { useChatStore } from "../../../stores";
import { useChat } from "../hooks/useChat";
import { ChatBox } from "./ChatBox";
import { BattleBubbles } from "./BattleBubbles";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { useEnterKey } from "../../../hooks/useHotkey";

interface BattleChatProps {
  battleId: string;
  currentUnitId?: string;
  /** ID da unidade atualmente selecionada (para comandos) */
  selectedUnitId?: string;
  units?: BattleUnit[];
  currentUserId?: string;
}

export const BattleChat: React.FC<BattleChatProps> = ({
  battleId,
  currentUnitId,
  selectedUnitId,
  units = [],
  currentUserId = "",
}) => {
  const isOpen = useChatStore((s) => s.isOpen);
  const activeBubbles = useChatStore((s) => s.activeBubbles);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const toggleChat = useChatStore((s) => s.toggleChat);
  const setContext = useChatStore((s) => s.setContext);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const reset = useChatStore((s) => s.reset);

  // Define o contexto do chat como BATTLE
  useEffect(() => {
    setContext("BATTLE", battleId);
    loadHistory();
    return () => {
      reset();
    };
  }, [battleId, setContext, loadHistory, reset]);

  // Toggle chat com Enter usando react-hotkeys-hook
  useEnterKey(toggleChat, {
    enabled: !isOpen,
    ignoreInputs: true,
  });

  if (!isOpen) {
    // Indicador sutil de que o chat existe + Balões de fala
    return (
      <>
        {/* Balões de fala das unidades */}
        <BattleBubbles
          units={units}
          currentUserId={currentUserId}
          activeBubbles={activeBubbles}
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
        activeBubbles={activeBubbles}
      />

      <div className="fixed bottom-4 right-4 z-40 w-72">
        <ChatBox
          currentUnitId={currentUnitId}
          selectedUnitId={selectedUnitId}
          variant="compact"
          placeholder="Mensagem ou /comando..."
          maxHeight="150px"
          title="Chat de Batalha"
          onClose={closeChat}
          enableCommands={true}
        />
      </div>
    </>
  );
};

// Hook para acessar balões de dentro do BattleCanvas
export const useBattleChat = useChat;
