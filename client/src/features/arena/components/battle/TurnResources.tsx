import React, { useRef, useState } from "react";
import { Tooltip } from "@/components/Tooltip";

// =============================================================================
// TIPOS
// =============================================================================

interface TurnResourcesProps {
  actionsLeft: number;
  movesLeft: number;
  maxActions?: number;
  maxMoves?: number;
}

// =============================================================================
// COMPONENTE: TurnResources
// =============================================================================

/**
 * TurnResources - Exibe recursos do turno (ações e movimentos) de forma gamificada
 * Visual estilo RPG com orbs/cristais animados
 */
export const TurnResources: React.FC<TurnResourcesProps> = ({
  actionsLeft,
  movesLeft,
  maxActions = 1,
  maxMoves = 6,
}) => {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-l border-r border-surface-700/50">
      {/* Ações Restantes - Orbs de energia */}
      <ResourceOrbs
        current={actionsLeft}
        max={maxActions}
        icon="⚡"
        label="Ações"
        description="Ações disponíveis neste turno. Cada ataque ou skill consome 1 ação."
        color={{
          active: "#f59e0b",
          activeDark: "#d97706",
          glow: "rgba(245,158,11,0.5)",
          empty: "#374151",
        }}
      />

      {/* Divisor */}
      <div className="w-px h-8 bg-surface-600/50" />

      {/* Movimento Restante - Segmentos discretos */}
      <MovementSegments
        current={movesLeft}
        max={maxMoves}
        icon="👣"
        label="Movimento"
        description="Hexes de movimento disponíveis. Cada hex custa 1 ponto de movimento."
        color={{
          active: "#22d3ee",
          activeDark: "#0891b2",
          glow: "rgba(34,211,238,0.4)",
          empty: "#374151",
        }}
      />
    </div>
  );
};

// =============================================================================
// COMPONENTE: ResourceOrbs (Orbs de Ações)
// =============================================================================

interface ResourceOrbsProps {
  current: number;
  max: number;
  icon: string;
  label: string;
  description: string;
  color: {
    active: string;
    activeDark: string;
    glow: string;
    empty: string;
  };
}

const ResourceOrbs: React.FC<ResourceOrbsProps> = ({
  current,
  max,
  icon,
  label,
  description,
  color,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Ícone */}
      <span className="text-base">{icon}</span>

      {/* Orbs */}
      <div className="flex items-center gap-1">
        {Array.from({ length: max }, (_, i) => {
          const isActive = i < current;
          return (
            <div
              key={i}
              className={`
                w-4 h-4 rounded-full transition-all duration-300
                ${isActive ? "animate-pulse-subtle" : ""}
              `}
              style={{
                background: isActive
                  ? `radial-gradient(circle at 30% 30%, ${color.active}, ${color.activeDark})`
                  : color.empty,
                boxShadow: isActive ? `0 0 8px ${color.glow}` : "none",
                border: `1px solid ${isActive ? color.active : "#4b5563"}`,
              }}
            />
          );
        })}
      </div>

      {/* Counter */}
      <span
        className="text-xs font-bold tabular-nums"
        style={{ color: current > 0 ? color.active : "#6b7280" }}
      >
        {current}
      </span>

      {/* Tooltip */}
      <Tooltip
        anchorRef={containerRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-48"
      >
        <p
          className="font-bold text-xs mb-1 flex items-center gap-1.5"
          style={{ color: color.active }}
        >
          <span>{icon}</span>
          <span>{label}</span>
          <span className="ml-auto font-mono">
            {current}/{max}
          </span>
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {description}
        </p>
      </Tooltip>
    </div>
  );
};

// =============================================================================
// COMPONENTE: MovementSegments (Segmentos de Movimento)
// =============================================================================

interface MovementSegmentsProps {
  current: number;
  max: number;
  icon: string;
  label: string;
  description: string;
  color: {
    active: string;
    activeDark: string;
    glow: string;
    empty: string;
  };
}

const MovementSegments: React.FC<MovementSegmentsProps> = ({
  current,
  max,
  icon,
  label,
  description,
  color,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Garantir que max seja pelo menos o current (para casos onde current > max original)
  const effectiveMax = Math.max(max, current);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Ícone */}
      <span className="text-base">{icon}</span>

      {/* Segmentos discretos - cada um representa 1 movimento */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: effectiveMax }, (_, i) => {
          const isActive = i < current;
          return (
            <div
              key={i}
              className="w-2.5 h-3 rounded-sm transition-all duration-200"
              style={{
                background: isActive
                  ? `linear-gradient(to bottom, ${color.active}, ${color.activeDark})`
                  : color.empty,
                boxShadow: isActive ? `0 0 4px ${color.glow}` : "none",
                border: `1px solid ${isActive ? color.active : "#4b5563"}40`,
              }}
            />
          );
        })}
      </div>

      {/* Counter */}
      <span
        className="text-xs font-bold tabular-nums min-w-[20px]"
        style={{ color: current > 0 ? color.active : "#6b7280" }}
      >
        {current}
      </span>

      {/* Tooltip */}
      <Tooltip
        anchorRef={containerRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-48"
      >
        <p
          className="font-bold text-xs mb-1 flex items-center gap-1.5"
          style={{ color: color.active }}
        >
          <span>{icon}</span>
          <span>{label}</span>
          <span className="ml-auto font-mono">
            {current}/{effectiveMax}
          </span>
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {description}
        </p>
      </Tooltip>
    </div>
  );
};

export default TurnResources;
