// Ações padrão importadas do shared (fonte de verdade)
import { DEFAULT_UNIT_ACTIONS } from "../../../shared/data/actions.data";
import { findSkillByCode } from "../../../shared/data/skills.data";

// Re-exportar para compatibilidade com código existente
export { DEFAULT_UNIT_ACTIONS };

export interface UnitActionContext {
  battleType?: "arena" | "match";
  modifiers?: string[]; // Modificadores que podem alterar ações (futuro)
}

export interface UnitStats {
  combat: number;
  speed: number;
  focus: number;
  armor: number;
  vitality: number;
  category?: string;
  classFeatures?: string[]; // IDs das skills aprendidas
}

/**
 * Determina as ações disponíveis para uma unidade
 * Inclui ações padrão + skills ativas do classFeatures
 */
export function determineUnitActions(
  unit: UnitStats,
  context?: UnitActionContext
): string[] {
  const actions = [...DEFAULT_UNIT_ACTIONS];

  // Adicionar skills ativas como ações disponíveis
  if (unit.classFeatures && unit.classFeatures.length > 0) {
    for (const skillCode of unit.classFeatures) {
      const skill = findSkillByCode(skillCode);
      if (skill && skill.category === "ACTIVE") {
        // Adicionar o código da skill como ação
        if (!actions.includes(skill.code)) {
          actions.push(skill.code);
        }
      }
    }
  }

  // Futuro: Modificadores podem adicionar ou remover ações
  // Exemplo:
  // if (context?.modifiers?.includes("IMOBILIZADO")) {
  //   actions = actions.filter(a => a !== "move" && a !== "dash");
  // }

  return actions;
}
