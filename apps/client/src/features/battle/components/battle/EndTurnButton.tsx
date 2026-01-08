import React, { useState, useRef } from "react";
import { Tooltip } from "@/components/Tooltip";

// =============================================================================
// COMPONENTE: EndTurnButton (Botão de finalizar turno para o Header)
// =============================================================================

interface EndTurnButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const EndTurnButton: React.FC<EndTurnButtonProps> = ({
  onClick,
  disabled = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={disabled}
        className={`
          relative px-3 py-1 rounded-lg border-2 flex items-center gap-1.5
          transition-all duration-200 text-xs font-semibold
          ${
            disabled
              ? "opacity-40 cursor-not-allowed border-surface-600 bg-surface-800/50 text-surface-400"
              : "border-ember-green/50 bg-ember-green/20 text-ember-glow hover:bg-ember-green/30 hover:border-ember-green hover:shadow-lg hover:shadow-ember-green/20"
          }
        `}
      >
        <span>Finalizar Turno</span>
      </button>

      <Tooltip
        anchorRef={btnRef}
        visible={showTooltip}
        preferredPosition="bottom"
        width="w-44"
      >
        <p className="text-astral-chrome font-bold text-xs text-center mb-1">
          Finalizar Turno
        </p>
        <p className="text-surface-300 text-[10px] text-center">
          Encerra seu turno e passa para o próximo jogador
        </p>
      </Tooltip>
    </div>
  );
};

export default EndTurnButton;
