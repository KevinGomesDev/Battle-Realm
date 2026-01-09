// client/src/features/arena/components/ChallengeModal.tsx
// Modal para criar desafios e selecionar oponentes

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/Button";
import { useArena } from "../hooks/useArena";
import type { ChallengeKingdomInfo } from "@boundless/shared/types/arena.types";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKingdomId: string;
  mode: "direct" | "open";
}

/**
 * Modal para criar desafios
 */
export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  isOpen,
  onClose,
  selectedKingdomId,
  mode,
}) => {
  const {
    state,
    createDirectChallenge,
    createOpenChallenge,
    refreshOpponents,
  } = useArena();
  const [selectedOpponent, setSelectedOpponent] =
    useState<ChallengeKingdomInfo | null>(null);

  useEffect(() => {
    if (isOpen && mode === "direct") {
      refreshOpponents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  useEffect(() => {
    // Fechar modal quando desafio for criado
    if (state.myPendingChallenges.length > 0 && !state.isCreatingChallenge) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.myPendingChallenges.length, state.isCreatingChallenge]);

  const handleCreateDirect = () => {
    if (!selectedOpponent) return;
    createDirectChallenge(
      selectedKingdomId,
      selectedOpponent.userId,
      selectedOpponent.kingdomId
    );
  };

  const handleCreateOpen = () => {
    createOpenChallenge(selectedKingdomId);
    onClose();
  };

  const formatPower = (power: number): string => {
    if (power >= 1000) {
      return `${(power / 1000).toFixed(1)}k`;
    }
    return power.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-surface-900 border-2 border-surface-500 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-stellar-deep to-surface-800 border-b border-surface-500">
              <h2
                className="text-xl font-bold text-astral-chrome tracking-wider"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {mode === "direct"
                  ? "⚔️ Desafiar Jogador"
                  : "📢 Criar Desafio Aberto"}
              </h2>
              <p className="text-sm text-astral-steel mt-1">
                {mode === "direct"
                  ? "Escolha um oponente para desafiar"
                  : "Qualquer jogador poderá aceitar seu desafio"}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {mode === "direct" ? (
                <>
                  {state.isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-stellar-amber border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-astral-steel">Buscando oponentes...</p>
                    </div>
                  ) : state.availableOpponents.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">😔</p>
                      <p className="text-astral-steel">
                        Nenhum oponente online
                      </p>
                      <p className="text-xs text-astral-silver mt-1">
                        Tente criar um desafio aberto
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {state.availableOpponents.map(
                        (opponent: ChallengeKingdomInfo) => (
                          <button
                            key={opponent.kingdomId}
                            onClick={() => setSelectedOpponent(opponent)}
                            className={`
                            w-full p-4 rounded-lg border-2 text-left transition-all
                            ${
                              selectedOpponent?.kingdomId === opponent.kingdomId
                                ? "border-stellar-amber bg-stellar-deep/30"
                                : "border-surface-500 bg-surface-800/50 hover:border-surface-400"
                            }
                          `}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-astral-chrome font-bold">
                                  {opponent.kingdomName}
                                </p>
                                <p className="text-sm text-astral-steel">
                                  {opponent.username}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-stellar-amber font-bold">
                                  ⚡ {formatPower(opponent.power)}
                                </p>
                                <p className="text-xs text-astral-silver">
                                  👥 {opponent.unitCount} unidades
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-6xl mb-4">🏟️</p>
                  <p className="text-astral-chrome text-lg mb-2">
                    Seu desafio ficará disponível por 5 minutos
                  </p>
                  <p className="text-astral-steel text-sm">
                    Qualquer jogador online poderá aceitar e enfrentar você
                  </p>
                </div>
              )}

              {state.error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-red-400 text-sm">{state.error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-surface-800 border-t border-surface-500 flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              {mode === "direct" ? (
                <Button
                  variant="primary"
                  onClick={handleCreateDirect}
                  disabled={!selectedOpponent || state.isCreatingChallenge}
                  isLoading={state.isCreatingChallenge}
                  className="flex-1"
                >
                  ⚔️ Desafiar
                </Button>
              ) : (
                <Button
                  variant="mystic"
                  onClick={handleCreateOpen}
                  disabled={state.isCreatingChallenge}
                  isLoading={state.isCreatingChallenge}
                  className="flex-1"
                >
                  📢 Criar Desafio
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
