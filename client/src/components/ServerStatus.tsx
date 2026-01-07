import React from "react";
import { useColyseusConnection } from "../core";

/**
 * Componente que exibe o status do servidor
 * Mostra se o servidor está ativo e disponível para conexão
 */
export const ServerStatus: React.FC = () => {
  const { isConnected, error } = useColyseusConnection();

  return (
    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-20">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-medieval-stone/60 backdrop-blur-xl border border-medieval-red-900/50 hover:border-medieval-red-800/80 transition-all duration-300">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-medieval-blood"
          }`}
        ></div>
        <span className="text-sm font-semibold">
          {isConnected ? (
            <span className="text-green-400">🟢 Servidor Ativo</span>
          ) : (
            <span className="text-medieval-red-400">🔴 Servidor Inativo</span>
          )}
        </span>
        {error && (
          <div className="hidden sm:block text-xs text-medieval-red-400/70 ml-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
