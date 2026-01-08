// client/src/stores/chatStore.ts
// Store Zustand para chat

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type {
  ChatMessage,
  ChatContext,
  SendChatPayload,
} from "../../../shared/types/chat.types";
import { CHAT_CONFIG } from "../../../shared/types/chat.types";

interface ChatBubble {
  message: string;
  expiresAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  activeBubbles: Map<string, ChatBubble>;
  context: ChatContext | null;
  contextId: string | undefined;
}

interface ChatActions {
  sendMessage: (message: string, unitId?: string) => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  loadHistory: () => Promise<void>;
  getBubbleForUnit: (unitId: string) => string | null;
  setContext: (context: ChatContext, contextId?: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addBubble: (unitId: string, message: string, expiresAt: number) => void;
  removeBubble: (unitId: string) => void;
  clearExpiredBubbles: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initializeListeners: () => () => void;
}

const initialState: ChatState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  error: null,
  activeBubbles: new Map(),
  context: null,
  contextId: undefined,
};

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  ...initialState,

  setContext: (context, contextId) => set({ context, contextId }),

  addMessage: (message) =>
    set((state) => {
      const newMessages = [...state.messages, message];
      while (newMessages.length > CHAT_CONFIG.maxMessages) {
        newMessages.shift();
      }
      return { messages: newMessages };
    }),

  setMessages: (messages) => set({ messages }),

  addBubble: (unitId, message, expiresAt) =>
    set((state) => {
      const newBubbles = new Map(state.activeBubbles);
      newBubbles.set(unitId, { message, expiresAt });
      return { activeBubbles: newBubbles };
    }),

  removeBubble: (unitId) =>
    set((state) => {
      const newBubbles = new Map(state.activeBubbles);
      newBubbles.delete(unitId);
      return { activeBubbles: newBubbles };
    }),

  clearExpiredBubbles: () =>
    set((state) => {
      const now = Date.now();
      const newBubbles = new Map(state.activeBubbles);
      for (const [unitId, bubble] of newBubbles) {
        if (bubble.expiresAt <= now) {
          newBubbles.delete(unitId);
        }
      }
      return { activeBubbles: newBubbles };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  openChat: () => set({ isOpen: true }),

  closeChat: () => set({ isOpen: false }),

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  getBubbleForUnit: (unitId) => {
    const bubble = get().activeBubbles.get(unitId);
    if (bubble && bubble.expiresAt > Date.now()) {
      return bubble.message;
    }
    return null;
  },

  loadHistory: async () => {
    const { context, contextId } = get();
    try {
      const response = await colyseusService.sendAndWait<{
        success: boolean;
        messages?: ChatMessage[];
      }>(
        "chat:load_history",
        { context, contextId },
        "chat:load_history:response"
      );

      if (response.success) {
        set({ messages: response.messages || [] });
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
  },

  sendMessage: async (message, unitId) => {
    const { context, contextId } = get();
    set({ isLoading: true, error: null });

    try {
      const payload: SendChatPayload = {
        context: context!,
        contextId,
        message,
        unitId,
      };

      const response = await colyseusService.sendAndWait<{
        success: boolean;
        error?: string;
      }>("chat:send", payload, "chat:send:response");

      if (!response.success) {
        throw new Error(response.error || "Erro ao enviar mensagem");
      }

      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  initializeListeners: () => {
    const { context, contextId } = get();

    const handleMessage = (data: { message: ChatMessage }) => {
      const state = get();
      if (data.message.context !== state.context) return;
      if (
        state.context !== "GLOBAL" &&
        data.message.contextId !== state.contextId
      )
        return;

      get().addMessage(data.message);

      if (data.message.unitId) {
        get().addBubble(
          data.message.unitId,
          data.message.message,
          Date.now() + CHAT_CONFIG.bubbleDuration
        );
      }
    };

    colyseusService.on("chat:message", handleMessage);

    // Setup bubble cleanup interval
    const bubbleCleanup = setInterval(() => {
      get().clearExpiredBubbles();
    }, 1000);

    return () => {
      colyseusService.off("chat:message", handleMessage);
      clearInterval(bubbleCleanup);
    };
  },
}));
