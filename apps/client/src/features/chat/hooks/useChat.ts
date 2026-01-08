// client/src/features/chat/hooks/useChat.ts
// Hook para acessar a store de chat via Zustand

import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../../../stores";

/**
 * Hook principal para gerenciamento de chat
 */
export function useChat() {
  const state = useChatStore(
    useShallow((s) => ({
      messages: s.messages,
      activeBubbles: s.activeBubbles,
      isOpen: s.isOpen,
      isLoading: s.isLoading,
      error: s.error,
      currentContext: s.context,
      currentContextId: s.contextId,
    }))
  );

  const sendMessage = useChatStore((s) => s.sendMessage);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const toggleChat = useChatStore((s) => s.toggleChat);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const getBubbleForUnit = useChatStore((s) => s.getBubbleForUnit);
  const setContext = useChatStore((s) => s.setContext);

  return {
    state,
    sendMessage,
    openChat,
    closeChat,
    toggleChat,
    loadHistory,
    getBubbleForUnit,
    setContext,
  };
}

/**
 * Hook para acessar apenas as mensagens
 */
export function useChatMessages() {
  return useChatStore((s) => s.messages);
}

/**
 * Hook para acessar apenas os bubbles
 */
export function useChatBubbles() {
  return useChatStore((s) => s.activeBubbles);
}

/**
 * Hook para enviar mensagens
 */
export function useSendMessage() {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isLoading = useChatStore((s) => s.isLoading);

  return { sendMessage, isLoading };
}
