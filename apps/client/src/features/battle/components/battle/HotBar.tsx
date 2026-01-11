// HotBar.tsx - Barra numérica de atalhos (1-9 e Shift+1-9)
import React, { useState, useRef, useCallback, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "@/components/Tooltip";
import { useBattleStore } from "@/stores/battleStore";
import {
  getAbilityInfo,
  findAbilityByCode,
} from "@boundless/shared/data/abilities.data";
import type {
  UnitHotbarConfig,
  HotbarSlot,
} from "@boundless/shared/types/hotbar.types";
import { createDefaultHotbar } from "@boundless/shared/types/hotbar.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

// =============================================================================
// TIPOS
// =============================================================================

interface HotBarProps {
  unit: BattleUnit;
  hotbar: UnitHotbarConfig | null;
  canAct: boolean;
  pendingAbilityCode: string | null;
  onSelectAbility: (abilityCode: string) => void;
  onUpdateHotbar: (hotbar: UnitHotbarConfig) => void;
  /** Callback quando o mouse passa sobre uma ability (para mostrar zona de dash) */
  onAbilityHover?: (abilityCode: string | null) => void;
}

interface HotBarSlotProps {
  index: number;
  abilityCode: HotbarSlot;
  unit: BattleUnit;
  canAct: boolean;
  isActive: boolean;
  isSecondary: boolean;
  onActivate: () => void;
  onDragStart: (index: number, isSecondary: boolean) => void;
  onDragEnd: () => void;
  onDrop: (targetIndex: number, isSecondary: boolean) => void;
  dragState: DragState | null;
  /** Callback quando o mouse passa sobre a ability */
  onAbilityHover?: (abilityCode: string | null) => void;
}

interface DragState {
  sourceIndex: number;
  sourceIsSecondary: boolean;
}

// =============================================================================
// COMPONENTE: HotBarSlot
// =============================================================================

const HotBarSlot: React.FC<HotBarSlotProps> = ({
  index,
  abilityCode,
  unit,
  canAct,
  isActive,
  isSecondary,
  onActivate,
  onDragStart,
  onDragEnd,
  onDrop,
  dragState,
  onAbilityHover,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const slotRef = useRef<HTMLButtonElement>(null);

  const abilityInfo = abilityCode ? getAbilityInfo(abilityCode) : null;
  const abilityDef = abilityCode ? findAbilityByCode(abilityCode) : null;

  // Verificar se a ability pode ser usada
  const { canExecute, disabledReason } = useMemo(() => {
    if (!abilityCode || !abilityInfo || !abilityDef) {
      return { canExecute: false, disabledReason: "Slot vazio" };
    }

    // Passivas não são executáveis
    if (abilityDef.activationType === "PASSIVE") {
      return { canExecute: false, disabledReason: "Passiva" };
    }

    // Verificar cooldown
    const cooldownLeft = unit.unitCooldowns?.[abilityCode] ?? 0;
    if (cooldownLeft > 0) {
      return {
        canExecute: false,
        disabledReason: `Em recarga (${cooldownLeft} ${
          cooldownLeft === 1 ? "turno" : "turnos"
        })`,
      };
    }

    // Verificar ações disponíveis (apenas se a habilidade consome ação)
    const consumesAction = abilityDef.consumesAction !== false;
    const isAttackAction = abilityCode === "ATTACK";
    const hasExtraAttacks = (unit.attacksLeftThisTurn ?? 0) > 0;
    if (isAttackAction) {
      if (unit.actionsLeft <= 0 && !hasExtraAttacks) {
        return { canExecute: false, disabledReason: "Sem ações" };
      }
    } else if (consumesAction && unit.actionsLeft <= 0) {
      return { canExecute: false, disabledReason: "Sem ações" };
    }

    // Verificar mana
    if (abilityDef.manaCost) {
      const manaCost = abilityDef.manaCost;
      if ((unit.currentMana ?? 0) < manaCost) {
        return { canExecute: false, disabledReason: `Mana: ${manaCost}` };
      }
    }

    return { canExecute: true, disabledReason: null };
  }, [abilityCode, abilityInfo, abilityDef, unit]);

  const cooldownLeft = abilityCode ? unit.unitCooldowns?.[abilityCode] ?? 0 : 0;

  const handleDragStart = (e: React.DragEvent) => {
    if (!abilityCode) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}-${isSecondary ? "1" : "0"}`);
    onDragStart(index, isSecondary);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(index, isSecondary);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  const isEmpty = !abilityCode;
  const isBeingDragged =
    dragState?.sourceIndex === index &&
    dragState?.sourceIsSecondary === isSecondary;

  // Cores baseadas no tipo de ability
  const getSlotColor = () => {
    if (!abilityDef) return { main: "#4b5563", hover: "#6b7280" }; // gray
    if (abilityDef.manaCost) return { main: "#3b82f6", hover: "#60a5fa" }; // blue (mana-based)
    if (abilityDef.commonAction) return { main: "#f59e0b", hover: "#fbbf24" }; // amber
    return { main: "#a855f7", hover: "#c084fc" }; // purple
  };

  const colors = getSlotColor();
  const keyNumber = index + 1;

  return (
    <button
      ref={slotRef}
      draggable={!!abilityCode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (canAct && canExecute && abilityCode) {
          onActivate();
        }
      }}
      onMouseEnter={() => {
        setShowTooltip(true);
        if (abilityCode) {
          onAbilityHover?.(abilityCode);
        }
      }}
      onMouseLeave={() => {
        setShowTooltip(false);
        onAbilityHover?.(null);
      }}
      disabled={!canAct || !canExecute}
      className={`
        relative w-10 h-10 rounded-lg border-2 flex flex-col items-center justify-center
        transition-all duration-150 cursor-pointer
        ${isEmpty ? "opacity-30 cursor-default" : ""}
        ${isActive ? "ring-2 ring-white/80 scale-110 z-10" : ""}
        ${isDragOver ? "ring-2 ring-stellar-amber/80 scale-105" : ""}
        ${isBeingDragged ? "opacity-40 scale-95" : ""}
        ${!canExecute && !isEmpty ? "opacity-50 grayscale" : ""}
        hover:scale-105 hover:brightness-110
        active:scale-95
      `}
      style={{
        borderColor: isEmpty ? "#374151" : `${colors.main}80`,
        backgroundColor: isEmpty ? "#1f293780" : `${colors.main}20`,
      }}
    >
      {/* Número do slot (canto superior esquerdo) */}
      <span
        className={`
          absolute -top-1 -left-1 w-4 h-4 rounded-full text-[9px] font-bold
          flex items-center justify-center z-20
          ${
            isSecondary
              ? "bg-violet-600 text-white"
              : "bg-surface-700 text-surface-300"
          }
        `}
      >
        {keyNumber}
      </span>

      {/* Ícone da ability */}
      {abilityInfo ? (
        <span className="text-lg leading-none">{abilityInfo.icon}</span>
      ) : (
        <span className="text-surface-600 text-lg">·</span>
      )}

      {/* Indicador de cooldown */}
      {cooldownLeft > 0 && (
        <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center">
          <span className="text-xs text-surface-400">⏳</span>
          <span className="text-red-400 font-bold text-sm">{cooldownLeft}</span>
        </div>
      )}

      {/* Tooltip */}
      {abilityInfo && (
        <Tooltip
          anchorRef={slotRef}
          visible={showTooltip}
          preferredPosition="top"
          width="w-56"
        >
          <div className="flex items-start gap-2">
            <span className="text-xl">{abilityInfo.icon}</span>
            <div className="flex-1">
              <p className="font-bold text-xs" style={{ color: colors.main }}>
                {abilityInfo.name}
                <span className="ml-1 text-surface-400 font-normal">
                  [{isSecondary ? "Shift+" : ""}
                  {keyNumber}]
                </span>
              </p>
              <p className="text-surface-200 text-[10px] leading-relaxed mt-0.5">
                {abilityInfo.description}
              </p>
              {disabledReason && (
                <p className="text-red-400 text-[9px] mt-1 flex items-center gap-1">
                  <span>⚠️</span> {disabledReason}
                </p>
              )}
              {abilityDef?.manaCost && (
                <p className="text-cyan-400 text-[9px] mt-0.5">
                  💧 Mana: {abilityDef.manaCost}
                </p>
              )}
            </div>
          </div>
        </Tooltip>
      )}
    </button>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL: HotBar
// =============================================================================

export const HotBar: React.FC<HotBarProps> = ({
  unit,
  hotbar: hotbarProp,
  canAct,
  pendingAbilityCode,
  onSelectAbility,
  onUpdateHotbar,
  onAbilityHover,
}) => {
  const [showSecondary, setShowSecondary] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // PONTO ÚNICO: Acessa executeAbility diretamente do store
  const executeAbility = useBattleStore((state) => state.executeAbility);

  // Inicializar hotbar se não existir
  const hotbar = useMemo(() => {
    // Se foi passada via prop, usa ela
    if (hotbarProp && hotbarProp.primary && hotbarProp.secondary) {
      return hotbarProp;
    }

    // Tentar parsear do campo hotbar da unidade (vem do servidor como JSON string)
    if (unit.hotbar && unit.hotbar !== "{}") {
      try {
        const parsed =
          typeof unit.hotbar === "string"
            ? JSON.parse(unit.hotbar)
            : unit.hotbar;
        if (parsed.primary && parsed.secondary) {
          return parsed as UnitHotbarConfig;
        }
      } catch {
        // Ignora erro de parse
      }
    }

    // Filtrar passivas das features (só mostrar habilidades ativas)
    const activeFeatures = (unit.features || []).filter((code) => {
      const ability = findAbilityByCode(code);
      return ability && ability.activationType !== "PASSIVE";
    });

    // Filtrar passivas dos spells também
    const activeSpells = (unit.spells || []).filter((code) => {
      const ability = findAbilityByCode(code);
      return ability && ability.activationType !== "PASSIVE";
    });

    // Criar hotbar default baseado nas features e spells ATIVAS da unidade
    return createDefaultHotbar(activeFeatures, activeSpells);
  }, [hotbarProp, unit.hotbar, unit.features, unit.spells]);

  // Verificar se a barra secundária tem slots
  const hasSecondarySlots = useMemo(() => {
    return hotbar.secondary.some((slot) => slot !== null);
  }, [hotbar.secondary]);

  // Handlers de drag and drop
  const handleDragStart = useCallback((index: number, isSecondary: boolean) => {
    setDragState({ sourceIndex: index, sourceIsSecondary: isSecondary });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number, targetIsSecondary: boolean) => {
      if (!dragState) return;

      const { sourceIndex, sourceIsSecondary } = dragState;

      // Criar cópia do hotbar
      const newHotbar: UnitHotbarConfig = {
        primary: [...hotbar.primary] as UnitHotbarConfig["primary"],
        secondary: [...hotbar.secondary] as UnitHotbarConfig["secondary"],
      };

      // Swap os slots
      const sourceBar = sourceIsSecondary ? "secondary" : "primary";
      const targetBar = targetIsSecondary ? "secondary" : "primary";

      const temp = newHotbar[targetBar][targetIndex];
      newHotbar[targetBar][targetIndex] = newHotbar[sourceBar][sourceIndex];
      newHotbar[sourceBar][sourceIndex] = temp;

      onUpdateHotbar(newHotbar);
      setDragState(null);
    },
    [dragState, hotbar, onUpdateHotbar]
  );

  // Ativar ability
  const handleActivate = useCallback(
    (abilityCode: string) => {
      const abilityDef = findAbilityByCode(abilityCode);
      if (!abilityDef) return;

      // Passivas não podem ser ativadas
      if (abilityDef.activationType === "PASSIVE") return;

      // Verificar cooldown
      const cooldownLeft = unit.unitCooldowns?.[abilityCode] ?? 0;
      if (cooldownLeft > 0) return;

      // Verificar ações disponíveis (apenas se a habilidade consome ação)
      const consumesAction = abilityDef.consumesAction !== false;
      const isAttackAction = abilityCode === "ATTACK";
      const hasExtraAttacks = (unit.attacksLeftThisTurn ?? 0) > 0;
      if (isAttackAction) {
        if (unit.actionsLeft <= 0 && !hasExtraAttacks) return;
      } else if (consumesAction && unit.actionsLeft <= 0) {
        return;
      }

      // Verificar mana
      if (abilityDef.manaCost) {
        const manaCost = abilityDef.manaCost;
        if ((unit.currentMana ?? 0) < manaCost) return;
      }

      if (abilityDef.targetType === "SELF" || !abilityDef.targetType) {
        // Executa imediatamente - PONTO ÚNICO de envio para servidor
        executeAbility(unit.id, abilityCode);
      } else {
        // Precisa de alvo
        onSelectAbility(abilityCode);
      }
    },
    [unit, onSelectAbility, executeAbility]
  );

  // Atalhos de teclado para barra primária (1-9)
  useHotkeys(
    "1,2,3,4,5,6,7,8,9",
    (_e, handler) => {
      if (!canAct) return;
      const key = handler.keys?.[0];
      if (!key) return;
      const index = parseInt(key) - 1;
      const abilityCode = hotbar.primary[index];
      if (abilityCode) {
        handleActivate(abilityCode);
      }
    },
    { enabled: canAct },
    [canAct, hotbar, handleActivate]
  );

  // Atalhos de teclado para barra secundária (Shift+1-9)
  useHotkeys(
    "shift+1,shift+2,shift+3,shift+4,shift+5,shift+6,shift+7,shift+8,shift+9",
    (_e, handler) => {
      if (!canAct || !showSecondary) return;
      const key = handler.keys?.[0];
      if (!key) return;
      const index = parseInt(key) - 1;
      const abilityCode = hotbar.secondary[index];
      if (abilityCode) {
        handleActivate(abilityCode);
      }
    },
    { enabled: canAct && showSecondary },
    [canAct, showSecondary, hotbar, handleActivate]
  );

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Barra Secundária (Shift+1-9) - Expansível */}
      <AnimatePresence>
        {showSecondary && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 px-2 py-1.5 bg-surface-900/80 backdrop-blur-sm rounded-xl border border-violet-500/30"
          >
            <span className="text-violet-400 text-[9px] font-bold mr-1 uppercase">
              Shift+
            </span>
            {hotbar.secondary.map((slot, index) => (
              <HotBarSlot
                key={`secondary-${index}`}
                index={index}
                abilityCode={slot}
                unit={unit}
                canAct={canAct}
                isActive={slot === pendingAbilityCode}
                isSecondary={true}
                onActivate={() => slot && handleActivate(slot)}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                dragState={dragState}
                onAbilityHover={onAbilityHover}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra Primária (1-9) */}
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-900/60 backdrop-blur-sm rounded-xl border border-stellar-amber/20">
        {hotbar.primary.map((slot, index) => (
          <HotBarSlot
            key={`primary-${index}`}
            index={index}
            abilityCode={slot}
            unit={unit}
            canAct={canAct}
            isActive={slot === pendingAbilityCode}
            isSecondary={false}
            onActivate={() => slot && handleActivate(slot)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            dragState={dragState}
            onAbilityHover={onAbilityHover}
          />
        ))}

        {/* Botão para expandir barra secundária */}
        {hasSecondarySlots && (
          <button
            onClick={() => setShowSecondary(!showSecondary)}
            className={`
              ml-1 w-8 h-10 rounded-lg border-2 flex items-center justify-center
              transition-all duration-150 hover:scale-105
              ${
                showSecondary
                  ? "bg-violet-500/30 border-violet-500/60 text-violet-300"
                  : "bg-surface-800/50 border-surface-600/50 text-surface-400 hover:text-violet-300 hover:border-violet-500/40"
              }
            `}
            title={
              showSecondary
                ? "Esconder barra secundária"
                : "Mostrar barra secundária (Shift+1-9)"
            }
          >
            <span className="text-sm">{showSecondary ? "▼" : "▲"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
