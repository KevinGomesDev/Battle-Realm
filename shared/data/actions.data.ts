// shared/data/actions.data.ts
// Definições centralizadas de ações básicas de combate

/**
 * Tipos de custo de ação
 */
export type ActionCostType = "movement" | "action" | "free";

/**
 * Tipo de alvo que a ação requer
 */
export type ActionTargetType = "none" | "enemy" | "ally" | "self" | "position";

/**
 * Definição completa de uma ação básica
 */
export interface ActionDefinition {
  /** Código único da ação (minúsculo para consistência) */
  code: string;
  /** Nome de exibição */
  name: string;
  /** Ícone emoji */
  icon: string;
  /** Descrição curta */
  description: string;
  /** Tipo de custo (movement, action, free) */
  costType: ActionCostType;
  /** Se requer seleção de alvo */
  requiresTarget: boolean;
  /** Tipo de alvo se requer */
  targetType: ActionTargetType;
  /** Alcance da ação (1 = adjacente, 0 = self) */
  range: number;
  /** Se é uma ação padrão disponível para todas unidades */
  isDefault: boolean;
}

// =============================================================================
// AÇÕES BÁSICAS DE COMBATE
// =============================================================================

export const ACTION_MOVE: ActionDefinition = {
  code: "move",
  name: "Mover",
  icon: "🚶",
  description: "Move a unidade pelo campo de batalha",
  costType: "movement",
  requiresTarget: false,
  targetType: "position",
  range: 0,
  isDefault: true,
};

export const ACTION_ATTACK: ActionDefinition = {
  code: "attack",
  name: "Atacar",
  icon: "⚔️",
  description: "Ataca um inimigo adjacente",
  costType: "action",
  requiresTarget: true,
  targetType: "enemy",
  range: 1,
  isDefault: true,
};

export const ACTION_DASH: ActionDefinition = {
  code: "dash",
  name: "Corrida",
  icon: "💨",
  description: "Gasta uma ação para dobrar o movimento",
  costType: "action",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: true,
};

export const ACTION_DODGE: ActionDefinition = {
  code: "dodge",
  name: "Esquivar",
  icon: "🌀",
  description: "Aumenta a chance de esquiva até o próximo turno",
  costType: "action",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: true,
};

export const ACTION_DISENGAGE: ActionDefinition = {
  code: "disengage",
  name: "Recuar",
  icon: "🏃",
  description: "Move sem provocar ataques de oportunidade",
  costType: "action",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: false,
};

export const ACTION_HELP: ActionDefinition = {
  code: "help",
  name: "Ajudar",
  icon: "🤝",
  description: "Dá vantagem a um aliado adjacente no próximo ataque",
  costType: "action",
  requiresTarget: true,
  targetType: "ally",
  range: 1,
  isDefault: false,
};

export const ACTION_PROTECT: ActionDefinition = {
  code: "protect",
  name: "Proteger",
  icon: "🛡️",
  description: "Intercepta ataques direcionados a um aliado adjacente",
  costType: "action",
  requiresTarget: true,
  targetType: "ally",
  range: 1,
  isDefault: false,
};

export const ACTION_KNOCKDOWN: ActionDefinition = {
  code: "knockdown",
  name: "Derrubar",
  icon: "⬇️",
  description: "Tenta derrubar o inimigo no chão",
  costType: "action",
  requiresTarget: true,
  targetType: "enemy",
  range: 1,
  isDefault: false,
};

export const ACTION_DISARM: ActionDefinition = {
  code: "disarm",
  name: "Desarmar",
  icon: "🔓",
  description: "Tenta desarmar o inimigo",
  costType: "action",
  requiresTarget: true,
  targetType: "enemy",
  range: 1,
  isDefault: false,
};

export const ACTION_GRAB: ActionDefinition = {
  code: "grab",
  name: "Agarrar",
  icon: "✊",
  description: "Agarra um inimigo adjacente, imobilizando-o",
  costType: "action",
  requiresTarget: true,
  targetType: "enemy",
  range: 1,
  isDefault: false,
};

export const ACTION_THROW: ActionDefinition = {
  code: "throw",
  name: "Arremessar",
  icon: "🪨",
  description: "Arremessa um inimigo agarrado",
  costType: "action",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: false,
};

export const ACTION_FLEE: ActionDefinition = {
  code: "flee",
  name: "Fugir",
  icon: "🏃‍♂️",
  description: "Tenta escapar de uma agarrada",
  costType: "action",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: false,
};

export const ACTION_CAST: ActionDefinition = {
  code: "cast",
  name: "Lançar Magia",
  icon: "✨",
  description: "Usa uma habilidade mágica",
  costType: "action",
  requiresTarget: true,
  targetType: "enemy",
  range: 0,
  isDefault: false,
};

export const ACTION_END_TURN: ActionDefinition = {
  code: "end_turn",
  name: "Passar",
  icon: "⏭️",
  description: "Termina o turno sem agir",
  costType: "free",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: false,
};

export const ACTION_SURRENDER: ActionDefinition = {
  code: "surrender",
  name: "Render-se",
  icon: "🏳️",
  description: "Desiste da batalha",
  costType: "free",
  requiresTarget: false,
  targetType: "none",
  range: 0,
  isDefault: false,
};

// =============================================================================
// MAPA DE AÇÕES
// =============================================================================

/**
 * Mapa de todas as ações por código
 */
export const ALL_ACTIONS: Record<string, ActionDefinition> = {
  move: ACTION_MOVE,
  attack: ACTION_ATTACK,
  dash: ACTION_DASH,
  dodge: ACTION_DODGE,
  disengage: ACTION_DISENGAGE,
  help: ACTION_HELP,
  protect: ACTION_PROTECT,
  knockdown: ACTION_KNOCKDOWN,
  disarm: ACTION_DISARM,
  grab: ACTION_GRAB,
  throw: ACTION_THROW,
  flee: ACTION_FLEE,
  cast: ACTION_CAST,
  end_turn: ACTION_END_TURN,
  surrender: ACTION_SURRENDER,
};

/**
 * Ações padrão que toda unidade possui
 */
export const DEFAULT_UNIT_ACTIONS: string[] = [
  ACTION_ATTACK.code,
  ACTION_MOVE.code,
  ACTION_DASH.code,
  ACTION_DODGE.code,
];

/**
 * Ações padrão como array de ActionDefinition
 */
export const DEFAULT_ACTIONS: ActionDefinition[] = [
  ACTION_ATTACK,
  ACTION_MOVE,
  ACTION_DASH,
  ACTION_DODGE,
];

// =============================================================================
// FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Busca uma ação pelo código
 */
export function findActionByCode(code: string): ActionDefinition | undefined {
  return ALL_ACTIONS[code.toLowerCase()];
}

/**
 * Verifica se um código corresponde a uma ação básica (não skill/spell)
 */
export function isBasicAction(code: string): boolean {
  return code.toLowerCase() in ALL_ACTIONS;
}

/**
 * Retorna informações de exibição da ação (para UI)
 */
export function getActionDisplayInfo(code: string): {
  icon: string;
  name: string;
  description: string;
  requiresTarget: boolean;
} | null {
  const action = findActionByCode(code);
  if (!action) return null;

  return {
    icon: action.icon,
    name: action.name,
    description: action.description,
    requiresTarget: action.requiresTarget,
  };
}

/**
 * Retorna o tipo de custo de uma ação
 */
export function getActionCostType(code: string): ActionCostType | null {
  const action = findActionByCode(code);
  return action?.costType ?? null;
}

/**
 * Verifica se a ação requer alvo
 */
export function actionRequiresTarget(code: string): boolean {
  const action = findActionByCode(code);
  return action?.requiresTarget ?? false;
}
