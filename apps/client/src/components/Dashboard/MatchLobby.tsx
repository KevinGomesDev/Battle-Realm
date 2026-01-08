import React, { useEffect, useState } from "react";
import { useMatch } from "../../features/match";
import { useAuth } from "../../features/auth";
import { colyseusService } from "../../services/colyseus.service";
import { Button } from "../Button";

interface MatchLobbyProps {
  matchId: string;
  onGameStart?: () => void;
  onLeave?: () => void;
}

/**
 * MatchLobby - Lobby compacto para partidas (Dashboard)
 */
export const MatchLobby: React.FC<MatchLobbyProps> = ({
  matchId: _matchId,
  onGameStart,
  onLeave,
}) => {
  const {
    state: { user },
  } = useAuth();
  const {
    state: { players, status, isLoading, error },
    setReady,
    leaveMatch,
  } = useMatch();

  const [isReady, setIsReadyLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const handleMatchStarted = () => onGameStart?.();

    colyseusService.on("match:started", handleMatchStarted);

    return () => {
      colyseusService.off("match:started", handleMatchStarted);
    };
  }, [onGameStart]);

  // Atualiza estado de pronto baseado nos players
  useEffect(() => {
    const myPlayer = players.find((p) => p.odataUserId === user?.id);
    if (myPlayer) {
      setIsReadyLocal(myPlayer.isReady);
    }
  }, [players, user?.id]);

  const handleReady = () => {
    setLocalError(null);
    try {
      setReady();
      setIsReadyLocal(true);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao marcar como pronto");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveMatch();
      onLeave?.();
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };

  const displayError = localError || error;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-astral-silver text-xs flex items-center gap-1">
          <span className="w-2 h-2 bg-stellar-amber rounded-full animate-pulse" />
          Aguardando...
        </span>
        <Button variant="danger" size="xs" onClick={handleLeave}>
          Sair
        </Button>
      </div>

      {/* Erro */}
      {displayError && (
        <div className="p-1.5 bg-red-800/20 border border-red-500/50 rounded">
          <p className="text-red-400 text-[10px]">⚠️ {displayError}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && players.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Players */}
          <div className="space-y-1">
            {players.map((player, idx) => {
              const isCurrentUser = player.odataUserId === user?.id;
              const playerName =
                player.username ||
                (isCurrentUser && user?.username) ||
                "Guerreiro";

              return (
                <div
                  key={player.odataId}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    isCurrentUser
                      ? "border-stellar-gold/50 bg-stellar-gold/5"
                      : "border-surface-500/30 bg-surface-800/20"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded border border-surface-500/50 flex items-center justify-center text-xs"
                    style={{ backgroundColor: player.color }}
                  >
                    {idx === 0 ? "👑" : "⚔️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-astral-chrome truncate">
                      {playerName}
                    </p>
                    <p className="text-[10px] text-astral-steel truncate">
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

            {players.length < 2 && (
              <div className="p-2 rounded border border-dashed border-surface-500/30 text-center">
                <p className="text-astral-steel text-xs">
                  ⏳ Aguardando oponente...
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 p-1.5 bg-surface-800/20 border border-surface-500/20 rounded">
            <div
              className={`w-2 h-2 rounded-full ${
                status === "PREPARATION"
                  ? "bg-stellar-amber animate-pulse"
                  : status === "ACTIVE"
                  ? "bg-green-500"
                  : "bg-astral-steel"
              }`}
            />
            <span className="text-astral-silver text-[10px]">
              {status === "WAITING" && "Reunindo tropas"}
              {status === "PREPARATION" && "Preparação"}
              {status === "ACTIVE" && "Batalha"}
            </span>
          </div>

          {/* Ready Button */}
          <Button
            variant={isReady ? "success" : "danger"}
            size="sm"
            fullWidth
            onClick={handleReady}
            disabled={isReady || isLoading}
            isLoading={isLoading}
            icon={isReady ? "✅" : "⚔️"}
          >
            {isReady ? "Pronto!" : "ESTOU PRONTO!"}
          </Button>
        </>
      )}
    </div>
  );
};
