import React from "react";
import { useMatch } from "../hooks/useMatch";
import { useAuth } from "../../auth";
import { RESOURCE_NAMES } from "../../../../../shared/config/global.config";

/**
 * Componente que exibe os recursos do jogador atual
 */
export const PlayerResourcesDisplay: React.FC = () => {
  const { completeMatchState } = useMatch();
  const { user } = useAuth();

  if (!completeMatchState || !user) {
    return null;
  }

  // Encontrar o jogador atual
  const myPlayer = completeMatchState.players.find((p) => p.userId === user.id);

  if (!myPlayer) {
    return null;
  }

  const { resources } = myPlayer;

  // Usa config global para ícones, nomes e cores
  const resourceConfig = {
    ore: {
      icon: RESOURCE_NAMES.ore.icon,
      label: RESOURCE_NAMES.ore.name,
      color: RESOURCE_NAMES.ore.color,
    },
    supplies: {
      icon: RESOURCE_NAMES.supplies.icon,
      label: RESOURCE_NAMES.supplies.name,
      color: RESOURCE_NAMES.supplies.color,
    },
    arcane: {
      icon: RESOURCE_NAMES.arcane.icon,
      label: RESOURCE_NAMES.arcane.name,
      color: RESOURCE_NAMES.arcane.color,
    },
    experience: {
      icon: RESOURCE_NAMES.experience.icon,
      label: RESOURCE_NAMES.experience.name,
      color: RESOURCE_NAMES.experience.color,
    },
    devotion: {
      icon: RESOURCE_NAMES.devotion.icon,
      label: RESOURCE_NAMES.devotion.name,
      color: RESOURCE_NAMES.devotion.color,
    },
  };

  return (
    <div className="bg-medieval-stone border-2 border-amber-700 rounded-2xl p-4 shadow-2xl shadow-amber-900/20">
      <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
        💰 Recursos
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(resources).map(([key, value]) => {
          const config = resourceConfig[key as keyof typeof resourceConfig];
          if (!config) return null;

          return (
            <div
              key={key}
              className="bg-medieval-darker rounded-lg p-2 text-center border-2 border-medieval-red-800 shadow-lg shadow-medieval-blood/10"
            >
              <div className="text-2xl mb-1">{config.icon}</div>
              <div className={`text-xl font-bold ${config.color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-1">{config.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
