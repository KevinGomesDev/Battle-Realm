// client/src/features/chat/context/ChatContext.tsx
// Contexto para gerenciamento de chat

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { socketService } from "../../../services/socket.service";
import type {
  ChatMessage,
  ChatContext as ChatContextType,
  SendChatPayload,
} from "../../../../../shared/types/chat.types";
import { CHAT_CONFIG } from "../../../../../shared/types/chat.types";

// =============================================================================
// STATE
// =============================================================================

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  // Para batalha: balões de fala ativos (unitId -> mensagem)
  activeBubbles: Map<string, { message: string; expiresAt: number }>;
}

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "SET_OPEN"; payload: boolean }
  | { type: "TOGGLE_OPEN" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | {
      type: "ADD_BUBBLE";
      payload: { unitId: string; message: string; expiresAt: number };
    }
  | { type: "REMOVE_BUBBLE"; payload: string }
  | { type: "CLEAR_EXPIRED_BUBBLES" };

const initialState: ChatState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  error: null,
  activeBubbles: new Map(),
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      const newMessages = [...state.messages, action.payload];
      // Limitar tamanho
      while (newMessages.length > CHAT_CONFIG.maxMessages) {
        newMessages.shift();
      }
      return { ...state, messages: newMessages };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_OPEN":
      return { ...state, isOpen: action.payload };
    case "TOGGLE_OPEN":
      return { ...state, isOpen: !state.isOpen };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "ADD_BUBBLE":
      const newBubbles = new Map(state.activeBubbles);
      newBubbles.set(action.payload.unitId, {
        message: action.payload.message,
        expiresAt: action.payload.expiresAt,
      });
      return { ...state, activeBubbles: newBubbles };
    case "REMOVE_BUBBLE":
      const bubbles = new Map(state.activeBubbles);
      bubbles.delete(action.payload);
      return { ...state, activeBubbles: bubbles };
    case "CLEAR_EXPIRED_BUBBLES":
      const now = Date.now();
      const filtered = new Map(state.activeBubbles);
      for (const [unitId, bubble] of filtered) {
        if (bubble.expiresAt <= now) {
          filtered.delete(unitId);
        }
      }
      return { ...state, activeBubbles: filtered };
    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

interface ChatContextValue {
  state: ChatState;
  sendMessage: (message: string, unitId?: string) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  loadHistory: () => Promise<void>;
  getBubbleForUnit: (unitId: string) => string | null;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface ChatProviderProps {
  children: React.ReactNode;
  context: ChatContextType;
  contextId?: string;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  context,
  contextId,
}) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const bubbleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listener para novas mensagens
  useEffect(() => {
    const handleMessage = (data: { message: ChatMessage }) => {
      // Verificar se a mensagem é para este contexto
      if (data.message.context !== context) return;
      if (context !== "GLOBAL" && data.message.contextId !== contextId) return;

      dispatch({ type: "ADD_MESSAGE", payload: data.message });

      // Se tiver unitId (batalha), adicionar balão
      if (data.message.unitId) {
        dispatch({
          type: "ADD_BUBBLE",
          payload: {
            unitId: data.message.unitId,
            message: data.message.message,
            expiresAt: Date.now() + CHAT_CONFIG.bubbleDuration,
          },
        });
      }
    };

    socketService.on("chat:message", handleMessage);

    return () => {
      socketService.off("chat:message", handleMessage);
    };
  }, [context, contextId]);

  // Limpeza de balões expirados
  useEffect(() => {
    bubbleCleanupRef.current = setInterval(() => {
      dispatch({ type: "CLEAR_EXPIRED_BUBBLES" });
    }, 1000);

    return () => {
      if (bubbleCleanupRef.current) {
        clearInterval(bubbleCleanupRef.current);
      }
    };
  }, []);

  // Carregar histórico ao montar
  useEffect(() => {
    loadHistory();
  }, [context, contextId]);

  const sendMessage = useCallback(
    async (message: string, unitId?: string): Promise<void> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const payload: SendChatPayload = {
          context,
          contextId,
          message,
          unitId,
        };

        const response = await socketService.emitAsync<{
          success: boolean;
          error?: string;
        }>("chat:send", payload);

        if (!response.success) {
          throw new Error(response.error || "Erro ao enviar mensagem");
        }

        dispatch({ type: "SET_LOADING", payload: false });
      } catch (error: any) {
        dispatch({ type: "SET_ERROR", payload: error.message });
        dispatch({ type: "SET_LOADING", payload: false });
        throw error;
      }
    },
    [context, contextId]
  );

  const loadHistory = useCallback(async (): Promise<void> => {
    try {
      const response = await socketService.emitAsync<{
        success: boolean;
        messages?: ChatMessage[];
      }>("chat:load_history", { context, contextId });

      if (response.success) {
        dispatch({
          type: "SET_MESSAGES",
          payload: response.messages || [],
        });
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  }, [context, contextId]);

  const openChat = useCallback(() => {
    dispatch({ type: "SET_OPEN", payload: true });
  }, []);

  const closeChat = useCallback(() => {
    dispatch({ type: "SET_OPEN", payload: false });
  }, []);

  const toggleChat = useCallback(() => {
    dispatch({ type: "TOGGLE_OPEN" });
  }, []);

  const getBubbleForUnit = useCallback(
    (unitId: string): string | null => {
      const bubble = state.activeBubbles.get(unitId);
      if (bubble && bubble.expiresAt > Date.now()) {
        return bubble.message;
      }
      return null;
    },
    [state.activeBubbles]
  );

  const value: ChatContextValue = {
    state,
    sendMessage,
    openChat,
    closeChat,
    toggleChat,
    loadHistory,
    getBubbleForUnit,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// =============================================================================
// HOOK
// =============================================================================

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat deve ser usado dentro de um ChatProvider");
  }
  return context;
}
