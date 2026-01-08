// client/src/features/events/hooks/useEvents.ts
// Hook para acessar a store de eventos via Zustand

import { useShallow } from "zustand/react/shallow";
import { useEventStore } from "../../../stores";

/**
 * Hook principal para gerenciamento de eventos
 */
export function useEvents() {
  const state = useEventStore(
    useShallow((s) => ({
      events: s.events,
      toasts: s.toasts,
      isLoading: s.isLoading,
      isLoadingMore: s.isLoadingMore,
      isHistoryOpen: s.isHistoryOpen,
      currentContext: s.currentContext,
      currentContextId: s.currentContextId,
      maxEvents: s.maxEvents,
      nextCursor: s.nextCursor,
      hasMore: s.hasMore,
    }))
  );

  const subscribeToContext = useEventStore((s) => s.subscribeToContext);
  const unsubscribeFromContext = useEventStore((s) => s.unsubscribeFromContext);
  const fetchHistory = useEventStore((s) => s.fetchHistory);
  const loadMore = useEventStore((s) => s.loadMore);
  const clearEvents = useEventStore((s) => s.clearEvents);
  const showToast = useEventStore((s) => s.showToast);
  const dismissToast = useEventStore((s) => s.dismissToast);
  const openHistory = useEventStore((s) => s.openHistory);
  const closeHistory = useEventStore((s) => s.closeHistory);
  const toggleHistory = useEventStore((s) => s.toggleHistory);

  return {
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
}

/**
 * Hook para acessar apenas o estado de eventos (sem ações)
 */
export function useEventsState() {
  return useEventStore(
    useShallow((s) => ({
      events: s.events,
      toasts: s.toasts,
      isLoading: s.isLoading,
      isLoadingMore: s.isLoadingMore,
      isHistoryOpen: s.isHistoryOpen,
      currentContext: s.currentContext,
      currentContextId: s.currentContextId,
      hasMore: s.hasMore,
    }))
  );
}

/**
 * Hook para acessar apenas os toasts
 */
export function useToasts() {
  const toasts = useEventStore((s) => s.toasts);
  const showToast = useEventStore((s) => s.showToast);
  const dismissToast = useEventStore((s) => s.dismissToast);

  return { toasts, showToast, dismissToast };
}
