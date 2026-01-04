import React, { useMemo, useState, useRef } from "react";
import type { ArenaBattle, ArenaKingdom } from "../../types/arena.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import { getHpColor } from "../../../../config/colors.config";
import { Tooltip } from "@/components/Tooltip";
import {
  AnimatedCharacterSprite,
  parseAvatarToHeroId,
} from "../../../kingdom/components/CreateKingdom";
import { BattleEventLogButton } from "./BattleEventLog";

// =============================================================================
// CORES DOS JOGADORES (suporte a múltiplos)
// =============================================================================

const KINGDOM_COLORS = [
  {
    hex: "#3b82f6",
    text: "text-blue-400",
    border: "border-blue-500",
    bg: "bg-blue-500",
    ring: "ring-blue-400/50",
    glow: "shadow-blue-500/30",
  },
  {
    hex: "#ef4444",
    text: "text-red-400",
    border: "border-red-500",
    bg: "bg-red-500",
    ring: "ring-red-400/50",
    glow: "shadow-red-500/30",
  },
  {
    hex: "#a855f7",
    text: "text-purple-400",
    border: "border-purple-500",
    bg: "bg-purple-500",
    ring: "ring-purple-400/50",
    glow: "shadow-purple-500/30",
  },
  {
    hex: "#f59e0b",
    text: "text-amber-400",
    border: "border-amber-500",
    bg: "bg-amber-500",
    ring: "ring-amber-400/50",
    glow: "shadow-amber-500/30",
  },
  {
    hex: "#10b981",
    text: "text-emerald-400",
    border: "border-emerald-500",
    bg: "bg-emerald-500",
    ring: "ring-emerald-400/50",
    glow: "shadow-emerald-500/30",
  },
  {
    hex: "#ec4899",
    text: "text-pink-400",
    border: "border-pink-500",
    bg: "bg-pink-500",
    ring: "ring-pink-400/50",
    glow: "shadow-pink-500/30",
  },
];

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

/**
 * Formatar timer
 */
const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
};

/**
 * Troop Icon - Ícone de tropa na lista de iniciativa
 */
const TroopIcon: React.FC<{
  unit: BattleUnit;
  colorIndex: number;
  isOwned: boolean;
  isActive: boolean;
  isSelected: boolean;
  isCurrentPlayerTurn: boolean;
  onClick?: () => void;
}> = ({
  unit,
  colorIndex,
  isActive,
  isSelected,
  isCurrentPlayerTurn,
  isOwned,
  onClick,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const isDead = !unit.isAlive;
  const color = KINGDOM_COLORS[colorIndex % KINGDOM_COLORS.length];
  const hpColors = getHpColor(unit.currentHp, unit.maxHp);

  return (
    <div
      ref={iconRef}
      onClick={isOwned ? onClick : undefined}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`
        relative w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center
        ${isOwned ? "cursor-pointer" : "cursor-default"}
        ${
          isDead
            ? "border-gray-600 bg-gray-800/50 opacity-30 grayscale"
            : isActive
            ? `${color.border} bg-gray-800 ring-2 ${color.ring} shadow-lg ${color.glow}`
            : isSelected
            ? `${color.border} bg-gray-800 ring-1 ring-white/30`
            : isCurrentPlayerTurn
            ? `${color.border} bg-gray-800/80 hover:bg-gray-700/80`
            : "border-gray-600 bg-gray-800/60 hover:border-gray-500"
        }
      `}
    >
      {/* Indicador de turno ativo */}
      {isActive && !isDead && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
          <div
            className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent animate-bounce"
            style={{ borderTopColor: color.hex }}
          />
        </div>
      )}

      {/* Avatar - Sprite ou ícone de morte */}
      {isDead ? (
        <span className="text-lg opacity-50">💀</span>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <AnimatedCharacterSprite
            heroId={parseAvatarToHeroId(unit.avatar)}
            animation="Idle"
            direction="right"
          />
        </div>
      )}

      {/* Action Marks - Indicador de ações usadas */}
      {!isDead && unit.actionMarks > 0 && (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: unit.actionMarks }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-red-400 border border-red-600 shadow-sm"
            />
          ))}
        </div>
      )}

      {/* Tooltip - Apenas para unidades próprias */}
      {isOwned && (
        <Tooltip
          anchorRef={iconRef}
          visible={showTooltip}
          preferredPosition="bottom"
        >
          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 flex-shrink-0 rounded bg-gray-800 flex items-center justify-center">
                <AnimatedCharacterSprite
                  heroId={parseAvatarToHeroId(unit.avatar)}
                  animation="Idle"
                  direction="right"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-100 font-bold text-xs truncate">
                  {unit.name}
                </p>
                <p className="text-gray-500 text-[9px]">
                  Nível {unit.level} · {unit.race}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] pt-1.5 border-t border-gray-700">
              <span
                style={{ color: hpColors.hex }}
                className="flex items-center gap-1"
              >
                <span>❤️</span>
                <span className="font-semibold">
                  {unit.currentHp}/{unit.maxHp}
                </span>
              </span>
              <span className="text-blue-400 flex items-center gap-1">
                <span>⚡</span>
                <span>{unit.speed}</span>
              </span>
              {unit.conditions.length > 0 && (
                <span className="text-purple-400">
                  ✨ {unit.conditions.length}
                </span>
              )}
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

/**
 * Kingdom Badge - Badge compacto de reino
 */
const KingdomBadge: React.FC<{
  kingdom: ArenaKingdom;
  colorIndex: number;
  unitsAlive: number;
  totalUnits: number;
  totalSpeed: number;
  isCurrentTurn: boolean;
  isMe: boolean;
}> = ({
  kingdom,
  colorIndex,
  unitsAlive,
  totalUnits,
  totalSpeed,
  isCurrentTurn,
  isMe,
}) => {
  const color = KINGDOM_COLORS[colorIndex % KINGDOM_COLORS.length];

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1 rounded-lg border transition-all
        ${
          isCurrentTurn
            ? `${color.border} bg-gray-800/80 shadow-lg ${color.glow}`
            : "border-gray-700 bg-gray-800/50"
        }
      `}
    >
      {/* Indicador de cor */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color.hex }}
      />

      {/* Info */}
      <div className="min-w-0">
        <p
          className={`font-bold text-xs truncate max-w-[100px] ${
            isMe ? color.text : "text-gray-200"
          }`}
        >
          {kingdom.name}
        </p>
        <p className="text-gray-400 text-[9px]">
          {unitsAlive}/{totalUnits} · {totalSpeed} VEL
        </p>
      </div>

      {/* Indicador "Você" */}
      {isMe && <span className="text-[8px] text-gray-500 uppercase">Você</span>}
    </div>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface BattleHeaderProps {
  battle: ArenaBattle;
  units: BattleUnit[];
  currentUserId: string;
  selectedUnitId?: string;
  onUnitClick?: (unit: BattleUnit) => void;
}

/**
 * Header da Batalha - Visual de Iniciativa com suporte a múltiplos reinos
 */
export const BattleHeader: React.FC<BattleHeaderProps> = ({
  battle,
  units,
  currentUserId,
  selectedUnitId,
  onUnitClick,
}) => {
  // Agrupar unidades por reino e calcular estatísticas
  const { kingdoms, sortedUnits, kingdomColorMap } = useMemo(() => {
    // Coletar todos os reinos únicos
    const kingdomsMap = new Map<
      string,
      { kingdom: ArenaKingdom; units: BattleUnit[] }
    >();

    // Adicionar host e guest
    kingdomsMap.set(battle.hostKingdom.ownerId, {
      kingdom: battle.hostKingdom,
      units: [],
    });
    kingdomsMap.set(battle.guestKingdom.ownerId, {
      kingdom: battle.guestKingdom,
      units: [],
    });

    // Distribuir unidades por reino
    units.forEach((unit) => {
      const entry = kingdomsMap.get(unit.ownerId);
      if (entry) {
        entry.units.push(unit);
      }
    });

    // Converter para array com estatísticas
    const kingdoms = Array.from(kingdomsMap.entries()).map(
      ([ownerId, data]) => ({
        ownerId,
        kingdom: data.kingdom,
        units: data.units,
        unitsAlive: data.units.filter((u) => u.isAlive).length,
        totalUnits: data.units.length,
        totalSpeed: data.units
          .filter((u) => u.isAlive)
          .reduce((sum, u) => sum + u.speed, 0),
      })
    );

    // Criar mapa de cores por ownerId
    const kingdomColorMap = new Map<string, number>();
    kingdoms.forEach((k, i) => kingdomColorMap.set(k.ownerId, i));

    // Ordenar unidades por ordem de ação
    const sortedUnits = [...units].sort((a, b) => {
      const indexA = battle.actionOrder.indexOf(a.id);
      const indexB = battle.actionOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return { kingdoms, sortedUnits, kingdomColorMap };
  }, [units, battle.hostKingdom, battle.guestKingdom, battle.actionOrder]);

  const isMyTurn = battle.currentPlayerId === currentUserId;

  // Timer colors
  const getTimerColor = () => {
    if (battle.turnTimer <= 5) return "text-red-400 animate-pulse";
    if (battle.turnTimer <= 15) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20">
      <div className="bg-gray-900/90 backdrop-blur-sm border-2 border-gray-700 rounded-xl shadow-2xl">
        <div className="px-3 py-2">
          {/* Linha superior: Reinos + Status Central */}
          <div className="flex items-center justify-between gap-4 mb-2">
            {/* Reinos à esquerda */}
            <div className="flex items-center gap-2 flex-wrap">
              {kingdoms.map((k, index) => (
                <KingdomBadge
                  key={k.ownerId}
                  kingdom={k.kingdom}
                  colorIndex={index}
                  unitsAlive={k.unitsAlive}
                  totalUnits={k.totalUnits}
                  totalSpeed={k.totalSpeed}
                  isCurrentTurn={battle.currentPlayerId === k.ownerId}
                  isMe={k.ownerId === currentUserId}
                />
              ))}
            </div>

            {/* Status Central */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Round */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 border border-gray-700 rounded">
                <span className="text-gray-500 text-[10px] uppercase">
                  Round
                </span>
                <span className="text-amber-400 font-bold text-sm">
                  {battle.round}
                </span>
              </div>

              {/* Timer */}
              <div className="px-3 py-1 bg-gray-800 border border-gray-700 rounded">
                <span className={`font-bold text-sm ${getTimerColor()}`}>
                  {formatTimer(battle.turnTimer)}
                </span>
              </div>

              {/* Status do Turno */}
              <div
                className={`px-3 py-1 rounded border text-xs font-bold ${
                  isMyTurn
                    ? "bg-emerald-900/50 border-emerald-500/50 text-emerald-400"
                    : "bg-gray-800 border-gray-600 text-gray-400"
                }`}
              >
                {isMyTurn ? "🗡️ Sua Vez" : "⏳ Aguarde"}
              </div>

              {/* Log de Eventos */}
              <BattleEventLogButton battleId={battle.battleId} />
            </div>
          </div>

          {/* Linha de Iniciativa - Tropas ordenadas */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            <span className="text-gray-500 text-[10px] uppercase mr-2 flex-shrink-0">
              Ordem:
            </span>

            {sortedUnits.map((unit, index) => {
              const colorIndex = kingdomColorMap.get(unit.ownerId) ?? 0;
              const isCurrentPlayerTurn =
                battle.currentPlayerId === unit.ownerId;
              const isOwned = unit.ownerId === currentUserId;

              return (
                <React.Fragment key={unit.id}>
                  {/* Separador visual entre tropas de diferentes jogadores */}
                  {index > 0 &&
                    sortedUnits[index - 1].ownerId !== unit.ownerId && (
                      <div className="w-px h-8 bg-gray-600 mx-1 flex-shrink-0" />
                    )}

                  <TroopIcon
                    unit={unit}
                    colorIndex={colorIndex}
                    isActive={battle.activeUnitId === unit.id}
                    isSelected={selectedUnitId === unit.id}
                    isCurrentPlayerTurn={isCurrentPlayerTurn}
                    isOwned={isOwned}
                    onClick={() => onUnitClick?.(unit)}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
