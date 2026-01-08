import React, { useState, useRef } from "react";
import { ATTRIBUTE_NAMES } from "@boundless/shared/config";
import { Tooltip } from "@/components/Tooltip";
import type { AttributeBarProps } from "./types";

export const AttributeBar: React.FC<AttributeBarProps> = ({
  attributeKey,
  value,
  editable = false,
  onIncrement,
  onDecrement,
  canIncrement = true,
  canDecrement = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const attr = ATTRIBUTE_NAMES[attributeKey];
  const { style } = attr;

  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (editable) setIsEditing(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    setIsEditing(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cristal / Barra Principal */}
      <div
        ref={barRef}
        className="relative w-6 h-14 flex items-center justify-center transition-all duration-200 hover:scale-110"
        style={{
          background: `linear-gradient(to bottom, ${style.color}cc, ${style.colorDark}e6)`,
          border: `2px solid ${style.borderColor}`,
          boxShadow: showTooltip ? `0 0 12px ${style.glowColor}` : "none",
          clipPath:
            "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      >
        {/* Brilho interno */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/30 pointer-events-none"
          style={{
            clipPath:
              "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          }}
        />

        {/* Valor */}
        <span className="relative z-10 text-white font-bold text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {value}
        </span>
      </div>

      {/* Controles de Edição - Aparecem no hover */}
      {editable && isEditing && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full flex items-center gap-0.5 animate-fadeIn">
          <button
            onClick={onDecrement}
            disabled={!canDecrement}
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              text-xs font-bold transition-all
              ${
                canDecrement
                  ? "bg-surface-700 hover:bg-surface-600 text-astral-chrome hover:scale-110"
                  : "bg-surface-800 text-surface-500 cursor-not-allowed"
              }
            `}
          >
            −
          </button>
          <button
            onClick={onIncrement}
            disabled={!canIncrement}
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              text-xs font-bold transition-all
              ${
                canIncrement
                  ? "bg-stellar-amber hover:bg-stellar-gold text-cosmos-void hover:scale-110"
                  : "bg-surface-800 text-surface-500 cursor-not-allowed"
              }
            `}
          >
            +
          </button>
        </div>
      )}

      {/* Tooltip Padrão */}
      <Tooltip
        anchorRef={barRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-56"
      >
        <p className="text-astral-chrome font-bold text-xs mb-1 flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: style.color }}
          />
          <span>{attr.name}</span>
          <span className="ml-auto font-mono" style={{ color: style.color }}>
            {value}
          </span>
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {attr.description}
        </p>
      </Tooltip>
    </div>
  );
};
