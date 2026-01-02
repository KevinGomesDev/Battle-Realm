import React, { useEffect, useState } from "react";
import { useMatch } from "../../features/match";
import { useKingdom } from "../../features/kingdom";
import { useSession } from "../../core";
import { useAuth } from "../../features/auth";
import type { OpenMatch } from "../../features/match";

interface MatchSectionProps {
  onMatchJoined?: (matchId: string) => void;
}

/**
 * MatchSection - Conteúdo da seção de partidas (sem botão criar no corpo)
 */
export const MatchSection: React.FC<MatchSectionProps> = ({
  onMatchJoined,
}) => {
  const {
    state: { kingdoms, isLoading: isLoadingKingdoms },
    loadKingdoms,
  } = useKingdom();

  const {
    state: { openMatches, isLoading, error },
    listOpenMatches,
    joinMatch,
  } = useMatch();

  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    loadKingdoms().catch(console.error);
    listOpenMatches().catch(console.error);
  }, [loadKingdoms, listOpenMatches]);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleJoinMatch = async (matchId: string) => {
    if (!selectedKingdom) {
      setLocalError("Selecione um reino primeiro");
      return;
    }
    if (authState.user?.id) {
      const canJoin = await canJoinSession(authState.user.id);
      if (!canJoin) {
        setLocalError(
          sessionState.canJoinReason || "Você já está em uma sessão ativa"
        );
        return;
      }
    }
    setIsJoining(matchId);
    setLocalError(null);
    try {
      await joinMatch(matchId, selectedKingdom);
      onMatchJoined?.(matchId);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao entrar na partida");
    } finally {
      setIsJoining(null);
    }
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

  const displayError = localError || error;

  return (
    <div className="space-y-2">
      {/* Seletor de Reino */}
      <div className="bg-citadel-obsidian/30 border border-metal-iron/30 rounded p-2">
        <label className="block text-parchment-aged text-[10px] font-semibold mb-1 uppercase tracking-wider">
          Escolha seu Domínio:
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
                       text-parchment-light focus:outline-none focus:border-metal-bronze transition-colors"
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
      {displayError && (
        <div className="p-2 bg-war-blood/20 border border-war-crimson/50 rounded">
          <p className="text-war-ember text-xs">⚠️ {displayError}</p>
        </div>
      )}

      {/* Divisor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-metal-iron/30" />
        <span className="text-parchment-dark text-[10px] uppercase tracking-wider">
          Guerras Ativas
        </span>
        <div className="flex-1 h-px bg-metal-iron/30" />
      </div>

      {/* Lista */}
      {isLoading && openMatches.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-war-crimson border-t-transparent rounded-full" />
        </div>
      ) : openMatches.length === 0 ? (
        <div className="text-center py-4 bg-citadel-slate/10 rounded border border-dashed border-metal-iron/20">
          <div className="text-xl mb-1">🏰</div>
          <p className="text-parchment-dark text-xs">
            Nenhuma guerra em andamento
          </p>
          <p className="text-parchment-dark/60 text-[10px]">
            Crie uma partida para iniciar!
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {openMatches.map((match: OpenMatch) => (
            <div
              key={match.id}
              className="flex items-center justify-between p-2 bg-citadel-slate/20 border border-metal-iron/20 rounded
                         hover:border-war-crimson/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-parchment-light truncate">
                  {match.kingdomName}
                </div>
                <div className="text-[10px] text-parchment-dark">
                  {match.hostName} • {formatDate(match.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleJoinMatch(match.id)}
                disabled={isJoining === match.id || !selectedKingdom}
                className="px-2 py-1 text-[10px] font-semibold
                           bg-gradient-to-b from-war-crimson to-war-blood
                           border border-metal-iron/50 rounded
                           hover:from-war-ember hover:to-war-crimson
                           disabled:from-citadel-slate disabled:to-citadel-granite
                           text-parchment-light transition-all disabled:cursor-not-allowed"
              >
                {isJoining === match.id ? "..." : "⚔️ Entrar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Hook para expor a função de criar partida para o header
 */
export const useMatchSectionActions = () => {
  const {
    state: { kingdoms },
  } = useKingdom();
  const { createMatch } = useMatch();
  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleCreate = async (onSuccess?: (matchId: string) => void) => {
    if (!selectedKingdom) {
      alert("Selecione um reino primeiro");
      return;
    }
    if (authState.user?.id) {
      const canJoin = await canJoinSession(authState.user.id);
      if (!canJoin) {
        alert(sessionState.canJoinReason || "Você já está em uma sessão ativa");
        return;
      }
    }
    setIsCreating(true);
    try {
      const result = await createMatch(selectedKingdom);
      onSuccess?.(result.matchId);
    } catch (err: any) {
      alert(err.message || "Erro ao criar partida");
    } finally {
      setIsCreating(false);
    }
  };

  return {
    handleCreate,
    isCreating,
    hasKingdoms: kingdoms.length > 0,
    selectedKingdom,
  };
};
