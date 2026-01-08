// client/src/features/events/components/EventLog.tsx
// Componente de log de eventos reutilizável

import { useEffect, useRef } from "react";
import { useEvents } from "../hooks/useEvents";
import type {
  GameEvent,
  EventContext as EventContextType,
} from "../../../../../shared/types/events.types";
import {
  getCategoryIcon,
  formatEventTime,
} from "../../../../../shared/types/events.types";
import { getSeverityColors } from "../../../config/colors.config";

// =============================================================================
// TYPES
// =============================================================================

interface EventLogProps {
  context?: EventContextType;
  contextId?: string;
  maxHeight?: string;
  showTimestamp?: boolean;
  showIcon?: boolean;
  autoScroll?: boolean;
  className?: string;
  emptyMessage?: string;
}

interface EventItemProps {
  event: GameEvent;
  showTimestamp: boolean;
  showIcon: boolean;
}

// =============================================================================
// EVENT ITEM COMPONENT
// =============================================================================

function EventItem({ event, showTimestamp, showIcon }: EventItemProps) {
  const severityColors = getSeverityColors(event.severity);
  const icon = showIcon ? getCategoryIcon(event.category) : null;

  return (
    <div className="flex items-start gap-2 py-1 px-2 hover:bg-gray-800/30 rounded transition-colors">
      {showIcon && icon && (
        <span className="text-sm flex-shrink-0">{icon}</span>
      )}

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${severityColors.text}`}>
          {event.message}
        </span>
      </div>

      {showTimestamp && (
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatEventTime(event.timestamp)}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// EVENT LOG COMPONENT
// =============================================================================

export function EventLog({
  context,
  contextId,
  maxHeight = "300px",
  showTimestamp = true,
  showIcon = true,
  autoScroll = true,
  className = "",
  emptyMessage = "Nenhum evento registrado",
}: EventLogProps) {
  const { state, subscribeToContext, unsubscribeFromContext, fetchHistory } =
    useEvents();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSubscribedRef = useRef(false);

  // Inscrever no contexto quando montar
  useEffect(() => {
    if (context && !isSubscribedRef.current) {
      subscribeToContext(context, contextId);
      fetchHistory({
        context,
        matchId: context === "MATCH" ? contextId : undefined,
        battleId: context === "BATTLE" ? contextId : undefined,
        BattleLobbyId: context === "battle" ? contextId : undefined,
      });
      isSubscribedRef.current = true;
    }

    return () => {
      if (context && isSubscribedRef.current) {
        unsubscribeFromContext(context, contextId);
        isSubscribedRef.current = false;
      }
    };
  }, [
    context,
    contextId,
    subscribeToContext,
    unsubscribeFromContext,
    fetchHistory,
  ]);

  // Auto-scroll quando novos eventos chegam
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [state.events.length, autoScroll]);

  if (state.isLoading) {
    return (
      <div
        className={`bg-gray-900/50 border border-gray-700 rounded-lg p-4 ${className}`}
      >
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          📜 Log de Eventos
          {state.events.length > 0 && (
            <span className="text-xs text-gray-500">
              ({state.events.length})
            </span>
          )}
        </h3>
      </div>

      {/* Event List */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight }}>
        {state.events.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {state.events.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                showTimestamp={showTimestamp}
                showIcon={showIcon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT EVENT LOG (para uso em sidebars, etc)
// =============================================================================

interface CompactEventLogProps {
  maxEvents?: number;
  className?: string;
}

export function CompactEventLog({
  maxEvents = 5,
  className = "",
}: CompactEventLogProps) {
  const { state } = useEvents();
  const recentEvents = state.events.slice(0, maxEvents);

  if (recentEvents.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {recentEvents.map((event) => (
        <div
          key={event.id}
          className={`text-xs ${
            getSeverityColors(event.severity).text
          } truncate`}
        >
          {getCategoryIcon(event.category)} {event.message}
        </div>
      ))}
    </div>
  );
}
