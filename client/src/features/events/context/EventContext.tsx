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
import { socketService } from "../../../services/socket.service";
import type {
  GameEvent,
  EventContext as EventContextType,
  EventFilter,
} from "../../../../../shared/types/events.types";

// =============================================================================
// TYPES
// =============================================================================

interface EventState {
  events: GameEvent[];
  isLoading: boolean;
  currentContext: EventContextType | null;
  currentContextId: string | null;
  maxEvents: number;
}

type EventAction =
  | { type: "ADD_EVENT"; payload: GameEvent }
  | { type: "SET_EVENTS"; payload: GameEvent[] }
  | { type: "CLEAR_EVENTS" }
  | { type: "SET_LOADING"; payload: boolean }
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
  clearEvents: () => void;
}

// =============================================================================
// REDUCER
// =============================================================================

const initialState: EventState = {
  events: [],
  isLoading: false,
  currentContext: null,
  currentContextId: null,
  maxEvents: 100,
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
      return { ...state, events: action.payload.slice(0, state.maxEvents) };

    case "CLEAR_EVENTS":
      return { ...state, events: [] };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

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
}

export function EventProvider({
  children,
  maxEvents = 100,
}: EventProviderProps) {
  const [state, dispatch] = useReducer(eventReducer, {
    ...initialState,
    maxEvents,
  });

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
      dispatch({ type: "ADD_EVENT", payload: eventWithDate });
    };

    socketService.on("event:new", handleNewEvent);

    return () => {
      socketService.off("event:new", handleNewEvent);
    };
  }, []);

  // Inscrever em contexto de eventos
  const subscribeToContext = useCallback(
    (context: EventContextType, contextId?: string) => {
      socketService.emit("event:subscribe", { context, contextId });
      dispatch({ type: "SET_CONTEXT", payload: { context, contextId } });
      dispatch({ type: "CLEAR_EVENTS" });
    },
    []
  );

  // Cancelar inscrição
  const unsubscribeFromContext = useCallback(
    (context: EventContextType, contextId?: string) => {
      socketService.emit("event:unsubscribe", { context, contextId });
    },
    []
  );

  // Buscar histórico de eventos
  const fetchHistory = useCallback(async (filter?: EventFilter) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await socketService.emitAsync<{
        success: boolean;
        events: GameEvent[];
      }>("event:fetch", { filter: filter || {} });

      if (response.success && response.events) {
        const eventsWithDates = response.events.map((e) => ({
          ...e,
          timestamp:
            typeof e.timestamp === "string"
              ? new Date(e.timestamp)
              : e.timestamp,
        }));
        dispatch({ type: "SET_EVENTS", payload: eventsWithDates });
      }
    } catch (error) {
      console.error("[EventContext] Failed to fetch history:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // Limpar eventos
  const clearEvents = useCallback(() => {
    dispatch({ type: "CLEAR_EVENTS" });
  }, []);

  const value: EventContextValue = {
    state,
    subscribeToContext,
    unsubscribeFromContext,
    fetchHistory,
    clearEvents,
  };

  return (
    <EventContext.Provider value={value}>{children}</EventContext.Provider>
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
