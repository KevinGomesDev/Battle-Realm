import React from "react";
import { useMatch } from "../../match";
import { useAuth } from "../../auth";
import { useConnection } from "../../../core";
import { RESOURCE_NAMES } from "../../../../../shared/config/global.config";

/**
 * TopHUD - Barra Superior do Mapa (estilo Topbar padrão)
 * Exibe informações da partida e recursos do jogador
 */
export const TopHUD: React.FC = () => {
  const { currentMatch, myPlayerId, completeMatchState } = useMatch();
  const { user } = useAuth();
  const { isConnected } = useConnection();

  if (!currentMatch || !completeMatchState) {
    return null;
  }

  // Encontra o jogador atual
  const myPlayer = completeMatchState.players?.find((p) => p.id === myPlayerId);

  const resources = myPlayer?.resources || {
    ore: 0,
    supplies: 0,
    arcane: 0,
    experience: 0,
    devotion: 0,
  };

  return (
    <div className="relative z-20">
      {/* Topbar padrão */}
      <div className="bg-citadel-granite border-b-4 border-citadel-carved shadow-stone-raised">
        {/* Textura de pedra */}
        <div className="absolute inset-0 bg-stone-texture opacity-50" />

        <div className="relative px-4 sm:px-6 py-3">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
            {/* ESQUERDA: Brasão + Info da Partida */}
            <div className="flex items-center gap-3">
              {/* Brasão */}
              <div
                className="w-10 h-12 bg-citadel-carved border-2 border-metal-iron rounded-b-lg shadow-stone-raised flex items-center justify-center"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)",
                }}
              >
                <span className="text-xl">🏰</span>
              </div>

              {/* Info da Partida */}
              <div>
                <h1
                  className="text-xl font-bold tracking-wider text-parchment-light"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {myPlayer?.kingdomName || "Kingdom"}
                </h1>
                <div className="text-parchment-aged text-xs">
                  {completeMatchState?.currentRound
                    ? `Round ${completeMatchState.currentRound}`
                    : "Preparando"}{" "}
                  • {completeMatchState?.currentTurn || currentMatch.status}
                </div>
              </div>
            </div>

            {/* CENTRO: Recursos */}
            <div className="flex items-center gap-2">
              {/* Ore */}
              <div
                className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1.5 shadow-stone-inset flex items-center gap-2"
                title={RESOURCE_NAMES.ore.name}
              >
                <span className="text-base">{RESOURCE_NAMES.ore.icon}</span>
                <span className="text-metal-gold font-bold text-sm">
                  {resources.ore}
                </span>
              </div>

              {/* Supplies */}
              <div
                className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1.5 shadow-stone-inset flex items-center gap-2"
                title={RESOURCE_NAMES.supplies.name}
              >
                <span className="text-base">
                  {RESOURCE_NAMES.supplies.icon}
                </span>
                <span className="text-parchment-light font-bold text-sm">
                  {resources.supplies}
                </span>
              </div>

              {/* Arcane */}
              <div
                className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1.5 shadow-stone-inset flex items-center gap-2"
                title={RESOURCE_NAMES.arcane.name}
              >
                <span className="text-base">{RESOURCE_NAMES.arcane.icon}</span>
                <span className="text-purple-400 font-bold text-sm">
                  {resources.arcane}
                </span>
              </div>

              {/* Experience */}
              <div
                className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1.5 shadow-stone-inset flex items-center gap-2"
                title={RESOURCE_NAMES.experience.name}
              >
                <span className="text-base">
                  {RESOURCE_NAMES.experience.icon}
                </span>
                <span className="text-blue-400 font-bold text-sm">
                  {resources.experience}
                </span>
              </div>

              {/* Devotion */}
              <div
                className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1.5 shadow-stone-inset flex items-center gap-2"
                title={RESOURCE_NAMES.devotion.name}
              >
                <span className="text-base">
                  {RESOURCE_NAMES.devotion.icon}
                </span>
                <span className="text-yellow-400 font-bold text-sm">
                  {resources.devotion}
                </span>
              </div>
            </div>

            {/* DIREITA: Usuário + Status de Conexão */}
            <div className="flex items-center gap-4">
              {/* Nome do Usuário */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-b from-metal-bronze to-metal-copper rounded-md border border-metal-iron flex items-center justify-center">
                  <span className="text-sm">👤</span>
                </div>
                <span
                  className="text-parchment-light font-semibold text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {user?.username || "Commander"}
                </span>
              </div>

              {/* Status de Conexão */}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  isConnected
                    ? "bg-green-900/30 border-green-600/50"
                    : "bg-war-blood/30 border-war-crimson/50"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isConnected
                      ? "bg-green-500 animate-pulse"
                      : "bg-war-crimson"
                  }`}
                />
                <span
                  className={`text-xs font-semibold ${
                    isConnected ? "text-green-400" : "text-war-ember"
                  }`}
                >
                  {isConnected ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
