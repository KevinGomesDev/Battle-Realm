import React, { useEffect, useCallback } from "react";

interface PauseMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSurrender: () => void;
}

/**
 * PauseMenu - Menu de pausa da batalha (ativado por ESC)
 */
export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  onClose,
  onSurrender,
}) => {
  // Fechar com ESC (toggle)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const handleSurrender = () => {
    onSurrender();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-b from-citadel-slate to-citadel-obsidian border-2 border-metal-iron rounded-xl shadow-2xl p-6 min-w-[320px] max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h2
            className="text-2xl font-bold text-parchment-light mb-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            ⚔️ Menu
          </h2>
          <p className="text-parchment-dark text-sm">Batalha pausada</p>
        </div>

        {/* Opções */}
        <div className="space-y-3">
          {/* Continuar */}
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-emerald-900 
                       hover:from-emerald-600 hover:to-emerald-800
                       border border-emerald-500 rounded-lg text-parchment-light font-bold
                       transition-all duration-200 flex items-center justify-center gap-2"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span>▶️</span>
            <span>Continuar</span>
          </button>

          {/* Renderizar */}
          <button
            onClick={handleSurrender}
            className="w-full py-3 px-4 bg-gradient-to-r from-war-crimson to-war-blood
                       hover:from-war-ember hover:to-war-crimson
                       border border-war-ember rounded-lg text-parchment-light font-bold
                       transition-all duration-200 flex items-center justify-center gap-2"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span>🏳️</span>
            <span>Render-se</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-parchment-dark text-xs">
            Pressione{" "}
            <kbd className="px-1 py-0.5 bg-citadel-granite rounded text-parchment-light">
              ESC
            </kbd>{" "}
            para fechar
          </p>
        </div>
      </div>
    </div>
  );
};
