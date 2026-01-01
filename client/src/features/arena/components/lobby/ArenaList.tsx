import React, { useEffect, useState } from "react";
import { useArena } from "../../hooks/useArena";
import { useKingdom } from "../../../kingdom";
import { useSession } from "../../../../core";
import { useAuth } from "../../../auth";
import type { ArenaLobby } from "../../types/arena.types";

interface ArenaListProps {
  onLobbyCreated?: (lobbyId: string) => void;
  onLobbyJoined?: (lobbyId: string) => void;
}

/**
 * Lista de Arenas - Estilo Cidadela de Pedra
 * Permite criar e entrar em arenas de combate PvP
 */
export const ArenaList: React.FC<ArenaListProps> = () => {
  const {
    state: { lobbies, isLoading, error },
    createLobby,
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
  const [isCreating, setIsCreating] = useState(false);
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

  // Carregar reinos e lobbies ao montar
  useEffect(() => {
    loadKingdoms().catch(console.error);
    listLobbies();
  }, [loadKingdoms, listLobbies]);

  // Selecionar primeiro reino por padrão
  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      // Preferir reino com regente
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleRefresh = () => {
    listLobbies();
  };

  const handleCreateLobby = async () => {
    if (!selectedKingdom || !authState.user?.id) return;

    console.log(
      "%c[ArenaList] 🎮 Criando lobby...",
      "color: #f59e0b; font-weight: bold;",
      { selectedKingdom, userId: authState.user.id }
    );

    // Verificar se pode entrar em nova sessão
    const canJoin = await canJoinSession(authState.user.id);
    if (!canJoin) {
      console.log(
        "%c[ArenaList] ❌ Não pode criar lobby - sessão ativa",
        "color: #ef4444;",
        sessionState.canJoinReason
      );
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }

    console.log("%c[ArenaList] ✅ Pode criar lobby", "color: #22c55e;");
    setIsCreating(true);
    createLobby(selectedKingdom);
    setTimeout(() => setIsCreating(false), 1000);
  };

  const handleJoinLobby = async (lobbyId: string) => {
    if (!selectedKingdom || !authState.user?.id) return;

    console.log(
      "%c[ArenaList] 🚪 Entrando no lobby...",
      "color: #f59e0b; font-weight: bold;",
      { lobbyId, selectedKingdom, userId: authState.user.id }
    );

    // Verificar se pode entrar em nova sessão
    const canJoin = await canJoinSession(authState.user.id);
    if (!canJoin) {
      console.log(
        "%c[ArenaList] ❌ Não pode entrar - sessão ativa",
        "color: #ef4444;",
        sessionState.canJoinReason
      );
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }

    console.log("%c[ArenaList] ✅ Pode entrar no lobby", "color: #22c55e;");
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
    <div className="space-y-5">
      {/* Seletor de Reino */}
      <div className="bg-citadel-slate/50 border-2 border-metal-iron/50 rounded-lg p-4">
        <label className="block text-parchment-aged text-sm font-semibold mb-2 tracking-wide">
          Escolha seu Regente para a Arena:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-parchment-dark text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-metal-bronze border-t-transparent rounded-full"></div>
            Consultando registros...
          </div>
        ) : kingdoms.length === 0 ? (
          <div className="text-war-ember text-sm flex items-center gap-2">
            <span>⚠️</span> Funde um reino com Regente antes de entrar na arena
          </div>
        ) : (
          <select
            value={selectedKingdom}
            onChange={(e) => setSelectedKingdom(e.target.value)}
            className="w-full px-4 py-3 bg-citadel-obsidian border-2 border-metal-iron rounded-lg 
                       text-parchment-light focus:outline-none focus:border-metal-bronze 
                       transition-colors cursor-pointer"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {kingdoms.map((kingdom) => (
              <option key={kingdom.id} value={kingdom.id}>
                {kingdom.name} • {kingdom.race} • {kingdom.alignment}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="p-3 bg-war-blood/20 border-2 border-war-crimson rounded-lg flex items-center justify-between">
          <p className="text-war-ember text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </p>
          <button
            onClick={clearError}
            className="text-parchment-dark hover:text-parchment-light text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Criar Arena */}
        <button
          onClick={handleCreateLobby}
          disabled={isCreating || !selectedKingdom || kingdoms.length === 0}
          className="group relative px-6 py-4 bg-gradient-to-b from-purple-700 to-purple-900 
                     border-3 border-metal-iron rounded-lg shadow-forge-glow
                     hover:from-purple-600 hover:to-purple-800
                     disabled:from-citadel-granite disabled:to-citadel-carved disabled:shadow-none
                     active:animate-stone-press transition-all duration-200
                     disabled:cursor-not-allowed"
        >
          <div className="absolute top-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
          <div className="absolute top-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>

          {isCreating ? (
            <span className="relative text-parchment-light font-bold tracking-wide flex items-center justify-center gap-2">
              <div className="animate-spin w-5 h-5 border-2 border-parchment-light border-t-transparent rounded-full"></div>
              Preparando...
            </span>
          ) : (
            <span
              className="relative text-parchment-light font-bold tracking-wide flex items-center justify-center gap-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              🏟️ CRIAR ARENA
            </span>
          )}
        </button>

        {/* Atualizar Lista */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="group relative px-6 py-4 bg-gradient-to-b from-citadel-granite to-citadel-carved 
                     border-2 border-metal-iron rounded-lg shadow-stone-raised
                     hover:from-citadel-weathered hover:to-citadel-granite
                     disabled:opacity-50 transition-all duration-200"
        >
          <span className="text-parchment-aged font-semibold flex items-center justify-center gap-2">
            <span className={isLoading ? "animate-spin" : ""}>🔄</span>
            Atualizar Arenas
          </span>
        </button>
      </div>

      {/* Divisor */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-metal-iron to-transparent"></div>
        <span className="text-parchment-dark text-xs tracking-widest uppercase">
          Arenas Abertas
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-metal-iron to-transparent"></div>
      </div>

      {/* Lista de Arenas */}
      {isLoading && lobbies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-3 border-purple-600 rounded-full animate-spin border-t-transparent"></div>
            <div
              className="absolute inset-2 border-2 border-purple-400 rounded-full animate-spin border-b-transparent"
              style={{ animationDirection: "reverse" }}
            ></div>
          </div>
          <p className="text-parchment-dark mt-4">Procurando arenas...</p>
        </div>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-8 bg-citadel-slate/20 rounded-xl border-2 border-dashed border-metal-iron/30">
          <div className="text-5xl mb-4">🏟️</div>
          <p className="text-parchment-dark">Nenhuma arena disponível</p>
          <p className="text-parchment-dark/60 text-sm mt-1">
            Crie uma arena para desafiar outros Regentes!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lobbies.map((lobby: ArenaLobby) => (
            <div
              key={lobby.lobbyId}
              className="group relative bg-gradient-to-b from-citadel-granite to-citadel-carved 
                         border-2 border-metal-iron rounded-lg p-4 
                         hover:border-purple-600 hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]
                         transition-all duration-300 shadow-stone-raised"
            >
              {/* Rebites */}
              <div className="absolute top-2 left-2 w-2 h-2 bg-metal-iron rounded-full border border-metal-rust/30"></div>
              <div className="absolute top-2 right-2 w-2 h-2 bg-metal-iron rounded-full border border-metal-rust/30"></div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400">🏟️</span>
                    <span
                      className="text-parchment-light font-bold"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {lobby.hostKingdomName}
                    </span>
                    <span className="text-parchment-dark text-sm">
                      • {lobby.hostUsername}
                    </span>
                  </div>
                  <div className="text-metal-steel text-xs">
                    📜 Criada em {formatDate(lobby.createdAt)}
                  </div>
                </div>

                <button
                  onClick={() => handleJoinLobby(lobby.lobbyId)}
                  disabled={
                    joiningLobbyId === lobby.lobbyId || !selectedKingdom
                  }
                  className="px-4 py-2 bg-gradient-to-b from-purple-700 to-purple-900 
                             border-2 border-metal-iron rounded-lg
                             hover:from-purple-600 hover:to-purple-800
                             disabled:from-citadel-granite disabled:to-citadel-carved
                             text-parchment-light font-semibold transition-all
                             disabled:text-parchment-dark disabled:cursor-not-allowed"
                >
                  {joiningLobbyId === lobby.lobbyId ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-parchment-light border-t-transparent rounded-full"></div>
                    </span>
                  ) : (
                    <span>⚔️ Desafiar</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
