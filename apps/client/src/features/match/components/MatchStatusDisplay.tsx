import React from "react";
import { useMatch } from "../hooks/useMatch";

/**
 * Component that displays the current match state (round, turn, player's turn)
 */
export const MatchStatusDisplay: React.FC = () => {
  const { completeMatchState, isMyTurn, waitingForPlayers } = useMatch();

  if (!completeMatchState) {
    return null;
  }

  const { status, currentTurn, players } = completeMatchState;

  // Only show during active game
  if (status !== "ACTIVE") {
    return null;
  }

  // Turn names
  const turnNames: Record<number, string> = {
    1: "Administration",
    2: "Armies",
    3: "Movement",
    4: "Crisis",
    5: "Action",
    6: "Battle",
  };

  return (
    <div className="bg-medieval-stone border-2 border-medieval-red-800 rounded-2xl p-4 space-y-3 shadow-2xl shadow-medieval-blood/20">
      {/* Round and Turn */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-medieval-red-500 mb-1">
          Turn {currentTurn}
        </h3>
        <p className="text-lg text-gray-300">
          {turnNames[currentTurn] || `Turn ${currentTurn}`}
        </p>
      </div>

      {/* Turn Indicator */}
      <div className="border-t border-medieval-red-800/30 pt-3">
        {isMyTurn ? (
          <div className="flex items-center justify-center gap-2 text-green-400 font-semibold">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span>It's your turn!</span>
          </div>
        ) : waitingForPlayers.length > 0 ? (
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Waiting for:</p>
            <p className="text-medieval-red-400 font-semibold">
              {waitingForPlayers.map((p) => p.username).join(", ")}
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-400 text-sm">
            Processing turn...
          </div>
        )}
      </div>

      {/* Player Progress */}
      <div className="border-t border-medieval-red-800/30 pt-3 space-y-2">
        {players.map((player) => (
          <div
            key={player.odataId}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color }}
              ></div>
              <span className="text-gray-300">{player.username}</span>
            </div>
            <div>
              {player.hasFinishedTurn ? (
                <span className="text-green-400 text-xs">✓ Ready</span>
              ) : (
                <span className="text-yellow-400 text-xs">⏳ Playing</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
