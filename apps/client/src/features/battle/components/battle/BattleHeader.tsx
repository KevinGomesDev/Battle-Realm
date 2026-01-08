import React, { useMemo, useState, useRef } from "react";
import type { BattleComputed } from "../../../../stores/battleStore";
import type { BattleUnitState } from "@/services/colyseus.service";
import { getHpColor } from "../../../../config/colors.config";
import { Tooltip } from "@/components/Tooltip";
import {
  AnimatedCharacterSprite,
  parseAvatarToHeroId,
} from "../../../kingdom/components/CreateKingdom";
import { BattleEventLogButton } from "./BattleEventLog";
import { EndTurnButton } from "./EndTurnButton";

// =============================================================================
// CORES DOS JOGADORES
// =============================================================================

const PLAYER_COLORS = [
  { hex: "#3b82f6", text: "text-mystic-blue", glow: "shadow-mystic-blue/40" },
  { hex: "#ef4444", text: "text-red-400", glow: "shadow-red-500/40" },
  { hex: "#22c55e", text: "text-ember-green", glow: "shadow-ember-green/40" },
  {
    hex: "#f59e0b",
    text: "text-stellar-amber",
    glow: "shadow-stellar-amber/40",
  },
];

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

/** Formatar timer */
const formatTimer = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
};

/** Ícone de unidade na linha de iniciativa */
const InitiativeIcon: React.FC<{
  unit: BattleUnitState;
  colorIndex: number;
  isActive: boolean;
  isSelected: boolean;
  isOwned: boolean;
  onClick?: () => void;
}> = ({ unit, colorIndex, isActive, isSelected, isOwned, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const isDead = !unit.isAlive;
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  const hpColors = getHpColor(unit.currentHp, unit.maxHp);

  return (
    <div
      ref={iconRef}
      onClick={isOwned && !isDead ? onClick : undefined}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      className={`
        relative w-8 h-8 rounded flex items-center justify-center transition-all
        ${isOwned && !isDead ? "cursor-pointer" : "cursor-default"}
        ${
          isDead
            ? "opacity-25 grayscale"
            : isActive
            ? `ring-2 ring-stellar-amber ${color.glow} shadow-lg`
            : isSelected
            ? "ring-1 ring-astral-chrome/50"
            : "hover:ring-1 hover:ring-surface-400"
        }
      `}
      style={{
        backgroundColor: isDead ? "#1f1f1f" : `${color.hex}15`,
        borderBottom: isDead ? "none" : `2px solid ${color.hex}`,
      }}
    >
      {/* Indicador de turno ativo */}
      {isActive && !isDead && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-stellar-amber animate-bounce" />
        </div>
      )}

      {/* Avatar */}
      {isDead ? (
        <span className="text-xs opacity-50">💀</span>
      ) : (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <AnimatedCharacterSprite
            heroId={parseAvatarToHeroId(unit.avatar)}
            animation="Idle"
            direction="right"
          />
        </div>
      )}

      {/* Action Marks */}
      {!isDead && unit.actionMarks > 0 && (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-px">
          {Array.from({ length: unit.actionMarks }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-red-500" />
          ))}
        </div>
      )}

      {/* Tooltip */}
      {isOwned && (
        <Tooltip
          anchorRef={iconRef}
          visible={showTooltip}
          preferredPosition="bottom"
        >
          <div className="text-xs">
            <p className="font-bold text-astral-chrome">{unit.name}</p>
            <p className="text-astral-steel text-[10px]">
              Nv.{unit.level} · {unit.race}
            </p>
            <div className="flex gap-2 mt-1 text-[10px]">
              <span style={{ color: hpColors.hex }}>
                ❤️ {unit.currentHp}/{unit.maxHp}
              </span>
              <span className="text-mystic-glow">⚡ {unit.speed}</span>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

/** Badge de reino */
const KingdomTag: React.FC<{
  kingdom: { kingdomName: string; ownerId: string };
  colorIndex: number;
  unitsAlive: number;
  totalUnits: number;
  isCurrentTurn: boolean;
  isMe: boolean;
}> = ({ kingdom, colorIndex, unitsAlive, totalUnits, isCurrentTurn, isMe }) => {
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-0.5 rounded transition-all
        ${
          isCurrentTurn
            ? `bg-surface-800 ${color.glow} shadow-md`
            : "bg-surface-900/50"
        }
      `}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color.hex }}
      />
      <span
        className={`text-xs font-semibold truncate max-w-[80px] ${
          isMe ? color.text : "text-astral-chrome"
        }`}
      >
        {kingdom.name}
      </span>
      <span className="text-[10px] text-astral-steel">
        {unitsAlive}/{totalUnits}
      </span>
      {isMe && (
        <span className="text-[8px] text-stellar-amber/60 uppercase">você</span>
      )}
    </div>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface BattleHeaderProps {
  battle: BattleComputed;
  units: BattleUnitState[];
  currentUserId: string;
  selectedUnitId?: string;
  onUnitClick?: (unit: BattleUnitState) => void;
  onEndTurn?: () => void;
  canEndTurn?: boolean;
}

export const BattleHeader: React.FC<BattleHeaderProps> = ({
  battle,
  units,
  currentUserId,
  selectedUnitId,
  onUnitClick,
  onEndTurn,
  canEndTurn = false,
}) => {
  // Processar dados
  const { kingdomStats, sortedUnits, kingdomColorMap } = useMemo(() => {
    type KingdomInfo = BattleComputed["kingdoms"][number];
    const kingdomsMap = new Map<
      string,
      { kingdom: KingdomInfo; units: BattleUnitState[] }
    >();

    battle.kingdoms.forEach((kingdom) => {
      kingdomsMap.set(kingdom.ownerId, { kingdom, units: [] });
    });

    units.forEach((unit) => {
      const entry = kingdomsMap.get(unit.ownerId);
      if (entry) entry.units.push(unit);
    });

    const kingdomStats = Array.from(kingdomsMap.entries()).map(
      ([ownerId, data]) => ({
        ownerId,
        kingdom: data.kingdom,
        unitsAlive: data.units.filter((u) => u.isAlive).length,
        totalUnits: data.units.length,
      })
    );

    const kingdomColorMap = new Map<string, number>();
    kingdomStats.forEach((k, i) => kingdomColorMap.set(k.ownerId, i));

    const sortedUnits = [...units].sort((a, b) => {
      const indexA = battle.actionOrder.indexOf(a.ownerId);
      const indexB = battle.actionOrder.indexOf(b.ownerId);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      if (indexA === indexB) return b.speed - a.speed;
      return indexA - indexB;
    });

    return { kingdomStats, sortedUnits, kingdomColorMap };
  }, [units, battle.kingdoms, battle.actionOrder]);

  const isMyTurn = battle.currentPlayerId === currentUserId;

  const timerColor =
    battle.turnTimer <= 5
      ? "text-red-400 animate-pulse"
      : battle.turnTimer <= 15
      ? "text-stellar-amber"
      : "text-ember-glow";

  return (
    <header className="absolute top-0 left-0 right-0 z-20">
      <div className="bg-surface-900/95 backdrop-blur-sm border-b-2 border-stellar-amber/30">
        <div className="px-3 py-1.5 flex items-center justify-between gap-3">
          {/* Esquerda: Reinos */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {kingdomStats.map((k, index) => (
              <KingdomTag
                key={k.ownerId}
                kingdom={k.kingdom}
                colorIndex={index}
                unitsAlive={k.unitsAlive}
                totalUnits={k.totalUnits}
                isCurrentTurn={battle.currentPlayerId === k.ownerId}
                isMe={k.ownerId === currentUserId}
              />
            ))}
          </div>

          {/* Centro: Iniciativa */}
          <div className="flex items-center gap-0.5 overflow-x-auto flex-shrink-0 scrollbar-none">
            {sortedUnits.map((unit, index) => {
              const colorIndex = kingdomColorMap.get(unit.ownerId) ?? 0;
              const isOwned = unit.ownerId === currentUserId;

              return (
                <React.Fragment key={unit.id}>
                  {index > 0 &&
                    sortedUnits[index - 1].ownerId !== unit.ownerId && (
                      <div className="w-px h-5 bg-surface-500/50 mx-0.5" />
                    )}
                  <InitiativeIcon
                    unit={unit}
                    colorIndex={colorIndex}
                    isActive={battle.activeUnitId === unit.id}
                    isSelected={selectedUnitId === unit.id}
                    isOwned={isOwned}
                    onClick={() => onUnitClick?.(unit)}
                  />
                </React.Fragment>
              );
            })}
          </div>

          {/* Direita: Status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Round */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-astral-steel">R</span>
              <span className="text-stellar-amber font-bold">
                {battle.round}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-surface-500/50" />

            {/* Timer */}
            <span className={`font-bold text-sm tabular-nums ${timerColor}`}>
              {formatTimer(battle.turnTimer)}
            </span>

            {/* Divider */}
            <div className="w-px h-4 bg-surface-500/50" />

            {/* Status do turno */}
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                isMyTurn
                  ? "bg-ember-green/20 text-ember-glow"
                  : "bg-surface-800 text-astral-steel"
              }`}
            >
              {isMyTurn ? "Sua vez" : "Aguarde"}
            </div>

            {/* Divider */}
            <div className="w-px h-4 bg-surface-500/50" />

            {/* End Turn Button */}
            {canEndTurn && onEndTurn && (
              <EndTurnButton onClick={onEndTurn} disabled={!isMyTurn} />
            )}

            {/* Log Button */}
            <BattleEventLogButton battleId={battle.battleId} />
          </div>
        </div>
      </div>
    </header>
  );
};
