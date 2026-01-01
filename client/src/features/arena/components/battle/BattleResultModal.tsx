import React from "react";
import type { ArenaUnit, BattleEndedResponse } from "../../types/arena.types";

interface BattleResultModalProps {
  result: BattleEndedResponse;
  units: ArenaUnit[];
  isWinner: boolean;
  myKingdomName: string;
  opponentKingdomName: string;
  myUserId: string;
  onRematch: () => void;
  onLeave: () => void;
  rematchPending?: boolean;
  opponentWantsRematch?: boolean;
}

/**
 * BattleResultModal - Modal exibido ao final de uma batalha de Arena
 * Mostra resultado (Vitória/Derrota), todas as unidades e seus status finais
 */
export const BattleResultModal: React.FC<BattleResultModalProps> = ({
  result,
  units,
  isWinner,
  myKingdomName,
  opponentKingdomName,
  myUserId,
  onRematch,
  onLeave,
  rematchPending,
  opponentWantsRematch,
}) => {
  const myUnits = units.filter((u) => u.ownerId === myUserId);
  const enemyUnits = units.filter((u) => u.ownerId !== myUserId);

  const renderUnitCard = (unit: ArenaUnit, isEnemy: boolean) => {
    const hpPercent = (unit.currentHp / unit.maxHp) * 100;
    const isDead = !unit.isAlive || unit.currentHp <= 0;

    return (
      <div
        key={unit.id}
        className={`p-3 rounded-lg border-2 ${
          isDead
            ? "bg-gray-800/50 border-gray-600 opacity-60"
            : isEnemy
            ? "bg-red-900/30 border-red-700"
            : "bg-blue-900/30 border-blue-700"
        }`}
      >
        {/* Nome e Status */}
        <div className="flex items-center justify-between mb-2">
          <span
            className={`font-bold ${
              isDead ? "text-gray-400 line-through" : "text-parchment-light"
            }`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {unit.name}
          </span>
          {isDead ? (
            <span className="text-xs px-2 py-0.5 bg-gray-700 border border-gray-500 rounded text-gray-300">
              💀 MORTO
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-green-800 border border-green-600 rounded text-green-300">
              ✓ VIVO
            </span>
          )}
        </div>

        {/* Barra de HP */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-parchment-dark">HP</span>
            <span className="text-parchment-light">
              {unit.currentHp}/{unit.maxHp}
            </span>
          </div>
          <div className="h-2 bg-citadel-obsidian rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.max(0, hpPercent)}%`,
                backgroundColor:
                  hpPercent > 60
                    ? "#4ade80"
                    : hpPercent > 30
                    ? "#fbbf24"
                    : "#ef4444",
              }}
            />
          </div>
        </div>

        {/* Stats resumidos */}
        <div className="grid grid-cols-4 gap-1 text-xs">
          <div className="text-center">
            <span className="text-parchment-dark">⚔️</span>
            <p className="text-parchment-light">{unit.combat}</p>
          </div>
          <div className="text-center">
            <span className="text-parchment-dark">👁️</span>
            <p className="text-parchment-light">{unit.acuity}</p>
          </div>
          <div className="text-center">
            <span className="text-parchment-dark">🎯</span>
            <p className="text-parchment-light">{unit.focus}</p>
          </div>
          <div className="text-center">
            <span className="text-parchment-dark">🛡️</span>
            <p className="text-parchment-light">{unit.armor}</p>
          </div>
        </div>

        {/* Condições */}
        {unit.conditions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {unit.conditions.map((cond, i) => (
              <span
                key={i}
                className="text-xs px-1.5 py-0.5 bg-war-blood/30 border border-war-crimson/50 rounded text-war-ember"
              >
                {cond}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-citadel-granite border-4 border-metal-iron rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header - Resultado */}
        <div
          className={`p-6 text-center border-b-4 ${
            isWinner
              ? "bg-gradient-to-b from-yellow-600/30 to-yellow-900/30 border-yellow-600"
              : "bg-gradient-to-b from-red-900/30 to-gray-900/30 border-red-800"
          }`}
        >
          <div className="text-6xl mb-2">{isWinner ? "🏆" : "💀"}</div>
          <h1
            className={`text-3xl font-bold ${
              isWinner ? "text-yellow-400" : "text-red-400"
            }`}
            style={{ fontFamily: "'Cinzel Decorative', cursive" }}
          >
            {isWinner ? "VITÓRIA!" : "DERROTA"}
          </h1>
          <p className="text-parchment-aged mt-2">{result.reason}</p>
        </div>

        {/* Conteúdo - Unidades */}
        <div className="p-6">
          {/* Minhas Unidades */}
          <div className="mb-6">
            <h2
              className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              <span className="text-2xl">👑</span>
              {myKingdomName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myUnits.map((unit) => renderUnitCard(unit, false))}
            </div>
          </div>

          {/* Unidades Inimigas */}
          <div>
            <h2
              className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              <span className="text-2xl">⚔️</span>
              {opponentKingdomName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enemyUnits.map((unit) => renderUnitCard(unit, true))}
            </div>
          </div>
        </div>

        {/* Footer - Ações */}
        <div className="p-6 bg-citadel-slate/50 border-t-2 border-metal-iron">
          {/* Status de Revanche */}
          {opponentWantsRematch && !rematchPending && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg text-center">
              <p className="text-yellow-400 font-semibold">
                ⚔️ O oponente quer uma revanche!
              </p>
            </div>
          )}
          {rematchPending && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600 rounded-lg text-center">
              <p className="text-blue-400 font-semibold">
                ⏳ Aguardando resposta do oponente...
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={onRematch}
              disabled={rematchPending}
              className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all ${
                rematchPending
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : opponentWantsRematch
                  ? "bg-gradient-to-b from-yellow-500 to-yellow-700 border-2 border-yellow-400 text-citadel-obsidian hover:from-yellow-400 hover:to-yellow-600"
                  : "bg-gradient-to-b from-green-600 to-green-800 border-2 border-green-400 text-parchment-light hover:from-green-500 hover:to-green-700"
              }`}
            >
              {rematchPending
                ? "⏳ Aguardando..."
                : opponentWantsRematch
                ? "⚔️ Aceitar Revanche!"
                : "🔄 Revanche"}
            </button>
            <button
              onClick={onLeave}
              className="flex-1 py-3 bg-gradient-to-b from-citadel-granite to-citadel-carved border-2 border-metal-iron rounded-lg text-parchment-aged font-bold text-lg hover:from-citadel-weathered hover:to-citadel-granite transition-all"
            >
              🚪 Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
