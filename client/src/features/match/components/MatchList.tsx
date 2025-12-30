import React, { useEffect, useState } from "react";
import { useMatch } from "../hooks/useMatch";
import { useKingdom } from "../../kingdom";
import { useSession } from "../../../core";
import { useAuth } from "../../auth";
import type { OpenMatch } from "../types/match.types";

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

  // Carregar reinos e partidas ao montar
  useEffect(() => {
    loadKingdoms().catch(console.error);
    listOpenMatches().catch(console.error);
  }, [loadKingdoms, listOpenMatches]);

  // Selecionar primeiro reino por padrão
  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdom) {
      setSelectedKingdom(kingdoms[0].id);
    }
  }, [kingdoms, selectedKingdom]);

  const handleRefresh = async () => {
    try {
      await listOpenMatches();
    } catch (err) {
      console.error("Erro ao atualizar lista:", err);
    }
  };

  const handleCreateMatch = async () => {
    if (!selectedKingdom) {
      setLocalError("Selecione um reino primeiro");
      return;
    }

    // Verificar se pode entrar em nova sessão
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

    // Verificar se pode entrar em nova sessão
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
    <div className="space-y-5">
      {/* Seletor de Reino - Estilo Pergaminho */}
      <div className="bg-citadel-slate/50 border-2 border-metal-iron/50 rounded-lg p-4">
        <label className="block text-parchment-aged text-sm font-semibold mb-2 tracking-wide">
          Escolha seu Domínio para a Batalha:
        </label>
        {isLoadingKingdoms ? (
          <div className="text-parchment-dark text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-metal-bronze border-t-transparent rounded-full"></div>
            Consultando registros...
          </div>
        ) : kingdoms.length === 0 ? (
          <div className="text-war-ember text-sm flex items-center gap-2">
            <span>⚠️</span> Funde um reino antes de entrar em batalha
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
      {displayError && (
        <div className="p-3 bg-war-blood/20 border-2 border-war-crimson rounded-lg">
          <p className="text-war-ember text-sm flex items-center gap-2">
            <span>⚠️</span> {displayError}
          </p>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Criar Partida */}
        <button
          onClick={handleCreateMatch}
          disabled={isCreating || !selectedKingdom || kingdoms.length === 0}
          className="group relative px-6 py-4 bg-gradient-to-b from-war-crimson to-war-blood 
                     border-3 border-metal-iron rounded-lg shadow-forge-glow
                     hover:from-war-ember hover:to-war-crimson
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
              ⚔️ DECLARAR GUERRA
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
            Atualizar Vigias
          </span>
        </button>
      </div>

      {/* Divisor */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-metal-iron to-transparent"></div>
        <span className="text-parchment-dark text-xs tracking-widest uppercase">
          Guerras Ativas
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-metal-iron to-transparent"></div>
      </div>

      {/* Lista de Partidas */}
      {isLoading && openMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-3 border-war-crimson rounded-full animate-spin border-t-transparent"></div>
            <div
              className="absolute inset-2 border-2 border-war-ember rounded-full animate-spin border-b-transparent"
              style={{ animationDirection: "reverse" }}
            ></div>
          </div>
          <p className="text-parchment-dark mt-4">Batedores procurando...</p>
        </div>
      ) : openMatches.length === 0 ? (
        <div className="text-center py-8 bg-citadel-slate/20 rounded-xl border-2 border-dashed border-metal-iron/30">
          <div className="text-5xl mb-4">🏰</div>
          <p className="text-parchment-dark">Nenhuma guerra em andamento</p>
          <p className="text-parchment-dark/60 text-sm mt-1">
            Declare guerra para iniciar uma batalha!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {openMatches.map((match: OpenMatch) => (
            <div
              key={match.id}
              className="group relative bg-gradient-to-b from-citadel-granite to-citadel-carved 
                         border-2 border-metal-iron rounded-lg p-4 
                         hover:border-war-crimson hover:shadow-forge-glow
                         transition-all duration-300 shadow-stone-raised"
            >
              {/* Rebites */}
              <div className="absolute top-2 left-2 w-2 h-2 bg-metal-iron rounded-full border border-metal-rust/30"></div>
              <div className="absolute top-2 right-2 w-2 h-2 bg-metal-iron rounded-full border border-metal-rust/30"></div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-parchment-light font-bold"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {match.kingdomName}
                    </span>
                    <span className="text-parchment-dark text-sm">
                      • {match.hostName}
                    </span>
                  </div>
                  <div className="text-metal-steel text-xs">
                    📜 Declarada em {formatDate(match.createdAt)}
                  </div>
                </div>

                <button
                  onClick={() => handleJoinMatch(match.id)}
                  disabled={isJoining === match.id || !selectedKingdom}
                  className="px-4 py-2 bg-gradient-to-b from-war-crimson to-war-blood 
                             border-2 border-metal-iron rounded-lg
                             hover:from-war-ember hover:to-war-crimson
                             disabled:from-citadel-granite disabled:to-citadel-carved
                             text-parchment-light font-semibold transition-all
                             disabled:text-parchment-dark disabled:cursor-not-allowed"
                >
                  {isJoining === match.id ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-parchment-light border-t-transparent rounded-full"></div>
                    </span>
                  ) : (
                    <span>⚔️ Entrar</span>
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
