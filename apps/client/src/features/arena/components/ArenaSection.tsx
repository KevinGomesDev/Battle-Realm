// client/src/features/arena/components/ArenaSection.tsx
// Seção principal da Arena no Dashboard

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/Button";
import { useArena } from "../hooks/useArena";
import { useKingdom } from "../../kingdom";
import { ChallengeCard } from "./ChallengeCard";
import { ChallengeModal } from "./ChallengeModal";
import { CountdownOverlay } from "./CountdownOverlay";
import { colyseusService } from "@/services/colyseus.service";
import type {
  Challenge,
  BattleStartingNotification,
} from "@boundless/shared/types/arena.types";

interface ArenaSectionProps {
  /** Callback quando ação no header é necessária */
  onHeaderAction?: () => void;
}

/**
 * Seção da Arena - Sistema de Desafios
 */
export const ArenaSection: React.FC<ArenaSectionProps> = () => {
  const navigate = useNavigate();
  const {
    state,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    refreshOpenChallenges,
  } = useArena();
  const { kingdoms, loadKingdoms } = useKingdom();

  // Estados locais
  const [selectedKingdomId, setSelectedKingdomId] = useState<string>("");
  const [modalMode, setModalMode] = useState<"direct" | "open" | null>(null);
  const [activeTab, setActiveTab] = useState<"incoming" | "open" | "my">(
    "incoming"
  );

  // Carregar reinos e desafios
  useEffect(() => {
    loadKingdoms();
    refreshOpenChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecionar primeiro reino por padrão
  useEffect(() => {
    if (kingdoms.length > 0 && !selectedKingdomId) {
      setSelectedKingdomId(kingdoms[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdoms.length]);

  // Listener para batalha iniciando
  useEffect(() => {
    const handleBattleStarting = async (data: BattleStartingNotification) => {

      // Usar o selectedKingdomId que foi usado para aceitar/criar o desafio
      // ou um dos kingdomIds da notificação como fallback
      const kingdomId =
        selectedKingdomId ||
        data.challengedKingdomId ||
        data.challengerKingdomId;

      if (!kingdomId) {
        console.error("[ArenaSection] Nenhum kingdomId disponível para join");
        return;
      }

      try {
        // Entrar na sala de batalha ANTES de navegar
        await colyseusService.joinBattleLobby(data.battleRoomId, kingdomId);

        // Aguardar a mensagem battle:started ou timeout
        // O Schema do Colyseus pode não sincronizar imediatamente, então
        // usamos o evento de mensagem como gatilho
        const waitForBattleStart = () =>
          new Promise<void>((resolve) => {
            let resolved = false;

            const handleBattleStarted = () => {
              if (!resolved) {
                resolved = true;
                colyseusService.off(
                  "battle:battle:started",
                  handleBattleStarted
                );
                resolve();
              }
            };

            colyseusService.on("battle:battle:started", handleBattleStarted);

            // Timeout máximo de 5 segundos
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                colyseusService.off(
                  "battle:battle:started",
                  handleBattleStarted
                );
                resolve();
              }
            }, 5000);
          });

        await waitForBattleStart();

        // Navegar para a batalha
        navigate("/battle", { replace: true });
      } catch (error) {
        console.error("[ArenaSection] Erro ao entrar na BattleRoom:", error);
      }
    };

    colyseusService.on("arena:battle_starting", handleBattleStarting);
    return () => {
      colyseusService.off("arena:battle_starting", handleBattleStarting);
    };
  }, [navigate, selectedKingdomId]);

  // Handlers
  const handleAccept = (challengeId: string) => {
    if (!selectedKingdomId) return;
    acceptChallenge(challengeId, selectedKingdomId);
  };

  // Contadores
  const incomingCount = state.incomingChallenges.length;
  const openCount = state.openChallenges.length;
  const myCount = state.myPendingChallenges.length;

  return (
    <>
      {/* Countdown Overlay */}
      <AnimatePresence>
        {state.activeChallenge && state.countdown !== null && (
          <CountdownOverlay
            challenge={state.activeChallenge}
            countdown={state.countdown}
          />
        )}
      </AnimatePresence>

      {/* Modal de Criação */}
      <ChallengeModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        selectedKingdomId={selectedKingdomId}
        mode={modalMode || "open"}
      />

      <div className="space-y-4">
        {/* Header com seleção de reino */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Seletor de Reino */}
          <div className="flex items-center gap-2">
            <span className="text-astral-steel text-sm">Seu Reino:</span>
            <select
              value={selectedKingdomId}
              onChange={(e) => setSelectedKingdomId(e.target.value)}
              className="bg-surface-800 border border-surface-500 rounded-lg px-3 py-1.5 text-astral-chrome text-sm focus:border-stellar-amber outline-none"
            >
              {kingdoms.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setModalMode("direct")}
              disabled={!selectedKingdomId}
            >
              ⚔️ Desafiar
            </Button>
            <Button
              variant="mystic"
              size="sm"
              onClick={() => setModalMode("open")}
              disabled={!selectedKingdomId}
            >
              📢 Desafio Aberto
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-800 rounded-lg">
          <button
            onClick={() => setActiveTab("incoming")}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                activeTab === "incoming"
                  ? "bg-stellar-deep text-stellar-amber"
                  : "text-astral-steel hover:text-astral-chrome"
              }
            `}
          >
            📩 Recebidos {incomingCount > 0 && `(${incomingCount})`}
          </button>
          <button
            onClick={() => setActiveTab("open")}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                activeTab === "open"
                  ? "bg-stellar-deep text-stellar-amber"
                  : "text-astral-steel hover:text-astral-chrome"
              }
            `}
          >
            🏟️ Abertos {openCount > 0 && `(${openCount})`}
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                activeTab === "my"
                  ? "bg-stellar-deep text-stellar-amber"
                  : "text-astral-steel hover:text-astral-chrome"
              }
            `}
          >
            📤 Meus {myCount > 0 && `(${myCount})`}
          </button>
        </div>

        {/* Lista de Desafios */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {activeTab === "incoming" && (
            <>
              {state.incomingChallenges.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="Nenhum desafio recebido"
                  description="Quando alguém te desafiar, aparecerá aqui"
                />
              ) : (
                state.incomingChallenges.map((challenge: Challenge) => (
                  <ChallengeCard
                    key={challenge.challengeId}
                    challenge={challenge}
                    variant="incoming"
                    selectedKingdomId={selectedKingdomId}
                    onAccept={() => handleAccept(challenge.challengeId)}
                    onDecline={() => declineChallenge(challenge.challengeId)}
                    isLoading={state.isLoading}
                  />
                ))
              )}
            </>
          )}

          {activeTab === "open" && (
            <>
              {state.openChallenges.length === 0 ? (
                <EmptyState
                  icon="🏟️"
                  title="Nenhum desafio aberto"
                  description="Crie um desafio aberto para outros jogadores"
                />
              ) : (
                state.openChallenges.map((challenge: Challenge) => (
                  <ChallengeCard
                    key={challenge.challengeId}
                    challenge={challenge}
                    variant="open"
                    selectedKingdomId={selectedKingdomId}
                    onJoin={() => handleAccept(challenge.challengeId)}
                    isLoading={state.isLoading}
                  />
                ))
              )}
            </>
          )}

          {activeTab === "my" && (
            <>
              {state.myPendingChallenges.length === 0 ? (
                <EmptyState
                  icon="📤"
                  title="Nenhum desafio pendente"
                  description="Desafie alguém para começar!"
                />
              ) : (
                state.myPendingChallenges.map((challenge: Challenge) => (
                  <ChallengeCard
                    key={challenge.challengeId}
                    challenge={challenge}
                    variant="outgoing"
                    onCancel={() => cancelChallenge(challenge.challengeId)}
                    isLoading={state.isLoading}
                  />
                ))
              )}
            </>
          )}
        </div>

        {/* Notificação de desafios recebidos */}
        {incomingCount > 0 && activeTab !== "incoming" && (
          <button
            onClick={() => setActiveTab("incoming")}
            className="w-full p-3 bg-stellar-deep/50 border border-stellar-amber rounded-lg text-center animate-pulse"
          >
            <span className="text-stellar-amber font-bold">
              ⚔️ {incomingCount} desafio{incomingCount > 1 ? "s" : ""}{" "}
              aguardando resposta!
            </span>
          </button>
        )}
      </div>
    </>
  );
};

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
}) => (
  <div className="text-center py-8">
    <p className="text-4xl mb-2">{icon}</p>
    <p className="text-astral-chrome font-medium">{title}</p>
    <p className="text-astral-steel text-sm">{description}</p>
  </div>
);
