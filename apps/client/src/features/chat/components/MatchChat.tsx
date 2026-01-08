// client/src/features/chat/components/MatchChat.tsx
// Chat para partidas normais

import React, { useEffect } from "react";
import { useChatStore } from "../../../stores";
import { ChatBox } from "./ChatBox";

interface MatchChatProps {
  matchId: string;
}

export const MatchChat: React.FC<MatchChatProps> = ({ matchId }) => {
  const isOpen = useChatStore((s) => s.isOpen);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const setContext = useChatStore((s) => s.setContext);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const reset = useChatStore((s) => s.reset);

  // Define o contexto do chat como MATCH
  useEffect(() => {
    setContext("MATCH", matchId);
    loadHistory();
    return () => {
      reset();
    };
  }, [matchId, setContext, loadHistory, reset]);

  if (!isOpen) {
    return (
      <button
        onClick={openChat}
        className="
          flex items-center gap-2 px-3 py-2
          bg-surface-900/80 backdrop-blur-sm
          border border-surface-500/30 rounded-lg
          text-astral-steel hover:text-astral-chrome
          hover:border-stellar-amber/50
          transition-all text-sm
        "
        title="Abrir chat da partida"
      >
        <span>💬</span>
        <span>Chat</span>
      </button>
    );
  }

  return (
    <div className="w-80">
      <ChatBox
        variant="full"
        placeholder="Mensagem para a partida..."
        maxHeight="200px"
        title="Chat da Partida"
        onClose={closeChat}
      />
    </div>
  );
};
