// client/src/features/events/context/EventContext.tsx
// Contexto para gerenciamento de eventos do jogo

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { colyseusService } from "../../../services/colyseus.service";
import type {
  GameEvent,
  EventContext as EventContextType,
  EventFilter,
} from "@boundless/shared/types/events.types";
import {
  EventToastContainer,
  type EventToastData,
} from "../components/EventToast";

// =============================================================================
// TYPES
// =============================================================================

interface EventState {
  events: GameEvent[];
  toasts: EventToastData[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isHistoryOpen: boolean;
  currentContext: EventContextType | null;
  currentContextId: string | null;
  maxEvents: number;
  /** Cursor para próxima página */
  nextCursor: string | null;
  /** Se há mais eventos para carregar */
  hasMore: boolean;
}

type EventAction =
  | { type: "ADD_EVENT"; payload: GameEvent }
  | {
      type: "SET_EVENTS";
      payload: { events: GameEvent[]; nextCursor?: string; hasMore: boolean };
    }
  | {
      type: "APPEND_EVENTS";
      payload: { events: GameEvent[]; nextCursor?: string; hasMore: boolean };
    }
  | { type: "CLEAR_EVENTS" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LOADING_MORE"; payload: boolean }
  | { type: "SET_HISTORY_OPEN"; payload: boolean }
  | { type: "ADD_TOAST"; payload: EventToastData }
  | { type: "REMOVE_TOAST"; payload: string }
  | {
      type: "SET_CONTEXT";
      payload: { context: EventContextType; contextId?: string };
    };

interface EventContextValue {
  state: EventState;
  subscribeToContext: (context: EventContextType, contextId?: string) => void;
  unsubscribeFromContext: (
    context: EventContextType,
    contextId?: string
  ) => void;
  fetchHistory: (filter?: EventFilter) => Promise<void>;
  /** Carrega mais eventos (paginação) */
  loadMore: () => Promise<void>;
  clearEvents: () => void;
  showToast: (event: GameEvent) => void;
  dismissToast: (id: string) => void;
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
}

// =============================================================================
// REDUCER
// =============================================================================

const initialState: EventState = {
  events: [],
  toasts: [],
  isLoading: false,
  isLoadingMore: false,
  isHistoryOpen: false,
  currentContext: null,
  currentContextId: null,
  maxEvents: 100,
  nextCursor: null,
  hasMore: false,
};

function eventReducer(state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case "ADD_EVENT":
      // Adicionar no início e limitar quantidade
      const newEvents = [action.payload, ...state.events].slice(
        0,
        state.maxEvents
      );
      return { ...state, events: newEvents };

    case "SET_EVENTS":
      return {
        ...state,
        events: action.payload.events.slice(0, state.maxEvents),
        nextCursor: action.payload.nextCursor || null,
        hasMore: action.payload.hasMore,
      };

    case "APPEND_EVENTS":
      // Adicionar ao final (para load more)
      const appendedEvents = [...state.events, ...action.payload.events];
      return {
        ...state,
        events: appendedEvents,
        nextCursor: action.payload.nextCursor || null,
        hasMore: action.payload.hasMore,
      };

    case "CLEAR_EVENTS":
      return { ...state, events: [], nextCursor: null, hasMore: false };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_LOADING_MORE":
      return { ...state, isLoadingMore: action.payload };

    case "SET_HISTORY_OPEN":
      return { ...state, isHistoryOpen: action.payload };

    case "ADD_TOAST":
      // Limitar a 5 toasts simultâneos
      const newToasts = [action.payload, ...state.toasts].slice(0, 5);
      return { ...state, toasts: newToasts };

    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case "SET_CONTEXT":
      return {
        ...state,
        currentContext: action.payload.context,
        currentContextId: action.payload.contextId || null,
      };

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const EventContext = createContext<EventContextValue | null>(null);

interface EventProviderProps {
  children: ReactNode;
  maxEvents?: number;
  toastDuration?: number;
  toastPosition?: "top-center" | "top-right" | "bottom-center" | "bottom-right";
}

export function EventProvider({
  children,
  maxEvents = 100,
  toastDuration = 3000,
  toastPosition = "top-center",
}: EventProviderProps) {
  const [state, dispatch] = useReducer(eventReducer, {
    ...initialState,
    maxEvents,
  });

  // Função para mostrar toast
  const showToast = useCallback((event: GameEvent) => {
    const toastData: EventToastData = {
      id: `toast-${event.id}-${Date.now()}`,
      event,
      createdAt: Date.now(),
    };
    dispatch({ type: "ADD_TOAST", payload: toastData });
  }, []);

  // Função para remover toast
  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE_TOAST", payload: id });
  }, []);

  // Listener para novos eventos
  useEffect(() => {
    const handleNewEvent = (event: GameEvent) => {
      // Converter timestamp string para Date se necessário
      const eventWithDate = {
        ...event,
        timestamp:
          typeof event.timestamp === "string"
            ? new Date(event.timestamp)
            : event.timestamp,
      };

      // Adicionar ao histórico
      dispatch({ type: "ADD_EVENT", payload: eventWithDate });

      // Mostrar toast se não for evento de baixa importância
      if (event.severity !== "INFO" || event.category === "COMBAT") {
        showToast(eventWithDate);
      }
    };

    colyseusService.on("event:new", handleNewEvent);

    return () => {
      colyseusService.off("event:new", handleNewEvent);
    };
  }, [showToast]);

  // Inscrever em contexto de eventos
  const subscribeToContext = useCallback(
    (context: EventContextType, contextId?: string) => {
      colyseusService.sendToGlobal("event:subscribe", { context, contextId });
      dispatch({ type: "SET_CONTEXT", payload: { context, contextId } });
      dispatch({ type: "CLEAR_EVENTS" });
    },
    []
  );

  // Cancelar inscrição
  const unsubscribeFromContext = useCallback(
    (context: EventContextType, contextId?: string) => {
      colyseusService.sendToGlobal("event:unsubscribe", { context, contextId });
    },
    []
  );

  // Buscar histórico de eventos (primeira página)
  const fetchHistory = useCallback(async (filter?: EventFilter) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await colyseusService.sendAndWait<{
        success: boolean;
        events: GameEvent[];
        nextCursor?: string;
        hasMore: boolean;
      }>(
        "event:fetch",
        { filter: { ...filter, limit: 50 } },
        "event:fetch:response"
      );

      if (response.success && response.events) {
        const eventsWithDates = response.events.map((e) => ({
          ...e,
          timestamp:
            typeof e.timestamp === "string"
              ? new Date(e.timestamp)
              : e.timestamp,
        }));
        dispatch({
          type: "SET_EVENTS",
          payload: {
            events: eventsWithDates,
            nextCursor: response.nextCursor,
            hasMore: response.hasMore,
          },
        });
      }
    } catch (error) {
      console.error("[EventContext] Failed to fetch history:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Carregar mais eventos (paginação)
  const loadMore = useCallback(async () => {
    if (!state.hasMore || !state.nextCursor || state.isLoadingMore) return;

    dispatch({ type: "SET_LOADING_MORE", payload: true });
    try {
      const filter: EventFilter = {
        cursor: state.nextCursor,
        limit: 50,
      };

      // Manter contexto atual
      if (state.currentContext) {
        filter.context = state.currentContext;
      }

      const response = await colyseusService.sendAndWait<{
        success: boolean;
        events: GameEvent[];
        nextCursor?: string;
        hasMore: boolean;
      }>("event:fetch", { filter }, "event:fetch:response");

      if (response.success && response.events) {
        const eventsWithDates = response.events.map((e) => ({
          ...e,
          timestamp:
            typeof e.timestamp === "string"
              ? new Date(e.timestamp)
              : e.timestamp,
        }));
        dispatch({
          type: "APPEND_EVENTS",
          payload: {
            events: eventsWithDates,
            nextCursor: response.nextCursor,
            hasMore: response.hasMore,
          },
        });
      }
    } catch (error) {
      console.error("[EventContext] Failed to load more events:", error);
    } finally {
      dispatch({ type: "SET_LOADING_MORE", payload: false });
    }
  }, [
    state.hasMore,
    state.nextCursor,
    state.isLoadingMore,
    state.currentContext,
  ]);

  // Limpar eventos
  const clearEvents = useCallback(() => {
    dispatch({ type: "CLEAR_EVENTS" });
  }, []);

  // Controle do histórico
  const openHistory = useCallback(() => {
    dispatch({ type: "SET_HISTORY_OPEN", payload: true });
  }, []);

  const closeHistory = useCallback(() => {
    dispatch({ type: "SET_HISTORY_OPEN", payload: false });
  }, []);

  const toggleHistory = useCallback(() => {
    dispatch({ type: "SET_HISTORY_OPEN", payload: !state.isHistoryOpen });
  }, [state.isHistoryOpen]);

  const value: EventContextValue = {
    state,
    subscribeToContext,
    unsubscribeFromContext,
    fetchHistory,
    loadMore,
    clearEvents,
    showToast,
    dismissToast,
    openHistory,
    closeHistory,
    toggleHistory,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
      {/* Renderizar container de toasts */}
      <EventToastContainer
        toasts={state.toasts}
        onDismiss={dismissToast}
        duration={toastDuration}
        position={toastPosition}
      />
    </EventContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useEvents(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEvents must be used within an EventProvider");
  }
  return context;
}
