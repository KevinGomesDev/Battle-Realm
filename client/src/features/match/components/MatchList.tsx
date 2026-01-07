import React, { useEffect, useState } from "react";
import { useMatch } from "../hooks/useMatch";
import { useKingdom } from "../../kingdom";
import { useSession } from "../../../core";
import { useAuth } from "../../auth";

interface MatchListProps {
  onMatchJoined?: (matchId: string) => void;
  onMatchCreated?: (matchId: string) => void;
}

export const MatchList: React.FC<MatchListProps> = ({
  onMatchJoined,
  onMatchCreated,
}) => {
  const {
    state: { kingdoms, isLoading: isLoadingKingdoms },
    loadKingdoms,
  } = useKingdom();

  const {
    state: { openMatches, isLoading, error },
    listOpenMatches,
    createMatch,
    joinMatch,
  } = useMatch();

  const { canJoinSession, state: sessionState } = useSession();
  const { state: authState } = useAuth();

  const [selectedKingdom, setSelectedKingdom] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // Só carregar se servidor validou autenticação
    if (authState.isServerValidated) {
      loadKingdoms().catch(console.error);
      listOpenMatches().catch(console.error);
    }
  }, [authState.isServerValidated, loadKingdoms, listOpenMatches]);

  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleCreateMatch = async () => {
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
    setIsCreating(true);
    setLocalError(null);
    try {
      const result = await createMatch(selectedKingdom);
      onMatchCreated?.(result.matchId);
    } catch (err: any) {
      setLocalError(err.message || "Erro ao criar partida");
    } finally {
      setIsCreating(false);
    }
  };

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
    <div className="space-y-3">
      {/* Seletor de Reino - Compacto */}
      <div className="bg-cosmos-deep/30 border border-surface-500/30 rounded p-2">
        <label className="block text-astral-silver text-[10px] font-semibold mb-1 uppercase tracking-wider">
          Escolha seu Reino:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-surface-200 text-xs flex items-center gap-1">
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
                       text-astral-chrome focus:outline-none focus:border-stellar-amber/50 transition-colors"
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
        <div className="p-2 bg-red-900/20 border border-red-500/50 rounded">
          <p className="text-red-400 text-xs">⚠️ {displayError}</p>
        </div>
      )}

      {/* Botão Criar */}
      <button
        onClick={handleCreateMatch}
        disabled={isCreating || !selectedKingdom || kingdoms.length === 0}
        className="w-full py-2 text-xs font-bold uppercase tracking-wider
                   bg-gradient-to-b from-red-600 to-red-800
                   border border-surface-500/50 rounded
                   hover:from-red-500 hover:to-red-700
                   disabled:from-surface-700 disabled:to-surface-800 disabled:text-surface-300
                   text-white transition-all disabled:cursor-not-allowed"
      >
        {isCreating ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full" />
            Preparando...
          </span>
        ) : (
          "Criar Partida"
        )}
      </button>

      {/* Divisor */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-500/30" />
        <span className="text-surface-200 text-[10px] uppercase tracking-wider">
          Guerras Ativas
        </span>
        <div className="flex-1 h-px bg-surface-500/30" />
      </div>

      {/* Lista */}
      {isLoading && openMatches.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : openMatches.length === 0 ? (
        <div className="text-center py-4 bg-surface-800/10 rounded border border-dashed border-surface-500/20">
          <div className="text-xl mb-1">🏰</div>
          <p className="text-astral-steel text-xs">
            Nenhuma guerra em andamento
          </p>
          <p className="text-astral-steel/60 text-[10px]">
            Declare guerra para iniciar!
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {openMatches.map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between p-2 bg-surface-800/20 border border-surface-500/20 rounded
                         hover:border-red-500/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-astral-chrome truncate">
                  {match.kingdomName}
                </div>
                <div className="text-[10px] text-astral-steel">
                  {match.hostName} • {formatDate(match.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleJoinMatch(match.id)}
                disabled={isJoining === match.id || !selectedKingdom}
                className="px-2 py-1 text-[10px] font-semibold
                           bg-gradient-to-b from-red-500 to-red-800
                           border border-surface-500/50 rounded
                           hover:from-red-400 hover:to-red-500
                           disabled:from-surface-800 disabled:to-surface-700
                           text-astral-chrome transition-all disabled:cursor-not-allowed"
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
