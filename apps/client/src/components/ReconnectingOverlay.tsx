import React from "react";
import { useColyseusConnection } from "../core";

/**
 * Overlay que mostra quando está reconectando ao servidor
 */
export const ReconnectingOverlay: React.FC = () => {
  const { state } = useColyseusConnection();
  const { isReconnecting, reconnectAttempt, error } = state;

  if (!isReconnecting && !error) {
    return null;
  }

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-surface-800 rounded-2xl border-2 border-stellar-amber/50 p-8 max-w-md w-full mx-4 shadow-2xl">
        {error && reconnectAttempt > 10 ? (
          // Falha após muitas tentativas
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">
              Falha na Reconexão
            </h2>
            <p className="text-astral-silver mb-6">
              Não conseguimos reconectar ao servidor após várias tentativas.
            </p>
            <button
              onClick={handleReload}
              className="px-6 py-3 bg-gradient-to-r from-stellar-gold to-stellar-dark hover:from-stellar-amber hover:to-stellar-gold text-cosmos-void font-bold rounded-lg transition-all duration-300 hover:scale-105"
            >
              Recarregar Página
            </button>
          </div>
        ) : (
          // Reconectando
          <div className="text-center">
            {/* Spinner */}
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-stellar-amber/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-stellar-amber border-t-transparent rounded-full animate-spin"></div>
            </div>

            <h2 className="text-2xl font-bold text-stellar-amber mb-2">
              Reconectando...
            </h2>
            <p className="text-astral-steel mb-4">
              Sua conexão foi perdida. Tentando reconectar...
            </p>

            {reconnectAttempt > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-900/50 rounded-lg">
                <div className="w-2 h-2 bg-stellar-amber rounded-full animate-pulse"></div>
                <span className="text-sm text-astral-silver">
                  Tentativa {reconnectAttempt}
                </span>
              </div>
            )}

            <div className="mt-6 text-xs text-astral-steel">
              <p>Aguarde enquanto restabelecemos a conexão...</p>
              <p className="mt-1">Seu progresso foi salvo no servidor.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
