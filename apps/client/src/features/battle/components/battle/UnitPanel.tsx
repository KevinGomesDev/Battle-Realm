import React, { useState, useRef, useMemo } from "react";
import { getConditionInfo } from "../../constants";
import {
  getSkillInfo,
  isCommonAction,
  findSkillByCode,
  getSpellByCode,
} from "../../../../../../shared/data/abilities.data";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import { AttributesDisplay } from "@/components/AttributesDisplay/index";
import { Tooltip } from "@/components/Tooltip";
import {
  AnimatedCharacterSprite,
  parseAvatarToHeroId,
} from "../../../kingdom/components/CreateKingdom";
import { isPlayerControllable } from "../../utils/unit-control";
import {
  PanelStrip,
  PanelStripButton,
  ActionStripButton,
  usePopupContainer,
  type ActionStripItem,
} from "./PanelStrip";
import { TurnResources } from "./TurnResources";
import { ActiveEffectsBadges } from "./ActiveEffectsBadges";

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

interface IconBadgeProps {
  icon: string;
  value?: string | number;
  name: string;
  description: string;
  color: string;
  details?: string[];
  /** Se true, o badge fica esmaecido (sem recurso) */
  inactive?: boolean;
}

// =============================================================================
// COMPONENTE GENÉRICO: IconBadge
// =============================================================================

/**
 * IconBadge - Componente genérico para exibir ícones com tooltip padronizado
 * Usado para: Stats derivados, Recursos (ação/movimento), Condições
 * Quando usado dentro de um popup (via PopupContainerContext), o tooltip é posicionado ao lado do popup
 */
const IconBadge: React.FC<IconBadgeProps> = ({
  icon,
  value,
  name,
  description,
  color,
  details,
  inactive = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const popupContainerRef = usePopupContainer();

  const displayColor = inactive ? "#6b7280" : color; // gray-500 quando inativo

  return (
    <div
      ref={badgeRef}
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`w-9 h-9 rounded-lg border-2 flex flex-col items-center justify-center cursor-help transition-all hover:scale-105 ${
          inactive ? "opacity-50" : ""
        }`}
        style={{
          borderColor: displayColor,
          backgroundColor: `${displayColor}15`,
        }}
      >
        <span className="text-sm leading-none">{icon}</span>
        {value !== undefined && (
          <span
            className="font-bold text-[10px] leading-none mt-0.5"
            style={{ color: displayColor }}
          >
            {value}
          </span>
        )}
      </div>

      {/* Tooltip Padronizado - usa containerRef se dentro de popup */}
      <Tooltip
        anchorRef={badgeRef}
        containerRef={popupContainerRef ?? undefined}
        visible={showTooltip}
        preferredPosition="left"
        width="w-56"
      >
        <p
          className="font-bold text-xs mb-1 flex items-center gap-1.5"
          style={{ color }}
        >
          <span className="text-base">{icon}</span>
          <span>{name}</span>
          {value !== undefined && (
            <span className="ml-auto font-mono" style={{ color }}>
              {value}
            </span>
          )}
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {description}
        </p>
        {details && details.length > 0 && (
          <div className="border-t border-surface-600 pt-1 mt-1">
            {details.map((detail, i) => (
              <p
                key={i}
                className="text-surface-300 text-[9px] flex items-center gap-1"
              >
                <span className="text-surface-400">•</span>
                {detail}
              </p>
            ))}
          </div>
        )}
      </Tooltip>
    </div>
  );
};

// =============================================================================
// COMPONENTE: ResourceBar (Barra de recurso com tooltip)
// =============================================================================

interface ResourceBarProps {
  current: number;
  max: number;
  label: string;
  icon: string;
  color: "red" | "orange" | "cyan" | "violet";
  description: string;
  details?: string[];
  showLabel?: boolean;
  size?: "sm" | "md";
}

const ResourceBar: React.FC<ResourceBarProps> = ({
  current,
  max,
  label,
  icon,
  color,
  description,
  details = [],
  showLabel = true,
  size = "md",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const colorStyles = {
    red: {
      gradient: "from-red-600 to-red-500",
      border: "border-red-900/50",
      text: "text-red-400",
      labelBg: "bg-red-900/80",
    },
    orange: {
      gradient: "from-orange-600 to-amber-500",
      border: "border-orange-500/40",
      text: "text-orange-400",
      labelBg: "bg-orange-900/80",
    },
    cyan: {
      gradient: "from-cyan-600 to-cyan-400",
      border: "border-cyan-500/40",
      text: "text-cyan-400",
      labelBg: "bg-cyan-900/80",
    },
    violet: {
      gradient: "from-violet-600 to-purple-400",
      border: "border-violet-500/40",
      text: "text-violet-400",
      labelBg: "bg-violet-900/80",
    },
  };

  const styles = colorStyles[color];
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const height = size === "sm" ? "h-4" : "h-5";

  return (
    <div
      ref={barRef}
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`relative ${height} bg-surface-800/80 rounded ${styles.border} border overflow-hidden cursor-help`}
      >
        {/* Label flutuante */}
        {showLabel && (
          <span
            className={`absolute left-1 top-1/2 -translate-y-1/2 ${styles.labelBg} ${styles.text} text-[8px] font-bold px-1 py-0.5 rounded z-10 uppercase`}
          >
            {icon}
          </span>
        )}

        {/* Barra de progresso */}
        {current > 0 ? (
          <>
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${styles.gradient} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white font-bold text-[10px] drop-shadow z-10">
              {current}/{max}
            </span>
          </>
        ) : (
          <span
            className={`absolute inset-0 flex items-center justify-center ${styles.text} font-bold text-[10px] italic opacity-50`}
          >
            {max > 0 ? "Vazio" : "—"}
          </span>
        )}
      </div>

      <Tooltip
        anchorRef={barRef}
        visible={showTooltip}
        preferredPosition="top"
        width="w-48"
      >
        <p className="text-astral-chrome font-bold text-xs mb-1 flex items-center gap-1.5">
          <span>{icon}</span>
          <span>{label}</span>
          <span className={`ml-auto ${styles.text} font-mono`}>
            {current}/{max}
          </span>
        </p>
        <p className="text-surface-200 text-[10px] leading-relaxed">
          {description}
        </p>
        {details.length > 0 && (
          <div className="border-t border-surface-600 pt-1 mt-1">
            {details.map((detail, i) => (
              <p
                key={i}
                className="text-surface-300 text-[9px] flex items-center gap-1"
              >
                <span className="text-surface-400">•</span>
                {detail}
              </p>
            ))}
          </div>
        )}
      </Tooltip>
    </div>
  );
};

// =============================================================================
// COMPONENTES AUXILIARES
// =============================================================================

// Condition Badge - Usa IconBadge genérico
const ConditionBadge: React.FC<{ condition: string }> = ({ condition }) => {
  const info = getConditionInfo(condition);

  return (
    <IconBadge
      icon={info.icon}
      name={info.name}
      description={info.description}
      color={info.color}
    />
  );
};

// =============================================================================
// CORES DAS AÇÕES
// =============================================================================

const ACTION_COLORS = {
  action: { main: "#f59e0b", hover: "#fbbf24" }, // Amber
  skill: { main: "#a855f7", hover: "#c084fc" }, // Purple
  spell: { main: "#3b82f6", hover: "#60a5fa" }, // Blue
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

interface UnitPanelProps {
  selectedUnit: BattleUnit | null;
  activeUnitId: string | null | undefined;
  isMyTurn: boolean;
  currentUserId: string;
  pendingAction: string | null;
  onSetPendingAction: (action: string | null) => void;
  onExecuteAction: (actionKey: string, unitId: string) => void;
}

export const UnitPanel: React.FC<UnitPanelProps> = ({
  selectedUnit,
  activeUnitId,
  isMyTurn,
  currentUserId,
  pendingAction,
  onSetPendingAction,
  onExecuteAction,
}) => {
  // Categorizar ações (fora do render condicional)
  // Ações comuns são skills com commonAction: true
  // Skills passivas NÃO devem aparecer (já aparecem como condições)
  const categorizedActions = useMemo(() => {
    const commonActions: string[] = [];
    const skills: string[] = [];
    const spells: string[] = [];

    if (selectedUnit) {
      // Features da unidade (ações comuns + skills de classe)
      selectedUnit.features?.forEach((featureCode) => {
        // Ações comuns (ATTACK, DASH, DODGE) vão para a aba de ações
        if (isCommonAction(featureCode)) {
          commonActions.push(featureCode);
        } else {
          // Skills de classe - só adiciona se for ATIVA (passivas já aparecem como condições)
          const skillInfo = getSkillInfo(featureCode);
          const skillDef = findSkillByCode(featureCode);
          if (skillInfo && skillDef && skillDef.activationType === "ACTIVE") {
            skills.push(featureCode);
          }
        }
      });

      // Spells (magias)
      if (selectedUnit.spells && selectedUnit.spells.length > 0) {
        selectedUnit.spells.forEach((spellCode) => {
          spells.push(spellCode);
        });
      }
    }

    return { actions: commonActions, skills, spells };
  }, [selectedUnit]);

  // Se activeUnitId está undefined mas é meu turno e a unidade é minha (e controlável),
  // consideramos que está "aguardando ativação" e tratamos como se fosse ativa
  const isActiveOrPending = activeUnitId
    ? selectedUnit?.id === activeUnitId
    : isMyTurn &&
      selectedUnit &&
      isPlayerControllable(selectedUnit, currentUserId);

  // Calcular características derivadas (ANTES do early return para respeitar regras de hooks)
  const derivedStats = useMemo(() => {
    if (!selectedUnit) return [];

    const result: IconBadgeProps[] = [];

    // Esquiva
    const baseDodge = selectedUnit.speed * 3;
    const hasDodging = selectedUnit.conditions.includes("DODGING");
    const dodgeBonus = hasDodging ? 50 : 0;
    const totalDodge = Math.min(baseDodge + dodgeBonus, 75);

    result.push({
      icon: "🌀",
      name: "Esquiva",
      value: `${totalDodge}%`,
      description: "Chance de evitar ataques físicos.",
      color: "#22d3ee",
      details: [
        `Base (Speed × 3): ${baseDodge}%`,
        ...(hasDodging ? [`Postura Defensiva: +${dodgeBonus}%`] : []),
        `Máximo: 75%`,
      ],
    });

    // Dano base
    result.push({
      icon: "⚔️",
      name: "Dano",
      value: selectedUnit.combat,
      description: "Dano de ataques físicos.",
      color: "#f87171",
    });

    // Poder mágico
    if (selectedUnit.focus > 0) {
      result.push({
        icon: "✨",
        name: "Poder Mágico",
        value: selectedUnit.focus,
        description: "Potência de magias.",
        color: "#a78bfa",
      });
    }

    // Movimento
    result.push({
      icon: "👣",
      name: "Movimento",
      value: selectedUnit.speed,
      description: "Células por turno.",
      color: "#60a5fa",
    });

    return result;
  }, [selectedUnit]);

  if (!selectedUnit) {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-surface-900 border-t-2 border-surface-600 shadow-cosmic">
        <div className="py-3 text-center">
          <p className="text-surface-200 text-sm flex items-center justify-center gap-2">
            <span className="text-xl">👁️</span>
            <span>Selecione uma unidade para ver detalhes</span>
          </p>
        </div>
      </div>
    );
  }

  const canAct =
    isMyTurn &&
    selectedUnit &&
    isPlayerControllable(selectedUnit, currentUserId) &&
    isActiveOrPending;

  // Preparar items das ações
  const actionItems: ActionStripItem[] = categorizedActions.actions
    .map((actionKey) => {
      const skillInfo = getSkillInfo(actionKey);
      if (!skillInfo) return null;

      const isAttackAction = actionKey === "ATTACK";
      const hasExtraAttacks = (selectedUnit.attacksLeftThisTurn ?? 0) > 0;
      const canExecute = isAttackAction
        ? selectedUnit.actionsLeft > 0 || hasExtraAttacks
        : selectedUnit.actionsLeft > 0;

      return {
        code: actionKey,
        icon: skillInfo.icon,
        name: skillInfo.name,
        description: skillInfo.description,
        requiresTarget: skillInfo.requiresTarget,
        disabled: !canExecute,
      };
    })
    .filter(Boolean) as ActionStripItem[];

  const skillItems: ActionStripItem[] = categorizedActions.skills
    .map((skillCode) => {
      const skillInfo = getSkillInfo(skillCode);
      if (!skillInfo) return null;

      const cooldownLeft = selectedUnit.unitCooldowns?.[skillCode] ?? 0;
      const isOnCooldown = cooldownLeft > 0;
      const canExecute = selectedUnit.actionsLeft > 0 && !isOnCooldown;

      return {
        code: skillCode,
        icon: skillInfo.icon,
        name: skillInfo.name,
        description: skillInfo.description,
        requiresTarget: skillInfo.requiresTarget,
        cooldown: cooldownLeft,
        disabled: !canExecute,
      };
    })
    .filter(Boolean) as ActionStripItem[];

  const spellItems: ActionStripItem[] = categorizedActions.spells
    .map((spellCode) => {
      const spellInfo = getSpellByCode(spellCode);
      if (!spellInfo) return null;

      const cooldownLeft = selectedUnit.unitCooldowns?.[spellCode] ?? 0;
      const isOnCooldown = cooldownLeft > 0;
      const canExecute = selectedUnit.actionsLeft > 0 && !isOnCooldown;

      return {
        code: spellCode,
        icon: spellInfo.icon ?? "🔮",
        name: spellInfo.name,
        description: spellInfo.description,
        requiresTarget: true,
        cooldown: cooldownLeft,
        disabled: !canExecute,
      };
    })
    .filter(Boolean) as ActionStripItem[];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      <div className="flex items-stretch bg-surface-900/95 backdrop-blur-sm border-t-2 border-stellar-amber/30 shadow-cosmic min-h-[56px]">
        {/* FAIXA: Avatar e Identificação */}
        <PanelStrip>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-surface-800 to-surface-900 border-2 border-stellar-amber/50 shadow-lg overflow-hidden flex items-center justify-center">
                <AnimatedCharacterSprite
                  heroId={parseAvatarToHeroId(selectedUnit.avatar)}
                  animation="Idle"
                  direction="right"
                />
              </div>
              <div className="absolute -top-0.5 -right-0.5 bg-stellar-amber text-cosmos-void font-bold text-[8px] px-1 py-0.5 rounded-full border border-stellar-gold">
                {selectedUnit.level}
              </div>
            </div>
            <div className="min-w-[70px]">
              <h3
                className="text-astral-chrome font-bold text-xs truncate"
                style={{ fontFamily: "'Rajdhani', sans-serif" }}
              >
                {selectedUnit.name}
              </h3>
              <p className="text-surface-400 text-[9px] uppercase">
                {selectedUnit.race}
              </p>
            </div>
          </div>
        </PanelStrip>

        {/* FAIXA: Barras (HP, Mana, Proteções) */}
        <PanelStrip>
          <div className="flex flex-col justify-center gap-1 min-w-[200px]">
            <ResourceBar
              current={selectedUnit.currentHp}
              max={selectedUnit.maxHp}
              label="Vida"
              icon="❤️"
              color="red"
              description="Pontos de vida. Quando chegar a 0, a unidade é derrotada."
              details={[`Vitality: ${selectedUnit.vitality}`]}
            />
            {selectedUnit.maxMana > 0 && (
              <ResourceBar
                current={selectedUnit.currentMana}
                max={selectedUnit.maxMana}
                label="Mana"
                icon="💧"
                color="cyan"
                description="Energia mágica para conjurar magias."
                details={[`Will: ${selectedUnit.will}`]}
                size="sm"
              />
            )}
            <div className="flex gap-1">
              <div className="flex-1">
                <ResourceBar
                  current={selectedUnit.physicalProtection}
                  max={selectedUnit.maxPhysicalProtection}
                  label="Armadura"
                  icon="🛡️"
                  color="orange"
                  description="Proteção física. Absorve dano físico."
                  details={[`Resistance: ${selectedUnit.resistance}`]}
                  size="sm"
                  showLabel={false}
                />
              </div>
              <div className="flex-1">
                <ResourceBar
                  current={selectedUnit.magicalProtection}
                  max={selectedUnit.maxMagicalProtection}
                  label="Barreira"
                  icon="✨"
                  color="violet"
                  description="Proteção mágica. Absorve dano mágico."
                  details={[`Will: ${selectedUnit.will}`]}
                  size="sm"
                  showLabel={false}
                />
              </div>
            </div>
          </div>
        </PanelStrip>

        {/* FAIXA: Atributos */}
        <PanelStrip>
          <AttributesDisplay
            attributes={{
              combat: selectedUnit.combat,
              speed: selectedUnit.speed,
              focus: selectedUnit.focus,
              resistance: selectedUnit.resistance,
              will: selectedUnit.will,
              vitality: selectedUnit.vitality,
            }}
            editable={false}
          />
        </PanelStrip>

        {/* FAIXA: Características Derivadas */}
        <PanelStripButton
          icon="📊"
          label="Características"
          count={derivedStats.length}
          color="#a78bfa"
          hasPopup
        >
          <div className="flex flex-wrap gap-1.5 max-w-[180px] justify-center">
            {derivedStats.map((stat, i) => (
              <IconBadge key={i} {...stat} />
            ))}
          </div>
        </PanelStripButton>

        {/* FAIXA: Efeitos Ativos (calculados pelo servidor) */}
        {selectedUnit.activeEffects &&
          Object.keys(selectedUnit.activeEffects).length > 0 && (
            <PanelStripButton
              icon="⚡"
              label="Efeitos"
              count={Object.keys(selectedUnit.activeEffects).length}
              color="#22c55e"
              hasPopup
            >
              <ActiveEffectsBadges activeEffects={selectedUnit.activeEffects} />
            </PanelStripButton>
          )}

        {/* FAIXA: Condições */}
        {selectedUnit.conditions.length > 0 && (
          <PanelStripButton
            icon="🔥"
            label="Condições"
            count={selectedUnit.conditions.length}
            color="#f59e0b"
            hasPopup
          >
            <div className="flex flex-wrap gap-1.5 max-w-[180px] justify-center">
              {selectedUnit.conditions.map((cond, i) => (
                <ConditionBadge key={i} condition={cond} />
              ))}
            </div>
          </PanelStripButton>
        )}

        {/* FAIXA: Recursos do Turno */}
        {isMyTurn && isActiveOrPending && selectedUnit.hasStartedAction && (
          <TurnResources
            actionsLeft={selectedUnit.actionsLeft}
            movesLeft={selectedUnit.movesLeft}
            maxActions={1}
            maxMoves={selectedUnit.speed}
          />
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Mensagem de visualização */}
        {isMyTurn &&
          selectedUnit &&
          isPlayerControllable(selectedUnit, currentUserId) &&
          !isActiveOrPending && (
            <PanelStrip bordered={false}>
              <div className="px-2 py-1 bg-stellar-amber/20 border border-stellar-amber/50 rounded">
                <p className="text-stellar-amber text-[9px] font-semibold">
                  👁️ Visualizando
                </p>
              </div>
            </PanelStrip>
          )}

        {/* FAIXA: Ações (destaque especial) */}
        {canAct && (
          <div className="flex items-stretch gap-0.5 flex-shrink-0 bg-surface-800/30 pl-1">
            <ActionStripButton
              icon="⚔️"
              label="Ações"
              color={ACTION_COLORS.action.main}
              hoverColor={ACTION_COLORS.action.hover}
              items={actionItems}
              pendingAction={pendingAction}
              onExecuteAction={(code, requiresTarget) => {
                if (requiresTarget) {
                  onSetPendingAction(code);
                } else {
                  onExecuteAction(code, selectedUnit.id);
                }
              }}
            />

            <ActionStripButton
              icon="✨"
              label="Habilidades"
              color={ACTION_COLORS.skill.main}
              hoverColor={ACTION_COLORS.skill.hover}
              items={skillItems}
              pendingAction={pendingAction}
              onExecuteAction={(code, requiresTarget) => {
                if (requiresTarget) {
                  onSetPendingAction(code);
                } else {
                  onExecuteAction(code, selectedUnit.id);
                }
              }}
            />

            <ActionStripButton
              icon="🔮"
              label="Magias"
              color={ACTION_COLORS.spell.main}
              hoverColor={ACTION_COLORS.spell.hover}
              items={spellItems}
              pendingAction={pendingAction}
              onExecuteAction={(code, _requiresTarget) => {
                onSetPendingAction(`spell:${code}`);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
