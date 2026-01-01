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
      <div className="bg-citadel-obsidian/60 px-3 py-1 rounded border border-metal-iron cursor-help hover:bg-citadel-slate/50 transition-colors">
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
    <div className="flex-shrink-0 flex items-center justify-between bg-citadel-slate/50 border-b border-metal-iron px-4 py-2">
      {/* Meu Reino */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-b from-blue-600 to-blue-800 rounded-lg border-2 border-metal-iron flex items-center justify-center overflow-hidden">
          <SwordManAvatar size={40} animation={isMyTurn ? 0 : 0} />
        </div>
        <div>
          <p
            className="text-parchment-light font-bold text-sm"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {myKingdom.name}
          </p>
          <p className="text-green-400 text-xs">
            {myUnitsAlive} unidade{myUnitsAlive !== 1 ? "s" : ""} viva
            {myUnitsAlive !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Centro - Clima e Separador */}
      <div className="text-center flex items-center gap-4">
        {/* Clima */}
        {config.map && (
          <WeatherIndicator
            emoji={config.map.weatherEmoji}
            name={config.map.weatherName}
            effect={config.map.weatherEffect}
            terrainName={config.map.terrainName}
          />
        )}

        {/* Separador */}
        <p className="text-2xl font-bold text-war-crimson">⚔️</p>
      </div>

      {/* Reino Oponente */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p
            className="text-parchment-light font-bold text-sm"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {opponentKingdom.name}
          </p>
          <p className="text-war-ember text-xs">
            {enemyUnitsAlive} unidade{enemyUnitsAlive !== 1 ? "s" : ""} viva
            {enemyUnitsAlive !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="w-10 h-10 bg-gradient-to-b from-red-600 to-red-800 rounded-lg border-2 border-metal-iron flex items-center justify-center">
          <span className="text-xl">⚔️</span>
        </div>
      </div>
    </div>
  );
};
