import React, { useState } from "react";
import { SwordManAvatar } from "@/components/SwordManAvatar";
import type { ArenaKingdom, ArenaConfig } from "../../types/arena.types";

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

/**
 * Indicador de Clima com tooltip
 */
const WeatherIndicator: React.FC<{
  emoji: string;
  name: string;
  effect: string;
  terrainName: string;
}> = ({ emoji, name, effect, terrainName }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="bg-citadel-carved border-2 border-metal-iron rounded px-3 py-1 cursor-help hover:bg-citadel-slate/50 transition-colors shadow-stone-inset">
        <span className="text-xl">{emoji}</span>
      </div>
      {showTooltip && (
        <div className="absolute z-[200] top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{emoji}</span>
            <div>
              <span className="text-parchment-light font-bold text-sm block">
                {name}
              </span>
              <span className="text-parchment-dark text-[10px]">
                Terreno: {terrainName}
              </span>
            </div>
          </div>
          <p className="text-parchment-aged text-xs leading-relaxed border-t border-metal-iron/30 pt-2">
            {effect}
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

/**
 * Painel de Reino (esquerda ou direita)
 */
const KingdomPanel: React.FC<{
  kingdom: ArenaKingdom;
  unitsAlive: number;
  isMyTurn?: boolean;
  isOpponent?: boolean;
}> = ({ kingdom, unitsAlive, isMyTurn, isOpponent }) => {
  const bgColor = isOpponent
    ? "bg-gradient-to-b from-red-600 to-red-800"
    : "bg-gradient-to-b from-blue-600 to-blue-800";
  const textColor = isOpponent ? "text-war-ember" : "text-green-400";

  return (
    <div
      className={`flex items-center gap-3 ${
        isOpponent ? "flex-row-reverse" : ""
      }`}
    >
      <div
        className={`w-10 h-10 ${bgColor} rounded-lg border-2 border-metal-iron flex items-center justify-center overflow-hidden`}
      >
        {isOpponent ? (
          <span className="text-xl">⚔️</span>
        ) : (
          <SwordManAvatar size={40} animation={isMyTurn ? 0 : 0} />
        )}
      </div>
      <div className={isOpponent ? "text-right" : ""}>
        <p
          className="text-parchment-light font-bold text-sm"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {kingdom.name}
        </p>
        <p className={`${textColor} text-xs`}>
          {unitsAlive} unidade{unitsAlive !== 1 ? "s" : ""} viva
          {unitsAlive !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface BattleHeaderProps {
  myKingdom: ArenaKingdom;
  opponentKingdom: ArenaKingdom;
  myUnitsAlive: number;
  enemyUnitsAlive: number;
  isMyTurn: boolean;
  config: ArenaConfig;
}

/**
 * Header da Batalha - Exibe informações dos reinos, clima e contagem de unidades
 * Estilizado como Topbar padrão
 */
export const BattleHeader: React.FC<BattleHeaderProps> = ({
  myKingdom,
  opponentKingdom,
  myUnitsAlive,
  enemyUnitsAlive,
  isMyTurn,
  config,
}) => {
  return (
    <div className="relative z-20 flex-shrink-0">
      {/* Topbar padrão */}
      <div className="bg-citadel-granite border-b-4 border-citadel-carved shadow-stone-raised">
        {/* Textura de pedra */}
        <div className="absolute inset-0 bg-stone-texture opacity-50" />

        <div className="relative px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* ESQUERDA: Meu Reino */}
            <KingdomPanel
              kingdom={myKingdom}
              unitsAlive={myUnitsAlive}
              isMyTurn={isMyTurn}
            />

            {/* CENTRO: Clima e Separador */}
            <div className="flex items-center gap-4">
              {config.map && (
                <WeatherIndicator
                  emoji={config.map.weatherEmoji}
                  name={config.map.weatherName}
                  effect={config.map.weatherEffect}
                  terrainName={config.map.terrainName}
                />
              )}
              <span className="text-2xl font-bold text-war-crimson">⚔️</span>
            </div>

            {/* DIREITA: Reino Oponente */}
            <KingdomPanel
              kingdom={opponentKingdom}
              unitsAlive={enemyUnitsAlive}
              isOpponent
            />
          </div>
        </div>
      </div>
    </div>
  );
};
