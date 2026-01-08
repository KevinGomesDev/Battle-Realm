import React from "react";
import { useMatch } from "../hooks/useMatch";

/**
 * Componente que exibe o estado atual da partida (rodada, turno, vez)
 */
export const MatchStatusDisplay: React.FC = () => {
  const { completeMatchState, isMyTurn, waitingForPlayers } = useMatch();

  if (!completeMatchState) {
    return null;
  }

  const { status, currentRound, currentTurn, players } = completeMatchState;

  // Mostrar apenas durante o jogo
  if (status !== "ACTIVE") {
    return null;
  }

  // Tradução dos turnos
  const turnNames: Record<string, string> = {
    ADMINISTRACAO: "Administração",
    EXERCITOS: "Exércitos",
    MOVIMENTACAO: "Movimentação",
    CRISE: "Crise",
    ACAO: "Ação",
    BATALHA: "Batalha",
  };

  return (
    <div className="bg-medieval-stone border-2 border-medieval-red-800 rounded-2xl p-4 space-y-3 shadow-2xl shadow-medieval-blood/20">
      {/* Rodada e Turno */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-medieval-red-500 mb-1">
          Rodada {currentRound}
        </h3>
        <p className="text-lg text-gray-300">
          {turnNames[currentTurn] || currentTurn}
        </p>
      </div>

      {/* Indicador de Vez */}
      <div className="border-t border-medieval-red-800/30 pt-3">
        {isMyTurn ? (
          <div className="flex items-center justify-center gap-2 text-green-400 font-semibold">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span>É sua vez!</span>
          </div>
        ) : waitingForPlayers.length > 0 ? (
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Aguardando:</p>
            <p className="text-medieval-red-400 font-semibold">
              {waitingForPlayers.join(", ")}
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-400 text-sm">
            Processando turno...
          </div>
        )}
      </div>

      {/* Progresso dos Jogadores */}
      <div className="border-t border-medieval-red-800/30 pt-3 space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.playerColor }}
              ></div>
              <span className="text-gray-300">{player.username}</span>
            </div>
            <div>
              {player.hasFinishedCurrentTurn ? (
                <span className="text-green-400 text-xs">✓ Pronto</span>
              ) : (
                <span className="text-yellow-400 text-xs">⏳ Jogando</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
