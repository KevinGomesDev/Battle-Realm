// client/src/stores/eventStore.ts
// Store Zustand para eventos do jogo

import { create } from "zustand";
import { colyseusService } from "../services/colyseus.service";
import type {
  GameEvent,
  EventContext,
  EventFilter,
} from "../../../shared/types/events.types";

export interface EventToastData {
  id: string;
  event: GameEvent;
  createdAt: number;
}

interface EventState {
  events: GameEvent[];
  toasts: EventToastData[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isHistoryOpen: boolean;
  currentContext: EventContext | null;
  currentContextId: string | null;
  maxEvents: number;
  nextCursor: string | null;
  hasMore: boolean;
}

interface EventActions {
  subscribeToContext: (context: EventContext, contextId?: string) => void;
  unsubscribeFromContext: (context: EventContext, contextId?: string) => void;
  fetchHistory: (filter?: EventFilter) => Promise<void>;
  loadMore: () => Promise<void>;
  clearEvents: () => void;
  showToast: (event: GameEvent) => void;
  dismissToast: (id: string) => void;
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
  addEvent: (event: GameEvent) => void;
  setEvents: (
    events: GameEvent[],
    nextCursor?: string,
    hasMore?: boolean
  ) => void;
  appendEvents: (
    events: GameEvent[],
    nextCursor?: string,
    hasMore?: boolean
  ) => void;
  addToast: (toast: EventToastData) => void;
  removeToast: (id: string) => void;
  setContext: (context: EventContext, contextId?: string) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setMaxEvents: (max: number) => void;
  reset: () => void;
  initializeListeners: () => () => void;
}

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

export const useEventStore = create<EventState & EventActions>((set, get) => ({
  ...initialState,

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, state.maxEvents),
    })),

  setEvents: (events, nextCursor, hasMore = false) =>
    set((state) => ({
      events: events.slice(0, state.maxEvents),
      nextCursor: nextCursor || null,
      hasMore,
    })),

  appendEvents: (events, nextCursor, hasMore = false) =>
    set((state) => ({
      events: [...state.events, ...events],
      nextCursor: nextCursor || null,
      hasMore,
    })),

  addToast: (toast) =>
    set((state) => ({
      toasts: [toast, ...state.toasts].slice(0, 5),
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  setContext: (context, contextId) =>
    set({
      currentContext: context,
      currentContextId: contextId || null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

  setMaxEvents: (maxEvents) => set({ maxEvents }),

  reset: () => set(initialState),

  clearEvents: () => set({ events: [], nextCursor: null, hasMore: false }),

  openHistory: () => set({ isHistoryOpen: true }),

  closeHistory: () => set({ isHistoryOpen: false }),

  toggleHistory: () =>
    set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),

  showToast: (event) => {
    const toastData: EventToastData = {
      id: `toast-${event.id}-${Date.now()}`,
      event,
      createdAt: Date.now(),
    };
    get().addToast(toastData);
  },

  dismissToast: (id) => {
    get().removeToast(id);
  },

  subscribeToContext: (context, contextId) => {
    colyseusService.sendToGlobal("event:subscribe", { context, contextId });
    set({
      currentContext: context,
      currentContextId: contextId || null,
      events: [],
      nextCursor: null,
      hasMore: false,
    });
  },

  unsubscribeFromContext: (context, contextId) => {
    colyseusService.sendToGlobal("event:unsubscribe", { context, contextId });
  },

  fetchHistory: async (filter) => {
    set({ isLoading: true });
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
        get().setEvents(eventsWithDates, response.nextCursor, response.hasMore);
      }
    } catch (error) {
      console.error("[EventStore] Failed to fetch history:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, nextCursor, isLoadingMore, currentContext } = get();
    if (!hasMore || !nextCursor || isLoadingMore) return;

    set({ isLoadingMore: true });
    try {
      const filter: EventFilter = {
        cursor: nextCursor,
        limit: 50,
      };

      if (currentContext) {
        filter.context = currentContext;
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
        get().appendEvents(
          eventsWithDates,
          response.nextCursor,
          response.hasMore
        );
      }
    } catch (error) {
      console.error("[EventStore] Failed to load more events:", error);
    } finally {
      set({ isLoadingMore: false });
    }
  },

  initializeListeners: () => {
    const handleNewEvent = (event: GameEvent) => {
      const eventWithDate = {
        ...event,
        timestamp:
          typeof event.timestamp === "string"
            ? new Date(event.timestamp)
            : event.timestamp,
      };

      get().addEvent(eventWithDate);

      if (event.severity !== "INFO" || event.category === "COMBAT") {
        get().showToast(eventWithDate);
      }
    };

    colyseusService.on("event:new", handleNewEvent);

    return () => {
      colyseusService.off("event:new", handleNewEvent);
    };
  },
}));
