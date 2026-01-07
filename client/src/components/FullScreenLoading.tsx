import React from "react";

interface FullScreenLoadingProps {
  message?: string;
}

/**
 * FullScreenLoading - Loading que ocupa a tela inteira
 * Barra de progresso animada da esquerda para direita
 */
export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  message = "Carregando...",
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cosmos-void">
      {/* Barra de progresso */}
      <div className="w-64 h-2 bg-surface-800 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-stellar-gold via-stellar-amber to-stellar-gold animate-loading-bar" />
      </div>

      {/* Mensagem */}
      <p className="text-astral-silver text-sm animate-pulse">{message}</p>
    </div>
  );
};

export default FullScreenLoading;
