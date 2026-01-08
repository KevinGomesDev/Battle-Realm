import React, { useEffect, useState } from "react";
import { useBattle } from "../../hooks/useBattle";
import { useKingdom } from "../../../kingdom";
import { useSession } from "../../../../core";
import { useAuth } from "../../../auth";
import type { BattleLobby } from "../../types/battle.types";

interface BattleListProps {
  onLobbyCreated?: (lobbyId: string) => void;
  onLobbyJoined?: (lobbyId: string) => void;
}

/**
 * Lista de Batalhas - Compacta
 */
export const BattleList: React.FC<BattleListProps> = () => {
  const {
    state: { lobbies, isLoading, error },
    createLobby,
    listLobbies,
    joinLobby,
    clearError,
  } = useBattle();

  const {
    state: { kingdoms, isLoading: isLoadingKingdoms },
    loadKingdoms,
  } = useKingdom();

  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

  useEffect(() => {
    // Só carregar se servidor validou autenticação
    if (authState.isServerValidated) {
      loadKingdoms().catch(console.error);
      listLobbies();
    }
  }, [authState.isServerValidated, loadKingdoms, listLobbies]);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleCreateLobby = async () => {
    if (!selectedKingdom || !authState.user?.id) return;
    const canJoin = await canJoinSession(authState.user.id);
    if (!canJoin) {
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }
    setIsCreating(true);
    createLobby(selectedKingdom);
    setTimeout(() => setIsCreating(false), 1000);
  };

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
    <div className="space-y-3">
      {/* Seletor de Reino - Compacto */}
      <div className="bg-surface-900/30 border border-surface-500/30 rounded p-2">
        <label className="block text-surface-300 text-[10px] font-semibold mb-1 uppercase tracking-wider">
          Escolha seu Regente:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-surface-400 text-xs flex items-center gap-1">
            <div className="animate-spin w-3 h-3 border border-stellar-amber border-t-transparent rounded-full" />
            Carregando...
          </div>
        ) : kingdoms.length === 0 ? (
          <div className="text-red-400 text-xs">⚠️ Funde um reino primeiro</div>
        ) : (
          <select
            value={selectedKingdom}
            onChange={(e) => setSelectedKingdom(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-surface-900 border border-surface-500/50 rounded
                       text-astral-chrome focus:outline-none focus:border-mystic-sky transition-colors"
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
        <div className="p-2 bg-red-900/20 border border-red-600/50 rounded flex items-center justify-between">
          <p className="text-red-400 text-xs">⚠️ {error}</p>
          <button
            onClick={clearError}
            className="text-surface-400 hover:text-astral-chrome text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Botão Criar */}
      <button
        onClick={handleCreateLobby}
        disabled={isCreating || !selectedKingdom || kingdoms.length === 0}
        className="w-full py-2 text-xs font-bold uppercase tracking-wider
                   bg-gradient-to-b from-mystic-blue to-mystic-deep
                   border border-surface-500 rounded
                   hover:from-mystic-sky hover:to-mystic-blue
                   disabled:from-surface-800 disabled:to-surface-700 disabled:text-surface-400
                   text-astral-chrome transition-all disabled:cursor-not-allowed"
      >
        {isCreating ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full" />
            Criando...
          </span>
        ) : (
          "⛔️ Criar Batalha"
        )}
      </button>

      {/* Divisor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-500/30" />
        <span className="text-surface-400 text-[10px] uppercase tracking-wider">
          Batalhas Abertas
        </span>
        <div className="flex-1 h-px bg-surface-500/30" />
      </div>

      {/* Lista */}
      {isLoading && lobbies.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-mystic-blue border-t-transparent rounded-full" />
        </div>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-4 bg-surface-800/10 rounded border border-dashed border-surface-500/20">
          <div className="text-xl mb-1">🏟️</div>
          <p className="text-surface-400 text-xs">Nenhuma batalha disponível</p>
          <p className="text-surface-400/60 text-[10px]">
            Crie uma para desafiar!
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {lobbies.map((lobby: BattleLobby) => (
            <div
              key={lobby.lobbyId}
              className="flex items-center justify-between p-2 bg-surface-800/20 border border-surface-500/20 rounded
                         hover:border-mystic-sky/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-astral-chrome truncate flex items-center gap-1">
                  <span className="text-mystic-glow">🏟️</span>
                  {lobby.hostKingdomName}
                </div>
                <div className="text-[10px] text-surface-400">
                  {lobby.hostUsername} • {formatDate(lobby.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleJoinLobby(lobby.lobbyId)}
                disabled={joiningLobbyId === lobby.lobbyId || !selectedKingdom}
                className="px-2 py-1 text-[10px] font-semibold
                           bg-gradient-to-b from-mystic-blue to-mystic-deep
                           border border-surface-500/50 rounded
                           hover:from-mystic-sky hover:to-mystic-blue
                           disabled:from-surface-800 disabled:to-surface-700
                           text-astral-chrome transition-all disabled:cursor-not-allowed"
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
