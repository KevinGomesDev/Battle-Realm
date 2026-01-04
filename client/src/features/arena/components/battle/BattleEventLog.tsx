// client/src/features/arena/components/battle/BattleEventLog.tsx
// Componente de log de eventos da batalha (eventos mantidos apenas em memória)

import { useState, useEffect, useRef, useCallback } from "react";
import { socketService } from "../../../../services/socket.service";
import type { GameEvent } from "../../../../../../shared/types/events.types";
import {
  getCategoryIcon,
  formatEventTime,
} from "../../../../../../shared/types/events.types";
import { getSeverityColors } from "../../../../config/colors.config";

interface BattleEventLogProps {
  battleId: string;
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
    <div className="flex items-start gap-2 py-1.5 px-2 hover:bg-citadel-obsidian/40 rounded transition-colors">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${severityColors.text}`}>
          {event.message}
        </span>
      </div>
      <span className="text-xs text-metal-iron/60 flex-shrink-0">
        {formatEventTime(event.timestamp)}
      </span>
    </div>
  );
}

/**
 * Lista de eventos da batalha atual
 * Armazena eventos localmente (não persiste no servidor)
 */
export function BattleEventLog({
  battleId,
  className = "",
}: BattleEventLogProps) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ouvir eventos de batalha via socket
  useEffect(() => {
    const handleNewEvent = (event: GameEvent) => {
      // Só adiciona eventos desta batalha
      if (event.battleId === battleId) {
        setEvents((prev) => [event, ...prev]); // Mais recente primeiro
      }
    };

    socketService.on("event:new", handleNewEvent);

    return () => {
      socketService.off("event:new", handleNewEvent);
    };
  }, [battleId]);

  if (events.length === 0) {
    return (
      <div className={`text-center text-metal-iron/60 py-4 ${className}`}>
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
 * Posicionado no canto superior direito
 */
export function BattleEventLogButton({ battleId }: BattleEventLogButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Contar eventos e mostrar indicador de novos
  useEffect(() => {
    const handleNewEvent = (event: GameEvent) => {
      if (event.battleId === battleId) {
        setEventCount((prev) => prev + 1);
        if (!isOpen) {
          setHasNewEvents(true);
        }
      }
    };

    socketService.on("event:new", handleNewEvent);

    return () => {
      socketService.off("event:new", handleNewEvent);
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

  return (
    <div className="relative" ref={panelRef}>
      {/* Botão */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5
          bg-citadel-obsidian/70 backdrop-blur-sm
          border rounded-lg
          transition-all text-xs
          ${
            isOpen
              ? "border-metal-bronze/60 text-parchment-light"
              : "border-metal-iron/30 text-metal-iron hover:text-parchment-dark hover:border-metal-iron/50"
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
                  ? "bg-blood-red text-parchment-light animate-pulse"
                  : "bg-metal-iron/40 text-parchment-dark"
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
            bg-citadel-obsidian/95 backdrop-blur-md
            border border-metal-iron/30 rounded-lg
            shadow-xl shadow-black/50
            overflow-hidden
            z-50
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-metal-iron/20">
            <span className="text-sm font-medium text-parchment-light">
              📜 Log de Batalha
            </span>
            <span className="text-xs text-metal-iron/60">
              {eventCount} evento{eventCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Lista de eventos */}
          <BattleEventLog battleId={battleId} className="p-1" />
        </div>
      )}
    </div>
  );
}
