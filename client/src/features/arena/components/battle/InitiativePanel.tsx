import React, { useMemo } from "react";
import type { ArenaBattle, ArenaUnit } from "../../types/arena.types";
import { ScarMarks } from "../shared/ScarMarks";
import { getMaxMarksByCategory } from "../../../../../../shared/config/global.config";

interface InitiativePanelProps {
  battle: ArenaBattle;
  units: ArenaUnit[];
  currentUserId: string;
  /** Callback quando clicar em uma unidade na lista */
  onUnitClick?: (unit: ArenaUnit) => void;
}

/**
 * Painel de Turnos - Mostra informações do turno atual e lista de unidades por jogador
 */
export const InitiativePanel: React.FC<InitiativePanelProps> = ({
  battle,
  units,
  currentUserId,
  onUnitClick,
}) => {
  // Separar unidades por jogador
  const {
    myUnits,
    enemyUnits,
    myKingdomName,
    enemyKingdomName,
    myTotalAcuity,
    enemyTotalAcuity,
  } = useMemo(() => {
    const myUnits = units.filter((u) => u.ownerId === currentUserId);
    const enemyUnits = units.filter((u) => u.ownerId !== currentUserId);

    // Determinar nomes dos reinos
    const isHost = battle.hostKingdom.ownerId === currentUserId;
    const myKingdomName = isHost
      ? battle.hostKingdom.name
      : battle.guestKingdom.name;
    const enemyKingdomName = isHost
      ? battle.guestKingdom.name
      : battle.hostKingdom.name;

    // Calcular Acuity total (determina quem age primeiro)
    const myTotalAcuity = myUnits
      .filter((u) => u.isAlive)
      .reduce((sum, u) => sum + u.acuity, 0);
    const enemyTotalAcuity = enemyUnits
      .filter((u) => u.isAlive)
      .reduce((sum, u) => sum + u.acuity, 0);

    return {
      myUnits,
      enemyUnits,
      myKingdomName,
      enemyKingdomName,
      myTotalAcuity,
      enemyTotalAcuity,
    };
  }, [units, currentUserId, battle.hostKingdom, battle.guestKingdom]);

  // Determinar se é turno do jogador local
  const isMyTurn = battle.currentPlayerId === currentUserId;
  const currentKingdomName = isMyTurn ? myKingdomName : enemyKingdomName;

  // Formatar timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  // Componente para renderizar uma unidade
  const UnitRow = ({
    unit,
    isOwned,
  }: {
    unit: ArenaUnit;
    isOwned: boolean;
  }) => {
    const isDead = !unit.isAlive;
    const isActiveUnit = battle.activeUnitId === unit.id;
    const isPlayersTurn =
      unit.ownerId === battle.currentPlayerId && unit.isAlive;
    const isHighlighted = battle.activeUnitId ? isActiveUnit : isPlayersTurn;

    return (
      <div
        onClick={() => onUnitClick?.(unit)}
        className={`
          relative flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 cursor-pointer
          ${
            isHighlighted
              ? isOwned
                ? "bg-emerald-900/50 border-emerald-500 shadow-lg shadow-emerald-500/20"
                : "bg-red-900/50 border-red-500 shadow-lg shadow-red-500/20"
              : isDead
              ? "bg-gray-800/30 border-gray-700 opacity-50"
              : "bg-citadel-granite/50 border-metal-iron/50 hover:border-metal-rust"
          }
        `}
        title="Clique para centralizar no mapa"
      >
        {/* Indicador de turno ativo */}
        {isHighlighted && (
          <div
            className={`absolute -left-1 top-1/2 -translate-y-1/2 ${
              isOwned ? "text-emerald-400" : "text-red-400"
            } animate-pulse`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 1 L10 6 L2 11 Z" />
            </svg>
          </div>
        )}

        {/* Avatar */}
        <div
          className={`
            w-7 h-7 flex-shrink-0 rounded border overflow-hidden
            ${
              isDead
                ? "border-gray-600 grayscale"
                : isOwned
                ? "border-blue-400"
                : "border-red-400"
            }
          `}
          style={{ imageRendering: "pixelated" }}
        >
          <div className="w-full h-full flex items-center justify-center text-sm">
            {isDead ? "💀" : isOwned ? "⚔️" : "🔮"}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-semibold truncate ${
              isDead ? "text-gray-500 line-through" : "text-parchment-light"
            }`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {unit.name}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-parchment-dark">
            <span>
              ❤️ {unit.currentHp}/{unit.maxHp}
            </span>
            {unit.physicalProtection > 0 && (
              <span>🛡️ {unit.physicalProtection}</span>
            )}
          </div>
        </div>

        {/* Action Marks */}
        {!isDead && (
          <div className="flex-shrink-0" title="Marcas de Ação (Exaustão)">
            <ScarMarks
              marks={unit.actionMarks}
              maxMarks={getMaxMarksByCategory(unit.category)}
              size={5}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 xl:w-96 flex-shrink-0 p-2 flex flex-col gap-2">
      {/* Header - Round, Timer e Turno */}
      <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised">
        {/* Round e Timer */}
        <div className="flex items-center justify-around gap-4 mb-3">
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

          <div className="h-10 border-l border-metal-rust/30" />

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

        {/* Indicador de Turno Atual */}
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
              ? "🗡️ Sua Unidade Está Agindo"
              : "👆 Escolha Uma Unidade Para Agir"
            : `⏳ Turno de ${currentKingdomName}`}
        </div>
      </div>

      {/* Explicação de Iniciativa */}
      <div className="bg-citadel-granite/50 rounded-lg border border-metal-iron/50 p-2">
        <div className="text-center text-[10px] text-parchment-dark">
          <span className="text-amber-400 font-semibold">Ordem de Turno:</span>{" "}
          O jogador com maior soma de Acuidade age primeiro.
        </div>
        <div className="flex justify-around mt-1 text-[10px]">
          <span
            className={`${
              myTotalAcuity >= enemyTotalAcuity
                ? "text-emerald-400 font-bold"
                : "text-parchment-dark"
            }`}
          >
            Você: {myTotalAcuity} ACU
          </span>
          <span
            className={`${
              enemyTotalAcuity > myTotalAcuity
                ? "text-red-400 font-bold"
                : "text-parchment-dark"
            }`}
          >
            Inimigo: {enemyTotalAcuity} ACU
          </span>
        </div>
      </div>

      {/* Suas Unidades */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="text-xs text-emerald-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-2"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span>⚔️</span>
          <span>{myKingdomName}</span>
          <span className="text-[10px] text-parchment-dark">
            ({myUnits.filter((u) => u.isAlive).length}/{myUnits.length} vivas)
          </span>
        </div>
        <div className="space-y-1 mb-3">
          {myUnits.map((unit) => (
            <UnitRow key={unit.id} unit={unit} isOwned={true} />
          ))}
        </div>

        {/* Unidades Inimigas */}
        <div
          className="text-xs text-red-400 uppercase tracking-wider px-2 mb-1 flex items-center gap-2"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span>🔮</span>
          <span>{enemyKingdomName}</span>
          <span className="text-[10px] text-parchment-dark">
            ({enemyUnits.filter((u) => u.isAlive).length}/{enemyUnits.length}{" "}
            vivas)
          </span>
        </div>
        <div className="space-y-1">
          {enemyUnits.map((unit) => (
            <UnitRow key={unit.id} unit={unit} isOwned={false} />
          ))}
        </div>
      </div>

      {/* Dicas */}
      <div className="text-center text-[10px] text-parchment-dark bg-citadel-granite/30 rounded p-2 border border-metal-iron/30 space-y-1">
        <div>
          💡 <span className="text-parchment-light">Cada turno:</span> Escolha 1
          unidade → Execute ações → Finalize o turno
        </div>
        <div>
          ⌨️ <span className="text-parchment-light">Atalho:</span> Pressione{" "}
          <kbd className="px-1 py-0.5 bg-citadel-obsidian rounded text-amber-400 font-mono">
            Espaço
          </kbd>{" "}
          para encerrar turno
        </div>
      </div>
    </div>
  );
};
