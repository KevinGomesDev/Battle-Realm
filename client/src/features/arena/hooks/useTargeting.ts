// client/src/features/arena/hooks/useTargeting.ts
// Hook para gerenciar o sistema de targeting no frontend

import { useMemo, useCallback } from "react";
import type { BattleUnitState } from "@/services/colyseus.service";
import {
  calculateTargetingPreview,
  skillToTargetingConfig,
  spellToTargetingConfig,
  handleQTE,
  type TargetingConfig,
  type TargetingPreview,
  type GridContext,
  type UnitStats,
  type TargetingCell,
} from "../../../../../shared/utils/targeting.utils";
import {
  findSkillByCode,
  isCommonAction,
} from "../../../../../shared/data/abilities.data";
import { getAbilityByCode as getSpellByCode } from "../../../../../shared/data/abilities.data";

/**
 * Props para o hook de targeting
 */
interface UseTargetingProps {
  /** Unidade atualmente selecionada */
  selectedUnit: BattleUnitState | undefined;
  /** Ação pendente (skill code, "spell:CODE" ou ação comum) */
  pendingAction: string | null;
  /** Célula sob o mouse */
  hoveredCell: { x: number; y: number } | null;
  /** Todas as unidades na batalha */
  units: BattleUnitState[];
  /** Configuração do grid */
  gridConfig: {
    width: number;
    height: number;
    obstacles: Array<{ posX: number; posY: number; destroyed?: boolean }>;
  };
  /** Modificador de range de ataque (de condições) */
  attackRangeMod?: number;
}

/**
 * Resultado do hook de targeting
 */
interface UseTargetingResult {
  /** Preview de targeting calculado */
  targetingPreview: TargetingPreview | null;
  /** Configuração de targeting ativa */
  targetingConfig: TargetingConfig | null;
  /** Se está em modo de targeting (tem preview ativo) */
  isTargeting: boolean;
  /** Confirmar o alvo atual */
  confirmTarget: () => void;
  /** Verificar se uma célula está no range selecionável */
  isCellSelectable: (x: number, y: number) => boolean;
  /** Verificar se uma célula será afetada */
  isCellAffected: (x: number, y: number) => boolean;
}

/**
 * Extrai stats da unidade para cálculos de targeting
 */
function extractUnitStats(unit: BattleUnitState): UnitStats {
  return {
    combat: unit.combat ?? 1,
    speed: unit.speed ?? 1,
    focus: unit.focus ?? 1,
    resistance: unit.resistance ?? 1,
    will: unit.will ?? 1,
    vitality: unit.vitality ?? 1,
    level: unit.level ?? 1,
  };
}

/**
 * Hook para gerenciar o sistema de targeting
 * Calcula preview de células selecionáveis e afetadas
 */
export function useTargeting({
  selectedUnit,
  pendingAction,
  hoveredCell,
  units,
  gridConfig,
  attackRangeMod = 0,
}: UseTargetingProps): UseTargetingResult {
  // Construir contexto do grid
  const gridContext: GridContext = useMemo(
    () => ({
      gridWidth: gridConfig.width,
      gridHeight: gridConfig.height,
      obstacles: gridConfig.obstacles,
      units: units.map((u) => ({
        id: u.id,
        posX: u.posX,
        posY: u.posY,
        isAlive: u.isAlive,
        ownerId: u.ownerId,
      })),
    }),
    [gridConfig, units]
  );

  // Calcular configuração de targeting baseada na ação pendente
  const targetingConfig: TargetingConfig | null = useMemo(() => {
    if (!pendingAction || !selectedUnit) return null;

    // Ignorar ações comuns que não precisam de targeting visual
    // (DODGE não precisa de targeting, é self-target)
    if (pendingAction === "DODGE") return null;

    // Ataque básico
    if (pendingAction === "ATTACK" || pendingAction === "attack") {
      // attackRange vem da unidade (default 1 para melee)
      // Usamos type assertion pois o schema pode não ter essa prop exposta
      const baseRange =
        (selectedUnit as unknown as { attackRange?: number }).attackRange ?? 1;
      const finalRange = baseRange + attackRangeMod;
      return {
        range: finalRange <= 1 ? "MELEE" : "RANGED",
        rangeDistance: finalRange,
        targetType: "POSITION", // Baseado em célula, não em unidade
        shape: "SINGLE",
        includeSelf: false,
      } as TargetingConfig;
    }

    // DASH
    if (pendingAction === "DASH" || pendingAction === "dash") {
      const dashRange = selectedUnit.speed ?? 3;
      return {
        range: "RANGED",
        rangeDistance: dashRange,
        targetType: "GROUND",
        shape: "SINGLE",
        includeSelf: false,
      } as TargetingConfig;
    }

    // Spell
    if (pendingAction.startsWith("spell:")) {
      const spellCode = pendingAction.replace("spell:", "");
      const spell = getSpellByCode(spellCode);
      if (!spell) return null;

      return spellToTargetingConfig({
        range: spell.range,
        rangeDistance: spell.rangeDistance,
        targetType: spell.targetType,
        targetingShape: spell.targetingShape,
        areaSize: spell.areaSize,
      });
    }

    // Skill (não é ação comum)
    if (!isCommonAction(pendingAction)) {
      const skill = findSkillByCode(pendingAction);
      if (!skill) return null;

      // Skills SELF não precisam de targeting visual (auto-target)
      if (skill.targetType === "SELF") return null;

      return skillToTargetingConfig(
        {
          range: skill.range,
          rangeDistance: skill.rangeDistance,
          rangeValue: skill.rangeValue,
          targetType: skill.targetType,
          targetingShape: skill.targetingShape,
          areaSize: skill.areaSize,
        },
        attackRangeMod
      );
    }

    return null;
  }, [pendingAction, selectedUnit, attackRangeMod]);

  // Calcular preview de targeting
  const targetingPreview: TargetingPreview | null = useMemo(() => {
    if (!targetingConfig || !selectedUnit) return null;

    const unitStats = extractUnitStats(selectedUnit);

    const preview = calculateTargetingPreview(
      targetingConfig,
      selectedUnit.posX,
      selectedUnit.posY,
      unitStats,
      gridContext,
      hoveredCell?.x,
      hoveredCell?.y
    );

    return preview;
  }, [targetingConfig, selectedUnit, gridContext, hoveredCell]);

  // Verificar se uma célula está no range selecionável
  const isCellSelectable = useCallback(
    (x: number, y: number): boolean => {
      if (!targetingPreview) return false;
      return targetingPreview.selectableCells.some(
        (cell: TargetingCell) => cell.x === x && cell.y === y
      );
    },
    [targetingPreview]
  );

  // Verificar se uma célula será afetada
  const isCellAffected = useCallback(
    (x: number, y: number): boolean => {
      if (!targetingPreview) return false;
      return targetingPreview.affectedCells.some(
        (cell: TargetingCell) => cell.x === x && cell.y === y
      );
    },
    [targetingPreview]
  );

  // Confirmar o alvo atual (chama handleQTE)
  const confirmTarget = useCallback(() => {
    if (!selectedUnit || !hoveredCell || !targetingPreview?.isValidTarget)
      return;

    // Determinar tipo de ação
    let actionType: "ATTACK" | "SKILL" | "SPELL" = "SKILL";
    let abilityCode: string | undefined;

    if (
      pendingAction === "ATTACK" ||
      pendingAction === "attack" ||
      pendingAction === "DASH" ||
      pendingAction === "dash"
    ) {
      actionType = "ATTACK";
    } else if (pendingAction?.startsWith("spell:")) {
      actionType = "SPELL";
      abilityCode = pendingAction.replace("spell:", "");
    } else if (pendingAction) {
      actionType = "SKILL";
      abilityCode = pendingAction;
    }

    // Chamar handleQTE (placeholder por enquanto)
    handleQTE(
      actionType,
      selectedUnit.id,
      hoveredCell.x,
      hoveredCell.y,
      abilityCode
    );
  }, [selectedUnit, hoveredCell, targetingPreview, pendingAction]);

  return {
    targetingPreview,
    targetingConfig,
    isTargeting: targetingConfig !== null && targetingPreview !== null,
    confirmTarget,
    isCellSelectable,
    isCellAffected,
  };
}
