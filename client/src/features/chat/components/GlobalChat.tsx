// client/src/features/chat/components/GlobalChat.tsx
// Chat global para Dashboard

import React from "react";
import { ChatProvider, useChat } from "../context/ChatContext";
import { ChatBox } from "./ChatBox";

const GlobalChatInner: React.FC = () => {
  const { state, openChat, closeChat } = useChat();

  if (!state.isOpen) {
    return (
      <button
        onClick={openChat}
        className="
          w-full flex items-center justify-center gap-2
          px-4 py-3
          bg-citadel-slate/30 border border-metal-iron/30 rounded-lg
          text-parchment-dark hover:text-parchment-light
          hover:border-metal-bronze/50 hover:bg-citadel-slate/50
          transition-all text-sm
        "
      >
        <span>💬</span>
        <span>Abrir Chat Global</span>
      </button>
    );
  }

  return (
    <ChatBox
      variant="full"
      placeholder="Mensagem para todos..."
      maxHeight="250px"
      title="Chat Global"
      onClose={closeChat}
    />
  );
};

export const GlobalChat: React.FC = () => {
  return (
    <ChatProvider context="GLOBAL">
      <GlobalChatInner />
    </ChatProvider>
  );
};
