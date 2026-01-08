// client/src/features/chat/components/GlobalChat.tsx
// Chat global para Dashboard

import React, { useEffect } from "react";
import { useChatStore } from "../../../stores";
import { ChatBox } from "./ChatBox";

export const GlobalChat: React.FC = () => {
  const isOpen = useChatStore((s) => s.isOpen);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const setContext = useChatStore((s) => s.setContext);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const reset = useChatStore((s) => s.reset);

  // Define o contexto do chat como GLOBAL
  useEffect(() => {
    setContext("GLOBAL");
    loadHistory();
    return () => {
      reset();
    };
  }, [setContext, loadHistory, reset]);

  if (!isOpen) {
    return (
      <button
        onClick={openChat}
        className="
          w-full flex items-center justify-center gap-2
          px-4 py-3
          bg-surface-800/30 border border-surface-500/30 rounded-lg
          text-astral-steel hover:text-astral-chrome
          hover:border-stellar-amber/50 hover:bg-surface-800/50
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
      showHeader={false}
      onClose={closeChat}
    />
  );
};
