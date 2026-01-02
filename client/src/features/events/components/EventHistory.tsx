// client/src/features/events/components/EventHistory.tsx
// Modal/Drawer para visualizar histórico de eventos

import { useEffect, useRef } from "react";
import { useEvents } from "../context/EventContext";
import type { GameEvent } from "../../../../../shared/types/events.types";
import {
  getSeverityColor,
  getCategoryIcon,
  formatEventTime,
} from "../../../../../shared/types/events.types";

// =============================================================================
// EVENT ITEM COMPONENT
// =============================================================================

interface EventItemProps {
  event: GameEvent;
}

function EventItem({ event }: EventItemProps) {
  const severityColor = getSeverityColor(event.severity);
  const icon = getCategoryIcon(event.category);

  // Cores de fundo baseadas na severidade
  const bgColorMap: Record<string, string> = {
    INFO: "bg-gray-800/30",
    SUCCESS: "bg-green-900/20",
    WARNING: "bg-amber-900/20",
    DANGER: "bg-red-900/20",
    NEUTRAL: "bg-gray-800/20",
  };

  const bgColor = bgColorMap[event.severity] || bgColorMap.INFO;

  return (
    <div
      className={`flex items-start gap-3 py-2 px-3 ${bgColor} rounded-lg hover:bg-gray-700/30 transition-colors`}
    >
      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm ${severityColor}`}>{event.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 uppercase">
            {event.category}
          </span>
          <span className="text-xs text-gray-600">•</span>
          <span className="text-xs text-gray-500">
            {formatEventTime(event.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EVENT HISTORY MODAL
// =============================================================================

export function EventHistory() {
  const { state, closeHistory, clearEvents } = useEvents();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeHistory();
      }
    };

    if (state.isHistoryOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.isHistoryOpen, closeHistory]);

  if (!state.isHistoryOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-16">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeHistory}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">📜</span>
            <h2 className="text-base font-semibold text-gray-200">
              Histórico de Eventos
            </h2>
            {state.events.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                {state.events.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state.events.length > 0 && (
              <button
                onClick={clearEvents}
                className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700/50 transition-colors"
              >
                Limpar
              </button>
            )}
            <button
              onClick={closeHistory}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700/50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          className="max-h-[60vh] overflow-y-auto p-3 space-y-2"
        >
          {state.isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : state.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-sm">Nenhum evento registrado</p>
            </div>
          ) : (
            state.events.map((event) => (
              <EventItem key={event.id} event={event} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EVENT HISTORY BUTTON (para usar na topbar)
// =============================================================================

interface EventHistoryButtonProps {
  className?: string;
}

export function EventHistoryButton({
  className = "",
}: EventHistoryButtonProps) {
  const { state, toggleHistory } = useEvents();

  // Contar eventos não lidos (últimos 10 segundos)
  const recentEvents = state.events.filter((e) => {
    const eventTime =
      typeof e.timestamp === "string"
        ? new Date(e.timestamp).getTime()
        : e.timestamp.getTime();
    return Date.now() - eventTime < 10000;
  });

  return (
    <button
      onClick={toggleHistory}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border 
        ${
          state.isHistoryOpen
            ? "bg-amber-900/30 border-amber-600/50 text-amber-400"
            : "bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600"
        } 
        transition-all ${className}`}
    >
      <span className="text-sm">📜</span>
      <span className="text-xs font-medium hidden sm:inline">Eventos</span>

      {/* Badge de eventos recentes */}
      {recentEvents.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
          {recentEvents.length > 9 ? "9+" : recentEvents.length}
        </span>
      )}
    </button>
  );
}
