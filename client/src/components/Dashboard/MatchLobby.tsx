import React, { useEffect, useState } from "react";
import { useMatch } from "../../features/match";
import { useAuth } from "../../features/auth";
import { socketService } from "../../services/socket.service";

interface MatchLobbyProps {
  matchId: string;
  onGameStart?: () => void;
  onLeave?: () => void;
}

/**
 * MatchLobby - Lobby compacto para partidas (Dashboard)
 */
export const MatchLobby: React.FC<MatchLobbyProps> = ({
  matchId,
  onGameStart,
  onLeave,
}) => {
  const {
    state: { user },
  } = useAuth();
  const {
    state: { preparationData, matchMapData, isLoading, error },
    getPreparationData,
    loadMatch,
    requestMapData,
    requestMatchState,
    setPlayerReady,
  } = useMatch();

  const [isReady, setIsReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    getPreparationData(matchId).catch(console.error);
  }, [matchId, getPreparationData]);

  useEffect(() => {
    const handleMatchStarted = () => onGameStart?.();

    const handlePreparationStarted = () => {
      getPreparationData(matchId).catch(console.error);
      loadMatch(matchId).catch(console.error);
      requestMapData(matchId).catch(console.error);
      requestMatchState(matchId).catch(console.error);
    };

    const handlePlayerReadyUpdate = () => {
      getPreparationData(matchId).catch(console.error);
    };

    socketService.on("match:started", handleMatchStarted);
    socketService.on("match:preparation_started", handlePreparationStarted);
    socketService.on("match:player_ready_update", handlePlayerReadyUpdate);

    return () => {
      socketService.off("match:started", handleMatchStarted);
      socketService.off("match:preparation_started", handlePreparationStarted);
      socketService.off("match:player_ready_update", handlePlayerReadyUpdate);
    };
  }, [
    matchId,
    getPreparationData,
    loadMatch,
    requestMapData,
    requestMatchState,
    onGameStart,
  ]);

  useEffect(() => {
    if (preparationData) setIsReady(preparationData.isReady);
  }, [preparationData]);

  const handleReady = async () => {
    setLocalError(null);
    try {
      await setPlayerReady(matchId);
      setIsReady(true);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao marcar como pronto");
    }
  };

  const displayError = localError || error;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-parchment-aged text-xs flex items-center gap-1">
          <span className="w-2 h-2 bg-torch-glow rounded-full animate-pulse" />
          Aguardando...
        </span>
        <button
          onClick={onLeave}
          className="px-2 py-0.5 text-[10px] font-semibold
                     bg-gradient-to-b from-war-crimson to-war-blood
                     border border-metal-iron/50 rounded
                     hover:from-war-ember hover:to-war-crimson
                     text-parchment-light transition-all"
        >
          Sair
        </button>
      </div>

      {/* Erro */}
      {displayError && (
        <div className="p-1.5 bg-war-blood/20 border border-war-crimson/50 rounded">
          <p className="text-war-ember text-[10px]">⚠️ {displayError}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && !preparationData ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-war-crimson border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Players */}
          <div className="space-y-1">
            {matchMapData?.players.map((player) => {
              const isCurrentUser =
                player.id === user?.id ||
                player.playerIndex === preparationData?.playerIndex;
              const playerName =
                (player as any).username ||
                (player as any).name ||
                (isCurrentUser && user?.username) ||
                "Guerreiro";

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    isCurrentUser
                      ? "border-metal-gold/50 bg-metal-gold/5"
                      : "border-metal-iron/30 bg-citadel-slate/20"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded border border-metal-iron/50 flex items-center justify-center text-xs"
                    style={{ backgroundColor: player.playerColor }}
                  >
                    {player.playerIndex === 0 ? "👑" : "⚔️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-parchment-light truncate">
                      {playerName}
                    </p>
                    <p className="text-[10px] text-parchment-dark truncate">
                      🏰 {player.kingdomName}
                    </p>
                  </div>
                  <span
                    className={`text-xs ${
                      player.isReady ? "text-green-400" : "text-yellow-400"
                    }`}
                  >
                    {player.isReady ? "✅" : "⏳"}
                  </span>
                </div>
              );
            })}

            {matchMapData && matchMapData.players.length < 2 && (
              <div className="p-2 rounded border border-dashed border-metal-iron/30 text-center">
                <p className="text-parchment-dark text-xs">
                  ⏳ Aguardando oponente...
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 p-1.5 bg-citadel-slate/20 border border-metal-iron/20 rounded">
            <div
              className={`w-2 h-2 rounded-full ${
                matchMapData?.status === "PREPARATION"
                  ? "bg-torch-glow animate-pulse"
                  : matchMapData?.status === "ACTIVE"
                  ? "bg-green-500"
                  : "bg-metal-steel"
              }`}
            />
            <span className="text-parchment-aged text-[10px]">
              {matchMapData?.status === "WAITING" && "Reunindo tropas"}
              {matchMapData?.status === "PREPARATION" && "Preparação"}
              {matchMapData?.status === "ACTIVE" && "Batalha"}
            </span>
          </div>

          {/* Ready Button */}
          <button
            onClick={handleReady}
            disabled={isReady || isLoading}
            className={`w-full py-2 text-xs font-bold rounded border transition-all ${
              isReady
                ? "bg-gradient-to-b from-green-700 to-green-800 border-green-600/50 text-parchment-light cursor-not-allowed"
                : "bg-gradient-to-b from-war-crimson to-war-blood border-metal-iron/50 text-parchment-light hover:from-war-ember hover:to-war-crimson"
            }`}
          >
            {isLoading ? "..." : isReady ? "✅ Pronto!" : "⚔️ ESTOU PRONTO!"}
          </button>
        </>
      )}
    </div>
  );
};
