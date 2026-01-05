import React from "react";
import { useArena } from "../../hooks/useArena";

interface ArenaLobbyViewProps {
  onBattleStart?: () => void;
  onLeave?: () => void;
}

/**
 * Lobby da Arena - Sala de espera para batalha PvP
 */
export const ArenaLobbyView: React.FC<ArenaLobbyViewProps> = ({
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
    console.log(
      "%c[ArenaLobbyView] 🚪 Saindo do lobby...",
      "color: #f59e0b; font-weight: bold;",
      {
        lobbyId: currentLobby?.lobbyId,
        isHost,
      }
    );
    leaveLobby();
    onLeave?.();
  };

  const handleStart = () => {
    console.log(
      "%c[ArenaLobbyView] ⚔️ Iniciando batalha!",
      "color: #ef4444; font-weight: bold; font-size: 14px;",
      {
        lobbyId: currentLobby?.lobbyId,
        players: currentLobby?.players.map((p) => p.username),
        status: currentLobby?.status,
      }
    );
    startBattle();
    onBattleStart?.();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Lobby */}
      <div className="text-center py-4">
        <h3
          className="text-2xl font-bold text-parchment-light tracking-wider"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          🏟️ ARENA DE COMBATE
        </h3>
        <p className="text-parchment-dark text-sm mt-1">
          {isHost ? "Aguardando desafiantes..." : "Preparando para batalha..."}
        </p>
        <p className="text-parchment-aged text-xs mt-1">
          {currentLobby.players.length}/{currentLobby.maxPlayers} jogadores
        </p>
      </div>

      {/* Status do Lobby */}
      <div className="flex items-center justify-center gap-2">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            currentLobby.status === "WAITING"
              ? "bg-yellow-900/50 text-yellow-400 border border-yellow-600"
              : currentLobby.status === "READY"
              ? "bg-green-900/50 text-green-400 border border-green-600"
              : currentLobby.status === "BATTLING"
              ? "bg-purple-900/50 text-purple-400 border border-purple-600"
              : "bg-citadel-slate text-parchment-dark border border-metal-iron"
          }`}
        >
          {currentLobby.status === "WAITING" && "⏳ Aguardando"}
          {currentLobby.status === "READY" && "✅ Pronto"}
          {currentLobby.status === "BATTLING" && "⚔️ Em Batalha"}
          {currentLobby.status === "ENDED" && "🏁 Finalizado"}
        </span>
      </div>

      {/* Jogadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Host */}
        {hostPlayer && (
          <div
            className={`p-4 rounded-xl border-2 ${
              isHost
                ? "border-purple-600 bg-purple-900/20"
                : "border-metal-iron bg-citadel-slate/30"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-b from-metal-bronze to-metal-copper rounded-lg border-2 border-metal-iron flex items-center justify-center">
                <span className="text-2xl">👑</span>
              </div>
              <div>
                <p className="text-xs text-parchment-dark uppercase tracking-wider">
                  Anfitrião
                </p>
                <p
                  className="text-parchment-light font-bold"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {hostPlayer.username}
                </p>
              </div>
            </div>
            <div className="bg-citadel-obsidian/50 rounded-lg p-3">
              <p className="text-parchment-aged text-sm">
                🏰 {hostPlayer.kingdomName}
              </p>
            </div>
          </div>
        )}

        {/* Outros jogadores */}
        {otherPlayers.map((player) => (
          <div
            key={player.userId}
            className={`p-4 rounded-xl border-2 ${
              player.userId === currentLobby.hostUserId
                ? "border-purple-600 bg-purple-900/20"
                : "border-metal-iron bg-citadel-slate/30"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-b from-war-crimson to-war-blood rounded-lg border-2 border-metal-iron flex items-center justify-center">
                <span className="text-2xl">⚔️</span>
              </div>
              <div>
                <p className="text-xs text-parchment-dark uppercase tracking-wider">
                  Desafiante {player.playerIndex}
                </p>
                <p
                  className="text-parchment-light font-bold"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {player.username}
                </p>
              </div>
            </div>
            <div className="bg-citadel-obsidian/50 rounded-lg p-3">
              <p className="text-parchment-aged text-sm">
                🏰 {player.kingdomName}
              </p>
            </div>
          </div>
        ))}

        {/* Slots vazios */}
        {Array.from({ length: waitingSlots }).map((_, idx) => (
          <div
            key={`waiting-${idx}`}
            className="p-4 rounded-xl border-2 border-dashed border-metal-iron bg-citadel-slate/30"
          >
            <div className="flex flex-col items-center justify-center h-full py-6">
              <div className="w-12 h-12 border-2 border-dashed border-metal-iron/50 rounded-lg flex items-center justify-center mb-3">
                <span className="text-2xl opacity-50">❓</span>
              </div>
              <p className="text-parchment-dark text-sm">
                Aguardando oponente...
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <div
                  className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-metal-iron/30">
        {/* Sair */}
        <button
          onClick={handleLeave}
          className="flex-1 px-6 py-3 bg-gradient-to-b from-citadel-granite to-citadel-carved 
                     border-2 border-metal-iron rounded-lg
                     hover:from-citadel-weathered hover:to-citadel-granite
                     text-parchment-aged font-semibold transition-all"
        >
          🚪 Sair do Lobby
        </button>

        {/* Iniciar (apenas host quando pronto) */}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex-1 px-6 py-3 rounded-lg border-2 font-bold transition-all ${
              canStart
                ? "bg-gradient-to-b from-purple-700 to-purple-900 border-purple-500 text-parchment-light hover:from-purple-600 hover:to-purple-800 shadow-[0_0_20px_rgba(147,51,234,0.4)]"
                : "bg-gradient-to-b from-citadel-granite to-citadel-carved border-metal-iron text-parchment-dark cursor-not-allowed"
            }`}
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {canStart ? "⚔️ INICIAR BATALHA" : "⏳ Aguardando..."}
          </button>
        )}
      </div>

      {/* Informação extra */}
      <div className="text-center">
        <p className="text-parchment-dark/60 text-xs">
          💡 A batalha ocorrerá em um grid 20x20. Cada Regente terá 3 marcas de
          ação.
        </p>
      </div>
    </div>
  );
};
