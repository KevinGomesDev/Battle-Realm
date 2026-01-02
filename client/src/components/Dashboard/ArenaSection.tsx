import React, { useEffect, useState } from "react";
import { useArena } from "../../features/arena";
import { useKingdom } from "../../features/kingdom";
import { useSession } from "../../core";
import { useAuth } from "../../features/auth";
import type { ArenaLobby } from "../../features/arena/types/arena.types";

interface ArenaSectionProps {
  onLobbyCreated?: (lobbyId: string) => void;
  onLobbyJoined?: (lobbyId: string) => void;
}

/**
 * ArenaSection - Conteúdo da seção de arena (sem botão criar no corpo)
 */
export const ArenaSection: React.FC<ArenaSectionProps> = () => {
  const {
    state: { lobbies, isLoading, error },
    listLobbies,
    joinLobby,
    clearError,
  } = useArena();

  const {
    state: { kingdoms, isLoading: isLoadingKingdoms },
    loadKingdoms,
  } = useKingdom();

  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

  useEffect(() => {
    loadKingdoms().catch(console.error);
    listLobbies();
  }, [loadKingdoms, listLobbies]);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleJoinLobby = async (lobbyId: string) => {
    if (!selectedKingdom || !authState.user?.id) return;
    const canJoin = await canJoinSession(authState.user.id);
    if (!canJoin) {
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }
    setJoiningLobbyId(lobbyId);
    joinLobby(lobbyId, selectedKingdom);
    setTimeout(() => setJoiningLobbyId(null), 1000);
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-2">
      {/* Seletor de Reino */}
      <div className="bg-citadel-obsidian/30 border border-metal-iron/30 rounded p-2">
        <label className="block text-parchment-aged text-[10px] font-semibold mb-1 uppercase tracking-wider">
          Escolha seu Regente:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-parchment-dark text-xs flex items-center gap-1">
            <div className="animate-spin w-3 h-3 border border-metal-bronze border-t-transparent rounded-full" />
            Carregando...
          </div>
        ) : kingdoms.length === 0 ? (
          <div className="text-war-ember text-xs">
            ⚠️ Funde um reino primeiro
          </div>
        ) : (
          <select
            value={selectedKingdom}
            onChange={(e) => setSelectedKingdom(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-citadel-obsidian border border-metal-iron/50 rounded
                       text-parchment-light focus:outline-none focus:border-purple-500 transition-colors"
          >
            {kingdoms.map((kingdom) => (
              <option key={kingdom.id} value={kingdom.id}>
                {kingdom.name} • {kingdom.race}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="p-2 bg-war-blood/20 border border-war-crimson/50 rounded flex items-center justify-between">
          <p className="text-war-ember text-xs">⚠️ {error}</p>
          <button
            onClick={clearError}
            className="text-parchment-dark hover:text-parchment-light text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Divisor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-metal-iron/30" />
        <span className="text-parchment-dark text-[10px] uppercase tracking-wider">
          Arenas Abertas
        </span>
        <div className="flex-1 h-px bg-metal-iron/30" />
      </div>

      {/* Lista */}
      {isLoading && lobbies.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full" />
        </div>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-4 bg-citadel-slate/10 rounded border border-dashed border-metal-iron/20">
          <div className="text-xl mb-1">🏟️</div>
          <p className="text-parchment-dark text-xs">
            Nenhuma arena disponível
          </p>
          <p className="text-parchment-dark/60 text-[10px]">
            Crie uma para desafiar!
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {lobbies.map((lobby: ArenaLobby) => (
            <div
              key={lobby.lobbyId}
              className="flex items-center justify-between p-2 bg-citadel-slate/20 border border-metal-iron/20 rounded
                         hover:border-purple-500/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-parchment-light truncate flex items-center gap-1">
                  <span className="text-purple-400">🏟️</span>
                  {lobby.hostKingdomName}
                </div>
                <div className="text-[10px] text-parchment-dark">
                  {lobby.hostUsername} • {formatDate(lobby.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleJoinLobby(lobby.lobbyId)}
                disabled={joiningLobbyId === lobby.lobbyId || !selectedKingdom}
                className="px-2 py-1 text-[10px] font-semibold
                           bg-gradient-to-b from-purple-600 to-purple-800
                           border border-metal-iron/50 rounded
                           hover:from-purple-500 hover:to-purple-700
                           disabled:from-citadel-slate disabled:to-citadel-granite
                           text-parchment-light transition-all disabled:cursor-not-allowed"
              >
                {joiningLobbyId === lobby.lobbyId ? "..." : "⚔️ Desafiar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Hook para expor a função de criar arena para o header
 */
export const useArenaSectionActions = () => {
  const {
    state: { kingdoms },
  } = useKingdom();
  const { createLobby } = useArena();
  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleCreate = async () => {
    if (!selectedKingdom || !authState.user?.id) {
      alert("Selecione um reino primeiro");
      return;
    }
    const canJoin = await canJoinSession(authState.user.id);
    if (!canJoin) {
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }
    setIsCreating(true);
    createLobby(selectedKingdom);
    setTimeout(() => setIsCreating(false), 1000);
  };

  return {
    handleCreate,
    isCreating,
    hasKingdoms: kingdoms.length > 0,
    selectedKingdom,
  };
};
