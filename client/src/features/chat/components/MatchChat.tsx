// client/src/features/chat/components/MatchChat.tsx
// Chat para partidas normais

import React from "react";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ChatBox } from "./ChatBox";

const MatchChatInner: React.FC = () => {
  const { state, openChat, closeChat } = useChat();

  if (!state.isOpen) {
    return (
      <button
        onClick={openChat}
        className="
          flex items-center gap-2 px-3 py-2
          bg-citadel-obsidian/80 backdrop-blur-sm
          border border-metal-iron/30 rounded-lg
          text-parchment-dark hover:text-parchment-light
          hover:border-metal-bronze/50
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

interface MatchChatProps {
  matchId: string;
}

export const MatchChat: React.FC<MatchChatProps> = ({ matchId }) => {
  return (
    <ChatProvider context="MATCH" contextId={matchId}>
      <MatchChatInner />
    </ChatProvider>
  );
};
