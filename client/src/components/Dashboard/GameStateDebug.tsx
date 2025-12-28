import React from "react";
import { useGameState } from "../../hooks/useGame";

/**
 * Componente de debug que exibe o estado completo do jogo
 * Útil para desenvolvimento e verificação de estado
 */
export const GameStateDebug: React.FC = () => {
  const gameState = useGameState();

  return (
    <div className="group relative h-1/2">
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative bg-slate-800/40 backdrop-blur-xl rounded-2xl border-2 border-pink-500/30 p-6 hover:border-pink-500/60 transition-all duration-300">
        <h3 className="text-lg sm:text-xl font-bold text-pink-300 mb-4 flex items-center gap-2">
          ⚙️ Estado do Jogo
        </h3>
        <div className="bg-slate-900/50 rounded-lg p-4 overflow-auto max-h-96 border border-slate-700/50">
          <pre className="text-xs sm:text-sm text-purple-300/80 font-mono whitespace-pre-wrap break-words">
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
