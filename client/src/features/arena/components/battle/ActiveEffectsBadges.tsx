// client/src/features/arena/components/battle/ActiveEffectsBadges.tsx
// Componente para exibir efeitos ativos das condições de uma unidade

import React, { useState, useRef } from "react";
import type {
  ActiveEffectsMap,
  ConditionEffects,
} from "../../../../../../shared/types/conditions.types";
import { EFFECT_METADATA } from "../../../../../../shared/data/effect-metadata.data";
import { Tooltip } from "@/components/Tooltip";
import { usePopupContainer } from "./PanelStrip";

interface ActiveEffectBadgeProps {
  effectKey: keyof ConditionEffects;
  value: number | boolean;
  sources: string[];
}

/**
 * Badge individual para um efeito ativo
 */
const ActiveEffectBadge: React.FC<ActiveEffectBadgeProps> = ({
  effectKey,
  value,
  sources,
}) => {
  const popupContainerRef = usePopupContainer();
  const badgeRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = EFFECT_METADATA[effectKey];

  if (!meta) return null;

  // Formatar o valor para exibição
  let displayValue = "";
  if (typeof value === "boolean") {
    displayValue = "✓";
  } else if (typeof value === "number") {
    const prefix = value > 0 && meta.valuePrefix ? meta.valuePrefix : "";
    const suffix = meta.valueSuffix || "";
    displayValue = `${prefix}${value}${suffix}`;
  }

  // Determinar cor baseada no valor (negativo = vermelho se negativeIsBad)
  let effectColor = meta.color;
  if (typeof value === "number" && value < 0 && meta.negativeIsBad) {
    effectColor = "#ef4444"; // vermelho para efeitos negativos ruins
  }

  return (
    <div
      ref={badgeRef}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-help transition-all hover:scale-105"
        style={{
          backgroundColor: `${effectColor}20`,
          color: effectColor,
          border: `1px solid ${effectColor}40`,
        }}
      >
        <span>{meta.icon}</span>
        <span>{displayValue}</span>
      </div>

      <Tooltip
        anchorRef={badgeRef}
        containerRef={popupContainerRef ?? undefined}
        visible={showTooltip}
        preferredPosition="left"
        width="w-56"
      >
        <div className="font-bold text-xs mb-1" style={{ color: effectColor }}>
          {meta.icon} {meta.name}
        </div>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {meta.description}
        </p>
        <p className="text-[10px] mt-1">
          <span className="font-bold" style={{ color: effectColor }}>
            Valor: {displayValue}
          </span>
        </p>
        {sources.length > 0 && (
          <p className="text-surface-400 text-[9px] mt-1">
            Fontes: {sources.join(", ")}
          </p>
        )}
      </Tooltip>
    </div>
  );
};

interface ActiveEffectsBadgesProps {
  activeEffects?: ActiveEffectsMap;
}

/**
 * Componente que exibe todos os efeitos ativos de uma unidade
 */
export const ActiveEffectsBadges: React.FC<ActiveEffectsBadgesProps> = ({
  activeEffects,
}) => {
  if (!activeEffects || Object.keys(activeEffects).length === 0) {
    return (
      <p className="text-xs text-surface-400 text-center py-2">
        Nenhum efeito ativo
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-w-[220px] justify-center">
      {Object.entries(activeEffects).map(([key, effect]) => {
        if (!effect) return null;
        const effectKey = key as keyof ConditionEffects;
        const meta = EFFECT_METADATA[effectKey];

        // Pular efeitos sem metadata ou hidden
        if (!meta || meta.hidden) return null;

        return (
          <ActiveEffectBadge
            key={key}
            effectKey={effectKey}
            value={effect.value}
            sources={effect.sources}
          />
        );
      })}
    </div>
  );
};
