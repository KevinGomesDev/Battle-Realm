// client/src/features/arena/components/battle/BattleEventLog.tsx
// Componente de log de eventos da batalha (eventos mantidos apenas em memória)

import { useState, useEffect, useRef, useCallback } from "react";
import { colyseusService } from "../../../../services/colyseus.service";
import type { GameEvent } from "../../../../../../shared/types/events.types";
import {
  getCategoryIcon,
  formatEventTime,
} from "../../../../../../shared/types/events.types";
import { getSeverityColors } from "../../../../config/colors.config";

interface BattleEventLogProps {
  events: GameEvent[];
  className?: string;
}

interface BattleEventLogButtonProps {
  battleId: string;
}

/**
 * Componente interno que exibe um único evento
 */
function BattleEventItem({ event }: { event: GameEvent }) {
  const severityColors = getSeverityColors(event.severity);
  const icon = getCategoryIcon(event.category);

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 hover:bg-cosmos-deep/40 rounded transition-colors">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${severityColors.text}`}>
          {event.message}
        </span>
      </div>
      <span className="text-xs text-surface-300/60 flex-shrink-0">
        {formatEventTime(event.timestamp)}
      </span>
    </div>
  );
}

/**
 * Lista de eventos da batalha atual
 * Recebe eventos como prop (estado mantido no componente pai)
 */
export function BattleEventLog({
  events,
  className = "",
}: BattleEventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (events.length === 0) {
    return (
      <div className={`text-center text-surface-300/60 py-4 ${className}`}>
        <span className="text-2xl mb-2 block">📜</span>
        <span className="text-sm">Nenhum evento registrado ainda</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight: "280px" }}
    >
      <div className="space-y-0.5">
        {events.map((event) => (
          <BattleEventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

/**
 * Botão sutil para abrir o log de eventos da batalha
 * Mantém o estado dos eventos aqui para persistir entre abrir/fechar
 */
export function BattleEventLogButton({ battleId }: BattleEventLogButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inscrever na sala de eventos de batalha ao montar e carregar eventos existentes
  useEffect(() => {
    // Handler para receber eventos existentes ao se inscrever
    const handleSubscribed = (data: {
      success: boolean;
      context?: string;
      contextId?: string;
      events?: GameEvent[];
    }) => {
      if (
        data.success &&
        data.context === "BATTLE" &&
        data.contextId === battleId &&
        data.events
      ) {
        setEvents(data.events);
      }
    };

    colyseusService.on("event:subscribed", handleSubscribed);

    colyseusService.sendToArena("event:subscribe", {
      context: "BATTLE",
      contextId: battleId,
    });

    return () => {
      colyseusService.off("event:subscribed", handleSubscribed);
      colyseusService.sendToArena("event:unsubscribe", {
        context: "BATTLE",
        contextId: battleId,
      });
    };
  }, [battleId]);

  // Ouvir novos eventos e armazenar aqui (no componente pai)
  useEffect(() => {
    const handleNewEvent = (event: GameEvent) => {
      if (event.battleId === battleId) {
        setEvents((prev) => [event, ...prev]); // Mais recente primeiro
        if (!isOpen) {
          setHasNewEvents(true);
        }
      }
    };

    colyseusService.on("event:new", handleNewEvent);

    return () => {
      colyseusService.off("event:new", handleNewEvent);
    };
  }, [battleId, isOpen]);

  // Limpar indicador quando abrir
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        setHasNewEvents(false);
      }
      return !prev;
    });
  }, []);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const eventCount = events.length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Botão */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5
          bg-cosmos-deep/70 backdrop-blur-sm
          border rounded-lg
          transition-all text-xs
          ${
            isOpen
              ? "border-stellar-amber/60 text-astral-chrome"
              : "border-surface-500/30 text-surface-300 hover:text-surface-200 hover:border-surface-400/50"
          }
        `}
        title="Log de eventos da batalha"
      >
        <span>📜</span>
        <span className="hidden sm:inline">Log</span>
        {eventCount > 0 && (
          <span
            className={`
              min-w-[18px] h-[18px] flex items-center justify-center
              rounded-full text-[10px] font-medium
              ${
                hasNewEvents
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-surface-500/40 text-surface-200"
              }
            `}
          >
            {eventCount > 99 ? "99+" : eventCount}
          </span>
        )}
      </button>

      {/* Painel de eventos */}
      {isOpen && (
        <div
          className="
            absolute top-full right-0 mt-2
            w-80 max-w-[90vw]
            bg-surface-900/95 backdrop-blur-md
            border border-surface-500/30 rounded-lg
            shadow-cosmic
            overflow-hidden
            z-50
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-500/20">
            <span className="text-sm font-medium text-astral-chrome">
              📜 Log de Batalha
            </span>
            <span className="text-xs text-surface-300/60">
              {eventCount} evento{eventCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Lista de eventos */}
          <BattleEventLog events={events} className="p-1" />
        </div>
      )}
    </div>
  );
}
