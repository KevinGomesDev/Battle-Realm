import React from "react";
import { useArena } from "../../features/arena";

interface ArenaLobbyProps {
  onBattleStart?: () => void;
  onLeave?: () => void;
}

/**
 * ArenaLobby - Lobby compacto para Arena PvP (Dashboard)
 */
export const ArenaLobby: React.FC<ArenaLobbyProps> = ({
  onBattleStart,
  onLeave,
}) => {
  const {
    state: { currentLobby, isHost },
    leaveLobby,
    startBattle,
  } = useArena();

  if (!currentLobby) return null;

  const isReady = currentLobby.status === "READY";
  const canStart = isHost && isReady;

  // Separar host e outros jogadores
  const hostPlayer = currentLobby.players.find((p) => p.playerIndex === 0);
  const otherPlayers = currentLobby.players.filter((p) => p.playerIndex > 0);
  const waitingSlots = currentLobby.maxPlayers - currentLobby.players.length;

  const handleLeave = () => {
    leaveLobby();
    onLeave?.();
  };

  const handleStart = () => {
    startBattle();
    onBattleStart?.();
  };

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center justify-center gap-2">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            currentLobby.status === "WAITING"
              ? "bg-yellow-900/50 text-yellow-400 border border-yellow-600/50"
              : currentLobby.status === "READY"
              ? "bg-green-900/50 text-green-400 border border-green-600/50"
              : "bg-purple-900/50 text-purple-400 border border-purple-600/50"
          }`}
        >
          {currentLobby.status === "WAITING" && "⏳ Aguardando"}
          {currentLobby.status === "READY" && "✅ Pronto"}
          {currentLobby.status === "BATTLING" && "⚔️ Batalha"}
        </span>
        <span className="text-[10px] text-parchment-dark">
          {currentLobby.players.length}/{currentLobby.maxPlayers}
        </span>
      </div>

      {/* Jogadores */}
      <div className="space-y-2">
        {/* Host */}
        {hostPlayer && (
          <div
            className={`p-2 rounded border ${
              isHost
                ? "border-purple-500/50 bg-purple-900/10"
                : "border-metal-iron/30 bg-citadel-slate/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-b from-metal-bronze to-metal-copper rounded flex items-center justify-center text-xs">
                👑
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-parchment-light truncate">
                  {hostPlayer.username}
                </p>
                <p className="text-[10px] text-parchment-dark truncate">
                  🏰 {hostPlayer.kingdomName}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Outros jogadores */}
        {otherPlayers.map((player) => (
          <div
            key={player.userId}
            className={`p-2 rounded border ${
              !isHost && player.userId === currentLobby.hostUserId
                ? "border-purple-500/50 bg-purple-900/10"
                : "border-metal-iron/30 bg-citadel-slate/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-b from-war-crimson to-war-blood rounded flex items-center justify-center text-xs">
                ⚔️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-parchment-light truncate">
                  {player.username}
                </p>
                <p className="text-[10px] text-parchment-dark truncate">
                  🏰 {player.kingdomName}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Slots vazios */}
        {waitingSlots > 0 && (
          <div className="p-2 rounded border border-dashed border-metal-iron/30">
            <div className="flex items-center justify-center py-2">
              <p className="text-parchment-dark text-xs flex items-center gap-1">
                <span className="animate-pulse">⏳</span> Aguardando{" "}
                {waitingSlots} oponente{waitingSlots > 1 ? "s" : ""}...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={handleLeave}
          className="flex-1 px-2 py-1.5 text-[10px] font-semibold
                     bg-gradient-to-b from-citadel-granite to-citadel-carved
                     border border-metal-iron/50 rounded
                     hover:from-citadel-weathered hover:to-citadel-granite
                     text-parchment-aged transition-all"
        >
          🚪 Sair
        </button>

        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded border transition-all ${
              canStart
                ? "bg-gradient-to-b from-purple-600 to-purple-800 border-purple-500/50 text-parchment-light hover:from-purple-500 hover:to-purple-700"
                : "bg-gradient-to-b from-citadel-slate to-citadel-granite border-metal-iron/50 text-parchment-dark cursor-not-allowed"
            }`}
          >
            {canStart ? "⚔️ Iniciar" : "⏳ Aguardar"}
          </button>
        )}
      </div>
    </div>
  );
};
