import React, { useState, useRef } from "react";
import type { ArenaUnit } from "../../types/arena.types";
import { getConditionInfo } from "../../constants";
import { ATTRIBUTE_NAMES } from "../../../../../../shared/config/global.config";

// =============================================================================
// COMPONENTES INTERNOS
// =============================================================================

// Componente de Progresso Circular (HP e Proteção)
const CircularProgress: React.FC<{
  current: number;
  max: number;
  color: string;
  bgColor?: string;
  size?: number;
  strokeWidth?: number;
  label: string;
  icon: string;
  tooltip: string;
}> = ({
  current,
  max,
  color,
  bgColor = "#374151",
  size = 72,
  strokeWidth = 6,
  label,
  icon,
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const strokeDashoffset = circumference * (1 - percentage);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex flex-col items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ top: 0, left: 0, width: size, height: size }}
      >
        <span className="text-sm leading-none">{icon}</span>
        <span className="text-parchment-light font-bold text-[11px] leading-tight">
          {current}/{max}
        </span>
      </div>
      <span className="text-parchment-dark text-[10px] mt-1">{label}</span>
      {showTooltip && (
        <div
          className="fixed z-[9999] w-44 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-parchment-aged text-xs leading-relaxed text-center">
            {tooltip}
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Bolinhas de Movimento
const MovementDots: React.FC<{ total: number; remaining: number }> = ({
  total,
  remaining,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex flex-wrap gap-0.5 max-w-[60px] justify-center cursor-help h-5 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < remaining
                ? "bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.6)]"
                : "bg-gray-600"
            }`}
          />
        ))}
      </div>
      {showTooltip && (
        <div
          className="fixed z-[9999] w-40 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-parchment-light font-bold text-xs mb-1">
            🚶 Movimentos
          </p>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            Cada bolinha azul representa 1 célula de movimento. Mover gasta
            movimentos. Use WASD ou clique no mapa.
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Quadrados de Ações
const ActionSquares: React.FC<{ total: number; remaining: number }> = ({
  total,
  remaining,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex gap-0.5 justify-center cursor-help h-5 items-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-sm transition-colors duration-300 ${
              i < remaining
                ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                : "bg-gray-600"
            }`}
          />
        ))}
      </div>
      {showTooltip && (
        <div
          className="fixed z-[9999] w-44 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-parchment-light font-bold text-xs mb-1">
            ⚡ Ações
          </p>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            Cada quadrado verde é 1 ação disponível. Atacar, esquivar, disparar
            e conjurar consomem ações.
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Componente de Badge de Condição
const ConditionBadge: React.FC<{ condition: string }> = ({ condition }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const info = getConditionInfo(condition);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-war-blood/30 border border-war-crimson/50 rounded text-war-ember cursor-help">
        <span>{info.icon}</span>
        <span>{info.name}</span>
      </span>
      {showTooltip && (
        <div
          className="fixed z-[9999] w-48 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-center gap-1 mb-1">
            <span className="text-base">{info.icon}</span>
            <span className="text-parchment-light font-bold text-xs">
              {info.name}
            </span>
          </div>
          <p className="text-parchment-aged text-[10px] leading-relaxed">
            {info.description}
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Definições de tooltips para atributos (usa config global)
const ATTRIBUTE_TOOLTIPS: Record<
  string,
  { icon: string; name: string; description: string }
> = {
  combat: {
    icon: ATTRIBUTE_NAMES.combat.icon,
    name: ATTRIBUTE_NAMES.combat.name,
    description: ATTRIBUTE_NAMES.combat.description,
  },
  acuity: {
    icon: ATTRIBUTE_NAMES.acuity.icon,
    name: ATTRIBUTE_NAMES.acuity.name,
    description: ATTRIBUTE_NAMES.acuity.description,
  },
  focus: {
    icon: ATTRIBUTE_NAMES.focus.icon,
    name: ATTRIBUTE_NAMES.focus.name,
    description: ATTRIBUTE_NAMES.focus.description,
  },
  armor: {
    icon: ATTRIBUTE_NAMES.armor.icon,
    name: ATTRIBUTE_NAMES.armor.name,
    description: ATTRIBUTE_NAMES.armor.description,
  },
  vitality: {
    icon: ATTRIBUTE_NAMES.vitality.icon,
    name: ATTRIBUTE_NAMES.vitality.name,
    description: ATTRIBUTE_NAMES.vitality.description,
  },
};

// Componente de Tooltip para atributos
const AttributeTooltip: React.FC<{
  attribute: string;
  value: number;
}> = ({ attribute, value }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const info = ATTRIBUTE_TOOLTIPS[attribute];
  if (!info) return null;

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="bg-citadel-slate/50 rounded p-1.5 text-center w-full hover:bg-citadel-slate/70 transition-colors cursor-help">
        <span className="text-parchment-dark block text-xs">{info.icon}</span>
        <p className="text-parchment-light font-bold text-sm">{value}</p>
      </div>
      {showTooltip && (
        <div
          className="fixed z-[9999] w-48 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-center gap-1 mb-1">
            <span>{info.icon}</span>
            <span className="text-parchment-light font-bold text-xs">
              {info.name}
            </span>
          </div>
          <p className="text-parchment-aged text-xs leading-relaxed">
            {info.description}
          </p>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
        </div>
      )}
    </div>
  );
};

// Definições de ações disponíveis
const ACTIONS_INFO: Record<
  string,
  {
    icon: string;
    name: string;
    description: string;
    color: string;
    requiresTarget?: boolean;
  }
> = {
  attack: {
    icon: "⚔️",
    name: "Atacar",
    description: "Ataca unidade adjacente. Clique para selecionar alvo.",
    color: "red",
    requiresTarget: true,
  },
  dash: {
    icon: "💨",
    name: "Disparada",
    description: "Gasta 1 ação. Adiciona movimentos extras igual à Acuidade.",
    color: "amber",
  },
  dodge: {
    icon: "🌀",
    name: "Esquiva",
    description:
      "Gasta 1 ação. Ataques têm 50% de chance de errar até o próximo turno.",
    color: "cyan",
  },
  protect: {
    icon: "🛡️",
    name: "Proteger",
    description: "Gasta 1 ação. Reduz o próximo dano recebido em 5.",
    color: "emerald",
  },
  cast: {
    icon: "✨",
    name: "Conjurar",
    description: "Gasta 1 ação. Usa uma magia ou habilidade especial.",
    color: "purple",
  },
  help: {
    icon: "🤝",
    name: "Ajudar",
    description:
      "Gasta 1 ação. Dá vantagem ao próximo ataque de aliado adjacente.",
    color: "sky",
  },
  knockdown: {
    icon: "⬇️",
    name: "Derrubar",
    description: "Gasta 1 ação. Tenta derrubar o inimigo adjacente.",
    color: "orange",
    requiresTarget: true,
  },
  grab: {
    icon: "🤼",
    name: "Agarrar",
    description: "Gasta 1 ação. Agarra unidade adjacente, impedindo movimento.",
    color: "rose",
    requiresTarget: true,
  },
  throw: {
    icon: "🎯",
    name: "Arremessar",
    description: "Gasta 1 ação. Arremessa objeto ou unidade agarrada.",
    color: "indigo",
    requiresTarget: true,
  },
  flee: {
    icon: "🏃",
    name: "Fugir",
    description: "Gasta 1 ação. Tenta escapar do combate.",
    color: "gray",
  },
  disarm: {
    icon: "✋",
    name: "Desarmar",
    description: "Gasta 1 ação. Tenta desarmar o inimigo.",
    color: "yellow",
    requiresTarget: true,
  },
};

// Mapa de cores para os botões de ação
const COLOR_CLASSES: Record<string, { active: string; normal: string }> = {
  red: {
    active: "bg-red-700/60 border-red-400 ring-2 ring-red-400/50",
    normal: "bg-red-900/40 border-red-500/50 hover:bg-red-800/60",
  },
  amber: {
    active: "bg-amber-700/60 border-amber-400 ring-2 ring-amber-400/50",
    normal: "bg-amber-900/40 border-amber-500/50 hover:bg-amber-800/60",
  },
  cyan: {
    active: "bg-cyan-700/60 border-cyan-400 ring-2 ring-cyan-400/50",
    normal: "bg-cyan-900/40 border-cyan-500/50 hover:bg-cyan-800/60",
  },
  emerald: {
    active: "bg-emerald-700/60 border-emerald-400 ring-2 ring-emerald-400/50",
    normal: "bg-emerald-900/40 border-emerald-500/50 hover:bg-emerald-800/60",
  },
  purple: {
    active: "bg-purple-700/60 border-purple-400 ring-2 ring-purple-400/50",
    normal: "bg-purple-900/40 border-purple-500/50 hover:bg-purple-800/60",
  },
  sky: {
    active: "bg-sky-700/60 border-sky-400 ring-2 ring-sky-400/50",
    normal: "bg-sky-900/40 border-sky-500/50 hover:bg-sky-800/60",
  },
  orange: {
    active: "bg-orange-700/60 border-orange-400 ring-2 ring-orange-400/50",
    normal: "bg-orange-900/40 border-orange-500/50 hover:bg-orange-800/60",
  },
  rose: {
    active: "bg-rose-700/60 border-rose-400 ring-2 ring-rose-400/50",
    normal: "bg-rose-900/40 border-rose-500/50 hover:bg-rose-800/60",
  },
  indigo: {
    active: "bg-indigo-700/60 border-indigo-400 ring-2 ring-indigo-400/50",
    normal: "bg-indigo-900/40 border-indigo-500/50 hover:bg-indigo-800/60",
  },
  gray: {
    active: "bg-gray-600/60 border-gray-400 ring-2 ring-gray-400/50",
    normal: "bg-gray-800/40 border-gray-600/50 hover:bg-gray-700/60",
  },
  yellow: {
    active: "bg-yellow-700/60 border-yellow-400 ring-2 ring-yellow-400/50",
    normal: "bg-yellow-900/40 border-yellow-500/50 hover:bg-yellow-800/60",
  },
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface UnitPanelProps {
  selectedUnit: ArenaUnit | null;
  isMyTurn: boolean;
  currentUserId: string;
  pendingAction: string | null;
  onSetPendingAction: (action: string | null) => void;
  onExecuteAction: (actionKey: string, unitId: string) => void;
  onEndAction: () => void;
}

/**
 * Painel de Unidade - Exibe detalhes da unidade selecionada
 * Estruturado como componente lateral similar ao InitiativePanel
 */
export const UnitPanel: React.FC<UnitPanelProps> = ({
  selectedUnit,
  isMyTurn,
  currentUserId,
  pendingAction,
  onSetPendingAction,
  onExecuteAction,
  onEndAction,
}) => {
  return (
    <div className="w-80 xl:w-96 flex-shrink-0 p-2 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {/* Painel da Unidade Selecionada */}
      {selectedUnit ? (
        <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised flex-shrink-0">
          {/* Header com nome */}
          <h3
            className="text-parchment-light font-bold text-base mb-3 border-b border-metal-rust/30 pb-2 truncate text-center"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {selectedUnit.name}
          </h3>

          {/* HP e Proteções - Círculos lado a lado */}
          <div className="flex justify-center gap-3 mb-3">
            <CircularProgress
              current={selectedUnit.currentHp}
              max={selectedUnit.maxHp}
              color={
                selectedUnit.currentHp / selectedUnit.maxHp > 0.6
                  ? "#4ade80"
                  : selectedUnit.currentHp / selectedUnit.maxHp > 0.3
                  ? "#fbbf24"
                  : "#ef4444"
              }
              size={64}
              label="HP"
              icon="❤️"
              tooltip="Pontos de Vida. Quando chegar a 0, a unidade morre. HP Máximo = Vitalidade × 2."
            />
            <CircularProgress
              current={selectedUnit.physicalProtection}
              max={selectedUnit.maxPhysicalProtection}
              color={
                selectedUnit.physicalProtectionBroken ? "#6b7280" : "#60a5fa"
              }
              size={64}
              label="P. Física"
              icon="🛡️"
              tooltip="Proteção Física. Absorve dano FÍSICO antes do HP. Proteção = Armadura × 4. Se quebrar, não regenera."
            />
            <CircularProgress
              current={selectedUnit.magicalProtection}
              max={selectedUnit.maxMagicalProtection}
              color={
                selectedUnit.magicalProtectionBroken ? "#6b7280" : "#a855f7"
              }
              size={64}
              label="P. Mágica"
              icon="✨"
              tooltip="Proteção Mágica. Absorve dano MÁGICO antes do HP. Proteção = Foco × 4. Se quebrar, não regenera."
            />
          </div>

          {/* Atributos - Grid com tooltips hover */}
          <div className="grid grid-cols-5 gap-1 mb-3">
            <AttributeTooltip attribute="combat" value={selectedUnit.combat} />
            <AttributeTooltip attribute="acuity" value={selectedUnit.acuity} />
            <AttributeTooltip attribute="focus" value={selectedUnit.focus} />
            <AttributeTooltip attribute="armor" value={selectedUnit.armor} />
            <AttributeTooltip
              attribute="vitality"
              value={selectedUnit.vitality}
            />
          </div>

          {/* Ações e Movimentos */}
          <div className="border-t border-metal-iron/30 pt-3 mb-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Ações - Quadrados Verdes */}
              <div className="flex flex-col items-center">
                <ActionSquares total={1} remaining={selectedUnit.actionsLeft} />
                <span className="text-parchment-dark text-[10px] mt-1">
                  Ações
                </span>
              </div>
              {/* Movimentos - Bolinhas Azuis */}
              <div className="flex flex-col items-center">
                <MovementDots
                  total={Math.max(selectedUnit.movesLeft, selectedUnit.acuity)}
                  remaining={selectedUnit.movesLeft}
                />
                <span className="text-parchment-dark text-[10px] mt-1">
                  Movimentos
                </span>
              </div>
            </div>
          </div>

          {/* Condições - Bloco dedicado com tooltips */}
          {selectedUnit.conditions.length > 0 && (
            <div className="border-t border-metal-iron/30 pt-3 mb-3">
              <h4 className="text-parchment-dark text-xs mb-2 font-semibold flex items-center gap-1">
                <span>⚠️</span> Condições Ativas
              </h4>
              <div className="flex flex-wrap gap-1">
                {selectedUnit.conditions.map((cond, i) => (
                  <ConditionBadge key={i} condition={cond} />
                ))}
              </div>
            </div>
          )}

          {/* Lista de Ações Disponíveis */}
          {isMyTurn && selectedUnit.ownerId === currentUserId && (
            <div className="border-t border-metal-iron/30 pt-3">
              <h4 className="text-parchment-dark text-xs mb-2 font-semibold flex items-center gap-1">
                <span>⚡</span> Ações
                {pendingAction && (
                  <span className="ml-auto text-amber-400 text-[10px] animate-pulse">
                    Selecione um alvo...
                  </span>
                )}
              </h4>

              {/* Grid de Ações */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {selectedUnit.actions
                  ?.filter((actionKey) => actionKey !== "move")
                  .map((actionKey) => {
                    const actionInfo = ACTIONS_INFO[actionKey];
                    if (!actionInfo) return null;

                    const isTargetAction = actionInfo.requiresTarget;
                    const isActive = pendingAction === actionKey;
                    const color =
                      COLOR_CLASSES[actionInfo.color] || COLOR_CLASSES.gray;

                    return (
                      <div key={actionKey} className="relative group">
                        <button
                          onClick={() => {
                            if (selectedUnit.actionsLeft <= 0) return;
                            if (isTargetAction) {
                              onSetPendingAction(isActive ? null : actionKey);
                            } else {
                              onExecuteAction(actionKey, selectedUnit.id);
                            }
                          }}
                          disabled={selectedUnit.actionsLeft <= 0}
                          className={`w-full p-1.5 rounded-lg border-2 text-center transition-all ${
                            isActive
                              ? color.active
                              : selectedUnit.actionsLeft > 0
                              ? `${color.normal} cursor-pointer`
                              : "bg-gray-800/40 border-gray-600/30 opacity-50 cursor-not-allowed"
                          }`}
                          style={{
                            cursor:
                              selectedUnit.actionsLeft > 0
                                ? isTargetAction
                                  ? "var(--cursor-target)"
                                  : "var(--cursor-action)"
                                : "var(--cursor-not-allowed)",
                          }}
                        >
                          <span className="text-lg block">
                            {actionInfo.icon}
                          </span>
                          <span className="text-parchment-light text-[10px] font-semibold block">
                            {actionInfo.name}
                          </span>
                        </button>
                        <div className="absolute z-[9999] top-full left-1/2 -translate-x-1/2 mt-2 w-40 p-2 bg-citadel-obsidian border border-metal-iron rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-parchment-light font-bold text-[10px] mb-0.5">
                            {actionInfo.icon} {actionInfo.name}
                          </p>
                          <p className="text-parchment-aged text-[9px]">
                            {actionInfo.description}
                          </p>
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-citadel-obsidian border-l border-t border-metal-iron"></div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Cancelar ação pendente */}
              {pendingAction && (
                <button
                  onClick={() => onSetPendingAction(null)}
                  className="w-full mb-2 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-parchment-dark text-xs hover:bg-gray-600/50 transition-colors"
                >
                  ✕ Cancelar{" "}
                  {pendingAction === "attack" ? "Ataque" : pendingAction}
                </button>
              )}

              {/* Finalizar Turno */}
              <button
                onClick={onEndAction}
                className="w-full py-2 bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-500 rounded-lg text-parchment-light text-sm font-bold hover:from-amber-500 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
              >
                <span>⏭️</span>
                <span>Finalizar Turno</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-citadel-granite rounded-xl border-2 border-metal-iron p-3 shadow-stone-raised flex-shrink-0">
          <p className="text-parchment-dark text-center text-xs">
            Selecione uma unidade para ver detalhes
          </p>
        </div>
      )}
    </div>
  );
};
