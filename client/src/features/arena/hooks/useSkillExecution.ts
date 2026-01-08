// client/src/features/arena/hooks/useSkillExecution.ts
// Hook dedicado para execução de skills com validação, feedback visual e update otimista

import { useCallback, useMemo, useState } from "react";
import { useArena } from "./useArena";
import {
  findAbilityByCode as findSkillByCode,
  getAbilityInfoWithState as getSkillInfoWithState,
  type AbilityInfoWithState as SkillInfoWithState,
} from "../../../../../shared/data/abilities.data";
import {
  validateAbilityUse as validateSkillUse,
  isValidAbilityTarget as isValidSkillTarget,
  getValidAbilityTargets as getValidSkillTargets,
  canUseAbility as canUseSkill,
} from "../../../../../shared/utils/ability-validation";
import type { BattleUnit } from "../../../../../shared/types/battle.types";
import type { AbilityDefinition as SkillDefinition } from "../../../../../shared/types/ability.types";

// =============================================================================
// TIPOS
// =============================================================================

export interface UseSkillExecutionReturn {
  // Estado
  pendingSkill: SkillDefinition | null;
  validTargets: BattleUnit[];
  canSelfCast: boolean;

  // Ações
  selectSkill: (skillCode: string, caster: BattleUnit) => boolean;
  cancelSkill: () => void;
  executeSkillOnTarget: (
    caster: BattleUnit,
    target: BattleUnit
  ) => Promise<boolean>;
  executeSkillSelf: (caster: BattleUnit) => Promise<boolean>;

  // Helpers
  getSkillsForUnit: (unit: BattleUnit) => SkillInfoWithState[];
  isValidTarget: (
    caster: BattleUnit,
    target: BattleUnit,
    skill?: SkillDefinition
  ) => boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSkillExecution(
  selectedUnit: BattleUnit | null = null
): UseSkillExecutionReturn {
  const { state, executeAction } = useArena();
  const { units } = state;

  // Estado interno da skill pendente
  const [pendingSkillCode, setPendingSkillCode] = useState<string | null>(null);

  // Derivar skill pendente do código
  const pendingSkill = useMemo(() => {
    if (!pendingSkillCode) return null;
    return findSkillByCode(pendingSkillCode) ?? null;
  }, [pendingSkillCode]);

  // Calcular alvos válidos para a skill pendente
  const validTargets = useMemo(() => {
    if (!pendingSkill || !selectedUnit) return [];
    return getValidSkillTargets(selectedUnit, pendingSkill, units);
  }, [pendingSkill, units, selectedUnit]);

  // Verificar se pode self-cast
  const canSelfCast = useMemo(() => {
    if (!pendingSkill) return false;
    return (
      pendingSkill.targetType === "UNIT" || pendingSkill.targetType === "SELF"
    );
  }, [pendingSkill]);

  /**
   * Seleciona uma skill para uso
   * Retorna true se a skill requer alvo, false se foi executada imediatamente
   */
  const selectSkill = useCallback(
    (skillCode: string, caster: BattleUnit): boolean => {
      const skill = findSkillByCode(skillCode);
      if (!skill) {
        console.error(`[useSkillExecution] Skill não encontrada: ${skillCode}`);
        return false;
      }

      // Validar se pode usar
      const { canUse, reason } = canUseSkill(caster, skill);
      if (!canUse) {
        console.warn(
          `[useSkillExecution] Não pode usar ${skillCode}: ${reason}`
        );
        return false;
      }

      // Skills SELF são executadas imediatamente
      if (skill.range === "SELF" || skill.targetType === "SELF") {
        executeAction("use_skill", caster.id, {
          skillCode,
          casterUnitId: caster.id,
          targetUnitId: caster.id,
        });
        return false;
      }

      // Skills que requerem alvo definem como pendente
      setPendingSkillCode(skillCode);
      return true;
    },
    [executeAction]
  );

  /**
   * Cancela a skill pendente
   */
  const cancelSkill = useCallback(() => {
    setPendingSkillCode(null);
  }, []);

  /**
   * Executa a skill em um alvo específico
   */
  const executeSkillOnTarget = useCallback(
    async (caster: BattleUnit, target: BattleUnit): Promise<boolean> => {
      if (!pendingSkill) {
        console.error("[useSkillExecution] Nenhuma skill pendente");
        return false;
      }

      // Validar
      const validation = validateSkillUse(caster, pendingSkill, target);
      if (!validation.valid) {
        console.warn(
          `[useSkillExecution] Validação falhou: ${validation.error}`
        );
        return false;
      }

      try {
        executeAction("use_skill", caster.id, {
          skillCode: pendingSkill.code,
          casterUnitId: caster.id,
          targetUnitId: target.id,
        });

        setPendingSkillCode(null);
        return true;
      } catch (error) {
        console.error("[useSkillExecution] Erro ao executar skill:", error);
        return false;
      }
    },
    [pendingSkill, executeAction]
  );

  /**
   * Executa a skill em si mesmo
   */
  const executeSkillSelf = useCallback(
    async (caster: BattleUnit): Promise<boolean> => {
      if (!pendingSkill) {
        console.error("[useSkillExecution] Nenhuma skill pendente");
        return false;
      }

      if (!canSelfCast) {
        console.warn("[useSkillExecution] Skill não permite self-cast");
        return false;
      }

      return executeSkillOnTarget(caster, caster);
    },
    [pendingSkill, canSelfCast, executeSkillOnTarget]
  );

  /**
   * Obtém lista de skills com estado para uma unidade
   */
  const getSkillsForUnit = useCallback(
    (unit: BattleUnit): SkillInfoWithState[] => {
      const skillInfos: SkillInfoWithState[] = [];

      for (const featureCode of unit.features) {
        const skillInfo = getSkillInfoWithState(featureCode, {
          actionsLeft: unit.actionsLeft,
          isAlive: unit.isAlive,
          features: unit.features,
          unitCooldowns: unit.unitCooldowns,
        });
        if (skillInfo) {
          skillInfos.push(skillInfo);
        }
      }

      return skillInfos;
    },
    []
  );

  /**
   * Verifica se uma unidade é alvo válido
   */
  const isValidTarget = useCallback(
    (
      caster: BattleUnit,
      target: BattleUnit,
      skill?: SkillDefinition
    ): boolean => {
      const skillToCheck = skill ?? pendingSkill;
      if (!skillToCheck) return false;
      return isValidSkillTarget(caster, skillToCheck, target);
    },
    [pendingSkill]
  );

  return {
    pendingSkill,
    validTargets,
    canSelfCast,
    selectSkill,
    cancelSkill,
    executeSkillOnTarget,
    executeSkillSelf,
    getSkillsForUnit,
    isValidTarget,
  };
}
