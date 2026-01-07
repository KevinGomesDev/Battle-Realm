import React from "react";
import { useArena } from "../../features/arena";
import { Button } from "../Button";

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
              : "bg-mystic-deep/50 text-mystic-glow border border-mystic-blue/50"
          }`}
        >
          {currentLobby.status === "WAITING" && "⏳ Aguardando"}
          {currentLobby.status === "READY" && "✅ Pronto"}
          {currentLobby.status === "BATTLING" && "⚔️ Batalha"}
        </span>
        <span className="text-[10px] text-astral-steel">
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
                ? "border-mystic-sky/50 bg-mystic-deep/10"
                : "border-surface-500/30 bg-surface-800/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-b from-stellar-amber to-stellar-dark rounded flex items-center justify-center text-xs">
                👑
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-astral-chrome truncate">
                  {hostPlayer.username}
                </p>
                <p className="text-[10px] text-astral-steel truncate">
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
                ? "border-mystic-sky/50 bg-mystic-deep/10"
                : "border-surface-500/30 bg-surface-800/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-b from-red-500 to-red-800 rounded flex items-center justify-center text-xs">
                ⚔️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-astral-chrome truncate">
                  {player.username}
                </p>
                <p className="text-[10px] text-astral-steel truncate">
                  🏰 {player.kingdomName}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Slots vazios */}
        {waitingSlots > 0 && (
          <div className="p-2 rounded border border-dashed border-surface-500/30">
            <div className="flex items-center justify-center py-2">
              <p className="text-astral-steel text-xs flex items-center gap-1">
                <span className="animate-pulse">⏳</span> Aguardando{" "}
                {waitingSlots} oponente{waitingSlots > 1 ? "s" : ""}...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="xs"
          onClick={handleLeave}
          className="flex-1"
          icon="🚪"
        >
          Sair
        </Button>

        {isHost && (
          <Button
            variant="mystic"
            size="xs"
            onClick={handleStart}
            disabled={!canStart}
            className="flex-1"
            icon={canStart ? "⚔️" : "⏳"}
          >
            {canStart ? "Iniciar" : "Aguardar"}
          </Button>
        )}
      </div>
    </div>
  );
};
