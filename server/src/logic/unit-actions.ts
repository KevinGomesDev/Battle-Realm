// Ações padrão que toda unidade possui
export const DEFAULT_UNIT_ACTIONS = ["attack", "move", "dash", "dodge"];

export interface UnitActionContext {
  battleType?: "arena" | "match";
  modifiers?: string[]; // Modificadores que podem alterar ações (futuro)
}

export interface UnitStats {
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  category?: string;
}

export function determineUnitActions(
  unit: UnitStats,
  context?: UnitActionContext
): string[] {
  const actions = [...DEFAULT_UNIT_ACTIONS];

  // Futuro: Modificadores podem adicionar ou remover ações
  // Exemplo:
  // if (context?.modifiers?.includes("IMOBILIZADO")) {
  //   actions = actions.filter(a => a !== "move" && a !== "dash");
  // }
  // if (context?.modifiers?.includes("ARQUEIRO")) {
  //   actions.push("range_attack");
  // }

  return actions;
}
