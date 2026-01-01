import React from "react";
import { useMatch } from "../../match";
import { useAuth } from "../../auth";
import { RESOURCE_NAMES } from "../../../../../shared/config/global.config";

/**
 * TopHUD - Barra Superior do Mapa
 * Exibe informações da partida e recursos do jogador
 */
export const TopHUD: React.FC = () => {
  const { currentMatch, myPlayerId, completeMatchState } = useMatch();
  const { user } = useAuth();

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
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
      {/* Barra Superior Medieval */}
      <div className="bg-gradient-to-b from-citadel-granite to-citadel-carved border-b-4 border-metal-iron shadow-stone-raised pointer-events-auto">
        {/* Textura de pedra */}
        <div className="absolute inset-0 bg-stone-texture opacity-50"></div>

        <div className="relative px-4 py-3">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
            {/* ESQUERDA: Info da Partida */}
            <div className="flex items-center gap-4">
              {/* Brasão */}
              <div className="relative">
                <div
                  className="w-12 h-14 bg-citadel-carved border-2 border-metal-iron rounded-b-lg shadow-stone-raised flex items-center justify-center"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)",
                  }}
                >
                  <span className="text-xl">🏰</span>
                </div>
              </div>

              {/* Info da Sala */}
              <div>
                <div
                  className="text-parchment-light font-bold text-sm tracking-wider"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {myPlayer?.kingdomName || "Kingdom"}
                </div>
                <div className="text-parchment-aged text-xs">
                  {completeMatchState?.currentRound
                    ? `Round ${completeMatchState.currentRound}`
                    : "Preparing"}{" "}
                  • {completeMatchState?.currentTurn || currentMatch.status}
                </div>
              </div>
            </div>

            {/* CENTRO: Recursos (usa config global) */}
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

            {/* DIREITA: Comandante */}
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-b from-metal-bronze to-metal-copper px-3 py-1.5 rounded border-2 border-metal-rust/50 shadow-lg">
                <div className="text-citadel-obsidian font-bold text-xs tracking-wide">
                  {user?.username || "Commander"}
                </div>
              </div>

              {/* Status */}
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
