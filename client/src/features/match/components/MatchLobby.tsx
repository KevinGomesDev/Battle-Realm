import React, { useEffect, useState } from "react";
import { useMatch } from "../hooks/useMatch";
import { useAuth } from "../../auth";
import { colyseusService } from "../../../services/colyseus.service";

interface MatchLobbyProps {
  matchId: string;
  onGameStart?: () => void;
  onLeave?: () => void;
}

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

  const [isReadyLocal, setIsReadyLocal] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Listener para quando o jogo começar
  useEffect(() => {
    const handleMatchStarted = () => {
      onGameStart?.();
    };

    colyseusService.on("match:started", handleMatchStarted);

    return () => {
      colyseusService.off("match:started", handleMatchStarted);
    };
  }, [onGameStart]);

  // Atualizar estado de pronto baseado nos players
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

  const getPlayerStatusIcon = (isPlayerReady: boolean) => {
    return isPlayerReady ? "✅" : "⏳";
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho com botão sair */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-stellar-amber rounded-full animate-pulse shadow-stellar"></div>
          <span className="text-astral-silver text-sm">
            Aguardando guerreiros...
          </span>
        </div>
        <button
          onClick={handleLeave}
          className="px-4 py-2 bg-gradient-to-b from-red-600 to-red-800 
                     border-2 border-surface-500 rounded-lg
                     hover:from-red-500 hover:to-red-700
                     text-white font-semibold text-sm transition-all"
        >
          Abandonar
        </button>
      </div>

      {/* Erro */}
      {displayError && (
        <div className="p-3 bg-red-500/20 border-2 border-red-500 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span> {displayError}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-3 border-red-500 rounded-full animate-spin border-t-transparent"></div>
            <div
              className="absolute inset-2 border-2 border-stellar-amber rounded-full animate-spin border-b-transparent"
              style={{ animationDirection: "reverse" }}
            ></div>
          </div>
          <p className="text-astral-steel mt-4">Preparando acampamento...</p>
        </div>
      ) : (
        <>
          {/* Cards dos Jogadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((player, idx) => {
              const isCurrentUser = player.odataUserId === user?.id;
              const playerName =
                player.username ||
                (isCurrentUser && user?.username) ||
                "Guerreiro";

              return (
                <div
                  key={player.odataId}
                  className={`relative bg-gradient-to-b from-surface-700 to-surface-800 
                              border-3 rounded-xl p-4 shadow-card
                              ${
                                isCurrentUser
                                  ? "border-stellar-gold shadow-stellar"
                                  : "border-surface-500"
                              }`}
                >
                  {/* Rebites */}
                  <div className="absolute top-2 left-2 w-2 h-2 bg-surface-500 rounded-full"></div>
                  <div className="absolute top-2 right-2 w-2 h-2 bg-surface-500 rounded-full"></div>

                  {/* Conteúdo */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-surface-500 shadow-inset flex items-center justify-center"
                      style={{ backgroundColor: player.color }}
                    >
                      <span className="text-lg">⚔️</span>
                    </div>
                    <div>
                      <p
                        className="text-astral-chrome font-bold"
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {playerName}
                      </p>
                      <p className="text-astral-steel text-xs">
                        {idx === 0 ? "👑 Anfitrião" : "⚔️ Desafiante"}
                      </p>
                    </div>
                    {isCurrentUser && (
                      <span className="ml-auto bg-stellar-gold/20 text-stellar-gold text-xs px-2 py-1 rounded border border-stellar-gold/30">
                        Você
                      </span>
                    )}
                  </div>

                  <div className="text-astral-silver text-sm mb-3">
                    Reino:{" "}
                    <span className="text-astral-chrome">
                      {player.kingdomName}
                    </span>
                  </div>

                  {/* Status de Pronto */}
                  <div
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      player.isReady
                        ? "bg-green-900/20 border-green-600/50 text-green-400"
                        : "bg-stellar-amber/20 border-stellar-amber/30 text-stellar-amber"
                    }`}
                  >
                    <span>{getPlayerStatusIcon(player.isReady)}</span>
                    <span className="text-sm font-semibold">
                      {player.isReady ? "Pronto para Batalha" : "Preparando..."}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Aguardando oponente */}
            {players.length < 2 && (
              <div className="bg-surface-800/50 rounded-xl border-2 border-dashed border-surface-500/50 p-6 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3 animate-pulse">👤</div>
                  <p className="text-astral-silver">Aguardando oponente...</p>
                  <p className="text-astral-steel text-xs mt-1">
                    O inimigo está a caminho
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status da Partida */}
          <div className="bg-surface-800/50 border-2 border-surface-500/50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "PREPARATION"
                    ? "bg-stellar-amber animate-pulse"
                    : status === "ACTIVE"
                    ? "bg-green-500"
                    : "bg-astral-steel"
                }`}
              ></div>
              <span className="text-astral-silver text-sm">
                {status === "WAITING" && "Reunindo tropas"}
                {status === "PREPARATION" && "Fase de preparação"}
                {status === "ACTIVE" && "Batalha em andamento"}
                {status === "FINISHED" && "Batalha encerrada"}
              </span>
            </div>
          </div>

          {/* Botão Pronto */}
          <button
            onClick={handleReady}
            disabled={isReadyLocal || isLoading}
            className={`group relative w-full px-6 py-4 rounded-lg transition-all 
                        flex items-center justify-center gap-2 border-3
                        ${
                          isReadyLocal
                            ? "bg-gradient-to-b from-green-700 to-green-800 border-green-600 cursor-not-allowed"
                            : "bg-gradient-to-b from-red-600 to-red-800 border-surface-500 shadow-card hover:from-red-500 hover:to-red-700"
                        }`}
          >
            {/* Rebites */}
            <div className="absolute top-1 left-1 w-2 h-2 bg-surface-500 rounded-full"></div>
            <div className="absolute top-1 right-1 w-2 h-2 bg-surface-500 rounded-full"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-surface-500 rounded-full"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-surface-500 rounded-full"></div>

            {isLoading ? (
              <span className="text-white font-bold flex items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                Preparando...
              </span>
            ) : isReadyLocal ? (
              <span className="text-white font-bold flex items-center gap-2">
                ✅ Pronto para Batalha!
              </span>
            ) : (
              <span
                className="text-white font-bold tracking-wider"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                ⚔️ ESTOU PRONTO!
              </span>
            )}
          </button>

          {/* Dica */}
          <p className="text-astral-steel text-xs text-center">
            A batalha começará quando todos os guerreiros estiverem prontos
          </p>
        </>
      )}
    </div>
  );
};
