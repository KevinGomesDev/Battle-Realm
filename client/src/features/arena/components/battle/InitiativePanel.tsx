import React, { useMemo } from "react";
import type { ArenaBattle, ArenaUnit } from "../../types/arena.types";
import { ScarMarks } from "../shared/ScarMarks";

// Helper para calcular max marks por categoria
function getMaxMarksByCategory(category: string): number {
  switch (category) {
    case "TROOP":
      return 1;
    case "HERO":
      return 2;
    case "REGENT":
      return 3;
    default:
      return 1;
  }
}

interface InitiativePanelProps {
  battle: ArenaBattle;
  units: ArenaUnit[];
  currentUserId: string;
  /** Callback quando clicar em uma unidade na lista */
  onUnitClick?: (unit: ArenaUnit) => void;
}

/**
 * Painel de Iniciativa - Mostra ordem de turno das unidades
 * Exibe: Round atual, Timer, Lista ordenada por iniciativa
 */
export const InitiativePanel: React.FC<InitiativePanelProps> = ({
  battle,
  units,
  currentUserId,
  onUnitClick,
}) => {
  // Ordenar unidades por iniciativa
  const orderedUnits = useMemo(() => {
    const unitsMap = new Map(units.map((u) => [u.id, u]));
    return battle.initiativeOrder
      .map((id) => unitsMap.get(id))
      .filter((u): u is ArenaUnit => u !== undefined);
  }, [units, battle.initiativeOrder]);

  // ID do jogador que está no turno atual (não é unit ID, é player ID)
  const currentPlayerId = battle.currentPlayerId;

  // Formatar timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  // Determinar se é turno do jogador local
  const isMyTurn = battle.currentPlayerId === currentUserId;

  return (
    <div className="w-80 xl:w-96 flex-shrink-0 p-2 flex flex-col gap-2">
      {/* Header - Round e Timer lado a lado */}
      <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised">
        <div className="flex items-center justify-around gap-4">
          {/* Round */}
          <div className="text-center">
            <span
              className="text-parchment-light text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Round
            </span>
            <div
              className="text-2xl font-bold text-amber-400"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {battle.round}
            </div>
          </div>

          {/* Divisor Vertical */}
          <div className="h-10 border-l border-metal-rust/30" />

          {/* Timer */}
          <div className="text-center">
            <span
              className="text-parchment-light text-xs uppercase tracking-wider"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Tempo
            </span>
            <div
              className={`text-xl font-bold ${
                battle.turnTimer <= 10
                  ? "text-red-500 animate-pulse"
                  : battle.turnTimer <= 20
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {formatTimer(battle.turnTimer)}
            </div>
          </div>
        </div>
      </div>

      {/* Título da Lista */}
      <div
        className="text-center text-parchment-light text-xs uppercase tracking-wider px-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Ordem de Iniciativa
      </div>

      {/* Lista de Unidades */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {orderedUnits.map((unit, index) => {
          // Unidade ativa = se activeUnitId está definido, é essa unidade específica
          // Senão, marca todas do jogador atual (aguardando escolha)
          const isActiveUnit = battle.activeUnitId === unit.id;
          const isPlayersTurn =
            unit.ownerId === currentPlayerId && unit.isAlive;
          const isCurrentTurn = battle.activeUnitId
            ? isActiveUnit
            : isPlayersTurn;
          const isOwned = unit.ownerId === currentUserId;
          const isDead = !unit.isAlive;

          // Determinar nome do jogador
          const playerName = isOwned
            ? battle.hostKingdom.ownerId === currentUserId
              ? battle.hostKingdom.name
              : battle.guestKingdom.name
            : battle.hostKingdom.ownerId === currentUserId
            ? battle.guestKingdom.name
            : battle.hostKingdom.name;
          // Cores baseadas em quem é dono: verde para suas unidades, vermelho para inimigos
          const turnColor = isOwned
            ? "bg-emerald-900/50 border-emerald-500 shadow-lg shadow-emerald-500/20"
            : "bg-red-900/50 border-red-500 shadow-lg shadow-red-500/20";
          const arrowColor = isOwned ? "text-emerald-400" : "text-red-400";
          const badgeColor = isOwned ? "bg-emerald-500" : "bg-red-500";

          return (
            <div
              key={unit.id}
              onClick={() => onUnitClick?.(unit)}
              className={`
                relative flex items-center gap-2 p-2 rounded-lg border-2 transition-all duration-200 cursor-pointer
                ${
                  isCurrentTurn
                    ? turnColor
                    : isDead
                    ? "bg-gray-800/50 border-gray-600 opacity-50"
                    : "bg-citadel-granite border-metal-iron hover:border-metal-rust"
                }
              `}
              title="Clique para centralizar no mapa"
            >
              {/* Seta indicadora de turno */}
              {isCurrentTurn && (
                <div
                  className={`absolute -left-1 top-1/2 -translate-y-1/2 ${arrowColor} animate-pulse`}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <path d="M2 1 L10 6 L2 11 Z" />
                  </svg>
                </div>
              )}

              {/* Número de Iniciativa */}
              <div
                className={`
                  w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold
                  ${
                    isCurrentTurn
                      ? `${badgeColor} text-white`
                      : isDead
                      ? "bg-gray-600 text-gray-400"
                      : isOwned
                      ? "bg-blue-600 text-white"
                      : "bg-red-600 text-white"
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Avatar/Sprite da Unidade */}
              <div
                className={`
                  w-8 h-8 flex-shrink-0 rounded border overflow-hidden
                  ${
                    isCurrentTurn
                      ? "border-emerald-400"
                      : isDead
                      ? "border-gray-500"
                      : isOwned
                      ? "border-blue-400"
                      : "border-red-400"
                  }
                `}
                style={{ imageRendering: "pixelated" }}
              >
                {/* TODO: Usar sprite real da unidade quando disponível */}
                <div
                  className={`w-full h-full flex items-center justify-center text-lg
                    ${isDead ? "grayscale" : ""}
                  `}
                >
                  {isDead ? "💀" : isOwned ? "⚔️" : "🔮"}
                </div>
              </div>

              {/* Info da Unidade */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-semibold truncate ${
                    isDead
                      ? "text-gray-500 line-through"
                      : isCurrentTurn
                      ? "text-emerald-300"
                      : "text-parchment-light"
                  }`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {unit.name}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    isDead ? "text-gray-600" : "text-parchment-dark"
                  }`}
                >
                  {playerName}
                </div>
              </div>

              {/* Action Marks */}
              {!isDead && (
                <div className="flex-shrink-0" title="Marcas de Ação">
                  <ScarMarks
                    marks={unit.actionMarks}
                    maxMarks={getMaxMarksByCategory(unit.category)}
                    size={5}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Indicador de Turno */}
      <div
        className={`
          text-center py-2 px-3 rounded-lg border-2 text-sm font-bold
          ${
            isMyTurn
              ? "bg-emerald-900/50 border-emerald-500 text-emerald-300"
              : "bg-red-900/50 border-red-500 text-red-300"
          }
        `}
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {isMyTurn
          ? battle.activeUnitId
            ? "🗡️ Sua Unidade Ativa"
            : "👆 Escolha uma Unidade"
          : "⏳ Turno Inimigo"}
      </div>
    </div>
  );
};
