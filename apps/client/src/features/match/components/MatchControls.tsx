import React from "react";
import { useMatch } from "../hooks/useMatch";
import { useAuth } from "../../auth";

/**
 * Componente de controles da partida (Terminar Turno, etc)
 */
export const MatchControls: React.FC = () => {
  const { completeMatchState, isMyTurn, myPlayerId, finishTurn, isLoading } =
    useMatch();
  const { user } = useAuth();

  if (!completeMatchState || !user || completeMatchState.status !== "ACTIVE") {
    return null;
  }

  const myPlayer = completeMatchState.players.find(
    (p) => p.odataUserId === user.id
  );

  if (!myPlayer) {
    return null;
  }

  const hasFinished = myPlayer.hasFinishedTurn;
  const canFinishTurn = isMyTurn && !hasFinished && !isLoading;

  const handleFinishTurn = async () => {
    if (!canFinishTurn || !myPlayerId) return;

    try {
      finishTurn();
    } catch (error) {
      console.error("Erro ao terminar turno:", error);
    }
  };

  return (
    <div className="bg-medieval-stone border-2 border-green-700 rounded-2xl p-4 shadow-2xl shadow-green-900/20">
      <div className="flex items-center justify-between gap-4">
        {/* Status */}
        <div className="flex-1">
          {hasFinished ? (
            <div className="flex items-center gap-2 text-green-400">
              <span className="text-xl">✓</span>
              <div>
                <p className="font-semibold">Turno Finalizado</p>
                <p className="text-xs text-gray-400">
                  Aguardando outros jogadores...
                </p>
              </div>
            </div>
          ) : !isMyTurn ? (
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-xl">⏳</span>
              <div>
                <p className="font-semibold">Aguarde sua vez</p>
                <p className="text-xs">
                  Outros jogadores estão realizando ações
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-400">
              <span className="text-xl animate-pulse">▶</span>
              <div>
                <p className="font-semibold">É sua vez!</p>
                <p className="text-xs text-gray-400">
                  Realize suas ações e termine o turno
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botão Terminar Turno */}
        <button
          onClick={handleFinishTurn}
          disabled={!canFinishTurn}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all duration-300 border-2 ${
            canFinishTurn
              ? "bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 hover:scale-105 shadow-lg shadow-green-900/30 border-green-800"
              : "bg-medieval-stone text-gray-500 cursor-not-allowed border-medieval-red-900/30"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Enviando...
            </span>
          ) : hasFinished ? (
            "Turno Finalizado"
          ) : (
            "Terminar Turno"
          )}
        </button>
      </div>
    </div>
  );
};
