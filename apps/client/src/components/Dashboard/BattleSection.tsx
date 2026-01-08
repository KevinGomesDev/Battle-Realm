import React, { useEffect, useState, createContext, useContext } from "react";
import { useBattle } from "../../features/battle";
import { useKingdom } from "../../features/kingdom";
import { useSession } from "../../core";
import { useAuth } from "../../features/auth";

// Interface para os dados do lobby vindos do store
interface BattleLobbyData {
  lobbyId: string;
  hostUserId: string;
  hostUsername: string;
  hostKingdomId: string;
  hostKingdomName: string;
  maxPlayers: number;
  currentPlayers: number;
  vsBot: boolean;
  status: string;
  createdAt: string;
}

// === CONTEXTO PARA ESTADO COMPARTILHADO ===
interface BattleSelectionContextValue {
  selectedKingdom: string;
  setSelectedKingdom: (id: string) => void;
  vsBot: boolean;
  setVsBot: (value: boolean) => void;
}

const BattleSelectionContext =
  createContext<BattleSelectionContextValue | null>(null);

/**
 * Provider para compartilhar estado de seleção entre BattleSection e o botão de criar
 */
export const BattleSelectionProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const {
    state: { kingdoms },
  } = useKingdom();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [vsBot, setVsBot] = useState(false);

  // Auto-selecionar primeiro reino quando carrega
  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  return (
    <BattleSelectionContext.Provider
      value={{ selectedKingdom, setSelectedKingdom, vsBot, setVsBot }}
    >
      {children}
    </BattleSelectionContext.Provider>
  );
};

const useBattleSelection = () => {
  const ctx = useContext(BattleSelectionContext);
  if (!ctx) {
    throw new Error(
      "useBattleSelection must be used within BattleSelectionProvider"
    );
  }
  return ctx;
};

interface BattleSectionProps {
  onLobbyCreated?: (lobbyId: string) => void;
  onLobbyJoined?: (lobbyId: string) => void;
}

/**
 * BattleSection - Conteúdo da seção de battle (sem botão criar no corpo)
 */
export const BattleSection: React.FC<BattleSectionProps> = () => {
  const {
    state: { lobbies, isLoading, error },
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

  // Usar contexto compartilhado para o reino selecionado
  const { selectedKingdom, setSelectedKingdom } = useBattleSelection();
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null);

  useEffect(() => {
    // Só carregar se servidor validou autenticação
    if (authState.isServerValidated) {
      loadKingdoms().catch(console.error);
      listLobbies();
    }
  }, [authState.isServerValidated, loadKingdoms, listLobbies]);

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
      <div className="bg-surface-800/30 border border-surface-500/30 rounded p-2">
        <label className="block text-astral-silver text-[10px] font-semibold mb-1 uppercase tracking-wider">
          Escolha seu Regente:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-astral-steel text-xs flex items-center gap-1">
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
                       text-astral-chrome focus:outline-none focus:border-mystic-blue transition-colors"
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
        <div className="p-2 bg-red-500/20 border border-red-500/50 rounded flex items-center justify-between">
          <p className="text-red-400 text-xs">⚠️ {error}</p>
          <button
            onClick={clearError}
            className="text-astral-steel hover:text-astral-chrome text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Divisor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-500/30" />
        <span className="text-astral-steel text-[10px] uppercase tracking-wider">
          Battles Abertas
        </span>
        <div className="flex-1 h-px bg-surface-500/30" />
      </div>

      {/* Lista */}
      {isLoading && lobbies.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-mystic-blue border-t-transparent rounded-full" />
        </div>
      ) : lobbies.length === 0 ? (
        <div className="text-center py-4 bg-surface-800/30 rounded border border-dashed border-surface-500/20">
          <div className="text-xl mb-1">🏟️</div>
          <p className="text-astral-silver text-xs">
            Nenhuma Batalha disponível
          </p>
          <p className="text-astral-steel text-[10px]">
            Crie uma para desafiar!
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {lobbies.map((lobby: BattleLobbyData) => (
            <div
              key={lobby.lobbyId}
              className="flex items-center justify-between p-2 bg-surface-800/30 border border-surface-500/20 rounded
                         hover:border-mystic-blue/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-astral-chrome truncate flex items-center gap-1">
                  <span className="text-mystic-glow">🏟️</span>
                  {lobby.hostKingdomName}
                </div>
                <div className="text-[10px] text-astral-steel">
                  {lobby.hostUsername} • {formatDate(lobby.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleJoinLobby(lobby.lobbyId)}
                disabled={joiningLobbyId === lobby.lobbyId || !selectedKingdom}
                className="px-2 py-1 text-[10px] font-semibold
                           bg-linear-to-b from-mystic-blue to-mystic-deep
                           border border-surface-500/50 rounded
                           hover:from-mystic-glow hover:to-mystic-blue
                           disabled:from-surface-700 disabled:to-surface-800
                           text-white transition-all disabled:cursor-not-allowed"
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
 * Hook para expor a função de criar batalha para o header
 * DEVE ser usado dentro do BattleSelectionProvider
 */
export const useBattleSectionActions = () => {
  const {
    state: { kingdoms },
  } = useKingdom();
  const { createLobby } = useBattle();
  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  // Usar contexto compartilhado para o reino selecionado e vsBot
  const { selectedKingdom, vsBot, setVsBot } = useBattleSelection();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    console.log("[BattleSection] handleCreate called", {
      selectedKingdom,
      hasKingdoms: kingdoms.length > 0,
      vsBot,
    });
    if (!selectedKingdom || !authState.user?.id) {
      alert("Selecione um reino primeiro");
      return;
    }
    const canJoin = await canJoinSession(authState.user.id);
    console.log("[BattleSection] canJoinSession result:", canJoin);
    if (!canJoin) {
      alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
      return;
    }
    console.log(
      "[BattleSection] Creating lobby with kingdom:",
      selectedKingdom,
      "vsBot:",
      vsBot
    );
    setIsCreating(true);
    createLobby(selectedKingdom, { vsBot });
    setTimeout(() => setIsCreating(false), 1000);
  };

  return {
    handleCreate,
    isCreating,
    hasKingdoms: kingdoms.length > 0,
    selectedKingdom,
    vsBot,
    setVsBot,
  };
};
