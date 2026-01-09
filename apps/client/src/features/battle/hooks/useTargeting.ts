// client/src/features/battle/hooks/useTargeting.ts
// Hook para gerenciar o sistema de targeting no frontend
// Usa o novo sistema baseado em CoordinatePattern

import { useMemo, useCallback } from "react";
import type { BattleUnitState } from "@/services/colyseus.service";
import {
  calculateTargetingPreview,
  handleQTE,
  type TargetingPreview,
  type GridContext,
  type UnitStats,
  type TargetingCell,
  type CoordinatePattern,
} from "@boundless/shared/utils/targeting.utils";
import { PATTERNS } from "@boundless/shared/data/targeting-patterns.data";
import type { PendingAbility } from "../types/pending-ability.types";

/**
 * Props para o hook de targeting
 */
interface UseTargetingProps {
  /** Unidade atualmente selecionada */
  selectedUnit: BattleUnitState | undefined;
  /** Ability pendente aguardando alvo (tipado) */
  pendingAbility: PendingAbility | null;
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
  /** Pattern de targeting ativo */
  targetingPattern: CoordinatePattern | null;
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
 * Calcula preview de células afetadas baseado em CoordinatePattern
 */
export function useTargeting({
  selectedUnit,
  pendingAbility,
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

  // Obter CoordinatePattern da ability pendente
  const targetingPattern: CoordinatePattern | null = useMemo(() => {
    if (!pendingAbility || !selectedUnit) return null;

    const { ability, code } = pendingAbility;

    // DODGE é self-target, não precisa de preview
    if (code === "DODGE") return null;

    // SELF abilities não precisam de targeting visual
    if (ability.targetType === "SELF" || ability.range === "SELF") return null;

    // Se a ability tem targetingPattern definido, usar diretamente
    if (ability.targetingPattern) {
      // Aplicar modificador de range se for ATTACK
      if (code === "ATTACK" && attackRangeMod > 0) {
        const baseRange =
          typeof ability.targetingPattern.maxRange === "number"
            ? ability.targetingPattern.maxRange
            : 1;
        return {
          ...ability.targetingPattern,
          maxRange: baseRange + attackRangeMod,
        };
      }
      return ability.targetingPattern;
    }

    // Fallback: criar pattern básico baseado na ability
    // ATTACK usa SINGLE com range = 1 + mod
    if (code === "ATTACK") {
      // Usar valor padrão 1 (targetingPattern já foi tratado acima)
      const baseRange = 1;
      const finalRange = baseRange + attackRangeMod;
      return {
        ...PATTERNS.SINGLE,
        maxRange: finalRange,
      };
    }

    // DASH usa SINGLE com range = speed da unidade
    if (code === "DASH") {
      const dashRange = selectedUnit.speed ?? 3;
      return {
        ...PATTERNS.SINGLE,
        maxRange: dashRange,
      };
    }

    // Fallback genérico: SINGLE com range 1
    return {
      ...PATTERNS.SINGLE,
      maxRange: 1,
    };
  }, [pendingAbility, selectedUnit, attackRangeMod]);

  // Calcular preview de targeting
  const targetingPreview: TargetingPreview | null = useMemo(() => {
    if (!targetingPattern || !selectedUnit) return null;

    const unitStats = extractUnitStats(selectedUnit);

    const preview = calculateTargetingPreview(
      targetingPattern,
      selectedUnit.posX,
      selectedUnit.posY,
      unitStats,
      gridContext,
      hoveredCell?.x,
      hoveredCell?.y
    );

    return preview;
  }, [targetingPattern, selectedUnit, gridContext, hoveredCell]);

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
    if (!pendingAbility) return;

    // Chamar handleQTE com tipo unificado ABILITY
    handleQTE(
      pendingAbility.type === "ATTACK" ? "ATTACK" : "ABILITY",
      selectedUnit.id,
      hoveredCell.x,
      hoveredCell.y,
      pendingAbility.code
    );
  }, [selectedUnit, hoveredCell, targetingPreview, pendingAbility]);

  return {
    targetingPreview,
    targetingPattern,
    isTargeting: targetingPattern !== null && targetingPreview !== null,
    confirmTarget,
    isCellSelectable,
    isCellAffected,
  };
}
