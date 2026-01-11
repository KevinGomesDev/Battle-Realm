// shared/types/ability.types.ts
// FONTE DE VERDADE - Sistema UNIFICADO de Habilidades (Skills + Spells)
// Todas as habilidades do jogo são AbilityDefinition com categoria diferenciadora

import type { BattleUnit } from "./battle.types";

// =============================================================================
// TIPO DE ATIVAÇÃO
// =============================================================================

/**
 * Tipo de ativação da habilidade
 * PASSIVE = Sempre ativa, não precisa usar
 * ACTIVE = Precisa ser ativada, pode consumir ação e mana
 */
export type AbilityActivationType = "PASSIVE" | "ACTIVE";

// =============================================================================
// ATRIBUTOS PARA BINDING DINÂMICO
// =============================================================================

/**
 * Atributos de unidade que podem ser usados como valores dinâmicos
 */
export type UnitAttribute =
  | "COMBAT"
  | "SPEED"
  | "FOCUS"
  | "RESISTANCE"
  | "WILL"
  | "VITALITY"
  | "LEVEL";

/**
 * Constante para referenciar atributos em definições de habilidades
 * Uso: baseDamage: ATTRIBUTE.FOCUS ou targetingPattern.maxRange: ATTRIBUTE.SPEED
 */
export const ATTRIBUTE = {
  COMBAT: "ATTR:COMBAT" as const,
  SPEED: "ATTR:SPEED" as const,
  FOCUS: "ATTR:FOCUS" as const,
  RESISTANCE: "ATTR:RESISTANCE" as const,
  WILL: "ATTR:WILL" as const,
  VITALITY: "ATTR:VITALITY" as const,
  LEVEL: "ATTR:LEVEL" as const,
} as const;

export type AttributeBinding = (typeof ATTRIBUTE)[keyof typeof ATTRIBUTE];

/**
 * Valor que pode ser um número fixo OU uma referência a atributo
 */
export type DynamicValue = number | AttributeBinding;

/**
 * Verifica se um valor é uma referência a atributo
 */
export function isAttributeBinding(
  value: DynamicValue
): value is AttributeBinding {
  return typeof value === "string" && value.startsWith("ATTR:");
}

/**
 * Extrai o nome do atributo de uma binding
 */
export function getAttributeFromBinding(
  binding: AttributeBinding
): UnitAttribute {
  return binding.replace("ATTR:", "") as UnitAttribute;
}

/**
 * Resolve um valor dinâmico para um número usando os atributos da unidade
 */
export function resolveDynamicValue(
  value: DynamicValue,
  unitAttributes: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
    level: number;
  }
): number {
  if (typeof value === "number") {
    return value;
  }

  const attr = getAttributeFromBinding(value);
  switch (attr) {
    case "COMBAT":
      return unitAttributes.combat;
    case "SPEED":
      return unitAttributes.speed;
    case "FOCUS":
      return unitAttributes.focus;
    case "RESISTANCE":
      return unitAttributes.resistance;
    case "WILL":
      return unitAttributes.will;
    case "VITALITY":
      return unitAttributes.vitality;
    case "LEVEL":
      return unitAttributes.level;
    default:
      return 0;
  }
}

// =============================================================================
// TIPOS DE ALCANCE
// =============================================================================

/**
 * Tipos de alcance para habilidades
 * SELF = apenas o próprio usuário (distância 0)
/**
 * Tipos de alvo para habilidades (usado para inferência em `inferTargetType`)
 * SELF = apenas si mesmo
 * UNIT = qualquer unidade (incluindo si mesmo)
 * POSITION = posição no grid (área)
 */
export type AbilityTargetType = "SELF" | "UNIT" | "POSITION";

/**
 * Tipo de efeito da habilidade (usado pela IA para decisões)
 * OFFENSIVE = causa dano ou debuff em inimigos
 * HEALING = restaura HP
 * BUFF = aplica efeito positivo
 * DEBUFF = aplica efeito negativo
 * UTILITY = movimento, teleporte, etc.
 */
export type AbilityEffectType =
  | "OFFENSIVE"
  | "HEALING"
  | "BUFF"
  | "DEBUFF"
  | "UTILITY"
  | "DEFENSIVE";

// =============================================================================
// TARGETING DIRECTION
// =============================================================================

/**
 * Direção do targeting (para patterns direcionais)
 */
export type TargetingDirection =
  | "NORTH"
  | "SOUTH"
  | "EAST"
  | "WEST"
  | "NORTHEAST"
  | "NORTHWEST"
  | "SOUTHEAST"
  | "SOUTHWEST";

// =============================================================================
// COORDINATE PATTERN - SISTEMA DE TARGETING BASEADO EM COORDENADAS
// =============================================================================

/**
 * Coordenada relativa para padrões de targeting
 * x: offset horizontal (negativo = esquerda, positivo = direita)
 * y: offset vertical (negativo = cima/norte, positivo = baixo/sul)
 */
export interface PatternCoordinate {
  x: number;
  y: number;
}

/**
 * Padrão de targeting baseado em coordenadas
 * Define exatamente quais células são afetadas relativamente ao caster/alvo
 *
 * BENEFÍCIOS sobre shapes predefinidas:
 * - Flexibilidade total (qualquer formato: T, L, Z, custom)
 * - Código mais simples (1 função vs 7 funções complexas)
 * - Fácil visualização (coordenadas explícitas)
 * - Rotação trivial (basta rotacionar coordenadas)
 *
 * EXEMPLO DE USO:
 * ```
 * // Formato T apontando para cima
 * const T_PATTERN: CoordinatePattern = {
 *   origin: "CASTER",
 *   coordinates: [
 *     { x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, // barra horizontal
 *     { x: 0, y: -1 }, { x: 0, y: -2 } // haste vertical
 *   ],
 *   rotatable: true
 * };
 * ```
 */
export interface CoordinatePattern {
  /**
   * Ponto de origem do padrão
   * - "CASTER": Coordenadas são relativas ao caster (ex: AOE ao redor do caster)
   * - "TARGET": Coordenadas são relativas ao alvo clicado (ex: explosão no alvo)
   * - "DIRECTION": Padrão parte do caster na direção do alvo (ex: cone, linha)
   */
  origin: "CASTER" | "TARGET" | "DIRECTION";

  /**
   * Lista de coordenadas afetadas (relativas à origem)
   * x: offset horizontal (positivo = leste)
   * y: offset vertical (positivo = sul)
   */
  coordinates: PatternCoordinate[];

  /**
   * Se o padrão pode ser rotacionado baseado na direção escolhida
   * true = rotaciona coordenadas (ex: cone aponta na direção do mouse)
   * false = padrão fixo (ex: AOE circular)
   * Default: false
   */
  rotatable?: boolean;

  /**
   * Se inclui a célula de origem (0,0) mesmo se não estiver na lista
   * Default: false
   */
  includeOrigin?: boolean;

  /**
   * Alcance máximo para selecionar o alvo (para origin "TARGET" ou "DIRECTION")
   * Pode ser número fixo ou referência a atributo
   */
  maxRange?: DynamicValue;

  // === SISTEMA DE PROJÉTIL ===

  /**
   * Se a ability é um projétil interceptável
   * Projéteis percorrem células uma a uma e podem ser esquivados
   * Se o alvo esquivar, o projétil continua para a próxima célula
   * Default: false (abilities de área afetam todas as células simultaneamente)
   */
  isProjectile?: boolean;

  /**
   * Ordem de percurso do projétil
   * - "DISTANCE": Células mais próximas primeiro (default)
   * - "SEQUENTIAL": Na ordem definida no array coordinates
   * - "REVERSE": Células mais distantes primeiro
   */
  projectileOrder?: "DISTANCE" | "SEQUENTIAL" | "REVERSE";

  /**
   * Se o projétil atravessa unidades (atinge múltiplos alvos)
   * Default: false (para no primeiro alvo)
   */
  piercing?: boolean;

  /**
   * Número máximo de alvos que o projétil pode atingir
   * Só usado se piercing = true
   * Default: Infinity (atinge todos no caminho)
   */
  maxTargets?: number;

  // === SISTEMA DE PROJÉTIL COM EXPLOSÃO ===

  /**
   * Distância que o projétil viaja antes de explodir/expandir área
   * Se definido, o projétil viaja em linha reta até encontrar obstáculo ou atingir essa distância
   * O ponto de impacto se torna a origem da explosão (área de efeito)
   * Default: undefined (não viaja, aplica área diretamente no alvo)
   */
  travelDistance?: DynamicValue;

  /**
   * Pattern de explosão que expande no ponto de impacto
   * Quando o projétil atinge algo ou chega ao destino, este pattern é aplicado
   * Default: usa o próprio pattern como área de impacto
   */
  explosionPattern?: CoordinatePattern;

  /**
   * Se o projétil para em obstáculos durante a viagem
   * Default: true
   */
  stopsOnObstacle?: boolean;

  /**
   * Se o projétil para em unidades durante a viagem
   * Default: true (explode na primeira unidade encontrada)
   */
  stopsOnUnit?: boolean;

  // === METADATA ===

  /**
   * Nome do padrão para debug/UI
   */
  name?: string;

  /**
   * Preview ASCII para debug (opcional)
   */
  visualPreview?: string;
}

/**
 * Verifica se um valor é um CoordinatePattern
 */
export function isCoordinatePattern(
  value: unknown
): value is CoordinatePattern {
  return (
    typeof value === "object" &&
    value !== null &&
    "origin" in value &&
    "coordinates" in value &&
    Array.isArray((value as CoordinatePattern).coordinates)
  );
}

// =============================================================================
// DEFINIÇÃO UNIFICADA DE HABILIDADE
// =============================================================================

/**
 * Configuração de impacto (knockback) de uma habilidade
 * Empurra unidades atingidas na direção oposta à origem do ataque
 */
export interface ImpactConfig {
  /**
   * Distância base de empurrão em células
   * Pode ser número fixo ou baseado em atributo
   */
  distance: DynamicValue;

  /**
   * Se causa dano extra ao colidir com obstáculo/unidade/borda
   * Default: false
   */
  collisionDamage?: boolean;

  /**
   * Dano causado ao colidir (% do dano original da ability)
   * Default: 0.5 (50% do dano original)
   */
  collisionDamagePercent?: number;

  /**
   * Se a unidade empurrada para ao encontrar outra unidade
   * true = para e ambas tomam dano de colisão
   * false = atravessa (knockback não acontece)
   * Default: true
   */
  stopsAtUnits?: boolean;

  /**
   * Se a unidade empurrada para ao encontrar obstáculo
   * true = para e toma dano de colisão
   * false = atravessa (knockback não acontece)
   * Default: true
   */
  stopsAtObstacles?: boolean;
}

// =============================================================================
// DEFINIÇÃO UNIFICADA DE HABILIDADE
// =============================================================================

/**
 * Definição UNIFICADA de uma habilidade
 * Todas as habilidades usam mana como recurso
 */
export interface AbilityDefinition {
  // === IDENTIFICAÇÃO ===
  code: string;
  name: string;
  description: string;

  // === TIPO DE ATIVAÇÃO ===
  /** PASSIVE = Sempre ativa | ACTIVE = Precisa usar */
  activationType?: AbilityActivationType;

  // === TIPO DE EFEITO (para IA) ===
  effectType?: AbilityEffectType;

  // === FLAGS ESPECIAIS ===
  /** Ação comum disponível para todas unidades por padrão */
  commonAction?: boolean;
  /** Disponível para tropas (criação de templates). Default: false */
  availableForTroops?: boolean;

  // === CUSTO ===
  /** Custo de mana. Default: 0 */
  manaCost?: number;

  // === TARGETING PATTERN ===
  /**
   * Padrão de coordenadas para área de efeito
   * Define exatamente quais células são afetadas
   * Contém: origin, coordinates, maxRange, isProjectile, piercing, maxTargets
   */
  targetingPattern?: CoordinatePattern;

  // === EXECUÇÃO ===
  /** Nome da função que executa a habilidade */
  functionName?: string;
  /** Se consome ação ao usar. Default: true */
  consumesAction?: boolean;
  /** Rodadas de espera após uso. Default: 0 */
  cooldown?: number;

  // === IMPACTO (KNOCKBACK) ===
  /**
   * Configuração de impacto/knockback da habilidade
   * Empurra unidades atingidas na direção oposta à origem do ataque
   */
  impact?: ImpactConfig;

  // === ATRIBUTOS DINÂMICOS ===
  /** Dano base (pode ser número ou atributo) */
  baseDamage?: DynamicValue;
  /** Multiplicador de dano (ex: 0.5 = +50% do atributo) */
  damageMultiplier?: number;
  /** Cura base */
  healing?: DynamicValue;
  /** Duração da condição em turnos */
  conditionDuration?: DynamicValue;

  // === CONDIÇÃO ===
  /** Condição aplicada pela habilidade */
  conditionApplied?: string;

  // === QTE CONTESTADO ===
  /**
   * Se a habilidade é contestada via QTE
   * Quando true, o alvo pode resistir ao efeito através de um QTE
   * Usado principalmente para DEBUFFs que podem ser resistidos
   * Default: false
   */
  contested?: boolean;
  /**
   * Atributo do caster usado no QTE contestado
   * Ex: "FOCUS" para magias, "COMBAT" para debuffs físicos
   * Obrigatório se contested = true
   */
  contestedAttackerAttribute?: UnitAttribute;
  /**
   * Atributo do alvo usado para resistir no QTE contestado
   * Ex: "WILL" para resistir magias, "RESISTANCE" para debuffs físicos
   * Obrigatório se contested = true
   */
  contestedDefenderAttribute?: UnitAttribute;

  // === VISUAL ===
  icon?: string;
  color?: string;

  // === EXTRAS ===
  metadata?: Record<string, unknown>;
}

// =============================================================================
// FUNÇÕES HELPER PARA ABILITIES
// =============================================================================

/**
 * Verifica se uma ability é contestada via QTE
 * Retorna true se a ability tem contested = true E possui os atributos necessários
 */
export function isContestedAbility(ability: AbilityDefinition): boolean {
  return (
    ability.contested === true &&
    ability.contestedAttackerAttribute !== undefined &&
    ability.contestedDefenderAttribute !== undefined
  );
}

// =============================================================================
// RESULTADO DE EXECUÇÃO (UNIFICADO)
// =============================================================================

/**
 * Resultado da execução de uma habilidade (Skill ou Spell)
 */
export interface AbilityExecutionResult {
  success: boolean;
  error?: string;
  abilityCode?: string;

  // === ATAQUE ===
  /** Se o ataque errou (nenhum alvo atingido) */
  missed?: boolean;

  // === DANO/CURA ===
  damageDealt?: number;
  rawDamage?: number;
  damageReduction?: number;
  healAmount?: number;

  // === ALVOS ===
  targetIds?: string[];
  targetHpAfter?: number;
  targetDefeated?: boolean;

  // === CONDIÇÕES ===
  conditionApplied?: string;
  conditionRemoved?: string;
  conditionsApplied?: Array<{ targetId: string; conditionId: string }>;
  conditionsRemoved?: Array<{ targetId: string; conditionId: string }>;

  // === AÇÕES/MOVIMENTO ===
  actionsGained?: number;
  movementGained?: number;
  casterActionsLeft?: number;

  // === POSIÇÃO (teleporte) ===
  newPosX?: number;
  newPosY?: number;
  unitsMoved?: Array<{
    unitId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;

  // === ROLAGENS (se aplicável) ===
  rolls?: number[];
  successes?: number;

  // === OBSTÁCULOS ===
  obstacleDestroyed?: boolean;
  obstacleId?: string;

  // === ATAQUES EXTRAS ===
  attacksLeftThisTurn?: number;

  // === EIDOLON (INVOCADOR) ===
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];

  // === NOVO SISTEMA DE PROJÉTEIS ===

  /** Se a ability precisa lançar um projétil (usa ProjectileManager) */
  requiresProjectile?: boolean;
  /** Origem do projétil */
  projectileOrigin?: { x: number; y: number };
  /** Destino do projétil */
  projectileDestination?: { x: number; y: number };

  // === METADATA (informações extras para viagem + explosão) ===
  metadata?: {
    impactPoint?: { x: number; y: number };
    intercepted?: boolean;
    affectedCells?: Array<{ x: number; y: number }>;
    travelPath?: Array<{ x: number; y: number }>;
    /** ID do caster (para tracking) */
    casterId?: string;
    /** Informações extras */
    [key: string]: unknown;
  };

  // === UNIDADES AFETADAS (para explosões de área) ===
  affectedUnits?: Array<{
    unitId: string;
    damage: number;
    hpAfter: number;
    physicalProtection: number;
    magicalProtection: number;
    defeated: boolean;
  }>;

  // === IMPACTO / KNOCKBACK ===
  /** Resultados de impacto (knockback) aplicados às unidades */
  impactResults?: Array<{
    unitId: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    distancePushed: number;
    collided: boolean;
    collisionType?: "UNIT" | "OBSTACLE" | "EDGE";
    collidedWithUnitId?: string;
    collidedWithObstacleId?: string;
    collisionDamage: number;
  }>;
}

/**
 * Tipo da função executora de habilidade
 */
export type AbilityExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  ability: AbilityDefinition,
  context?: AbilityExecutionContext
) => AbilityExecutionResult;

/**
 * Contexto opcional para execução de habilidades
 */
export interface AbilityExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: Array<{
    id: string;
    posX: number;
    posY: number;
    hp?: number;
    destroyed?: boolean;
  }>;
  battleId?: string;
  /** Largura do grid de batalha */
  gridWidth?: number;
  /** Altura do grid de batalha */
  gridHeight?: number;
}

// =============================================================================
// DEFINIÇÃO DE CLASSE DE HERÓI
// =============================================================================

/**
 * Definição de uma classe de herói/regente
 */
export interface HeroClassDefinition {
  code: string;
  name: string;
  description: string;
  abilities: AbilityDefinition[];
}

/**
 * Informações resumidas de uma classe (para listagem)
 */
export interface HeroClassSummary {
  code: string;
  name: string;
  description: string;
  abilityCount: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verifica se uma habilidade é passiva
 */
export function isPassive(ability: AbilityDefinition): boolean {
  return ability.activationType === "PASSIVE";
}

/**
 * Verifica se uma habilidade é ativa (pode ser usada)
 */
export function isActive(ability: AbilityDefinition): boolean {
  return (
    ability.activationType === "ACTIVE" || ability.activationType === undefined
  );
}

/**
 * Obtém o custo de mana de uma habilidade
 */
export function getAbilityCost(ability: AbilityDefinition): number {
  // Passivas não têm custo
  if (ability.activationType === "PASSIVE") return 0;
  return ability.manaCost ?? 0;
}

/**
 * Obtém o alcance efetivo de uma habilidade
 * Fonte de verdade: targetingPattern.maxRange
 */
export function getAbilityEffectiveRange(ability: AbilityDefinition): number {
  if (
    ability.targetingPattern?.maxRange !== undefined &&
    typeof ability.targetingPattern.maxRange === "number"
  ) {
    return ability.targetingPattern.maxRange;
  }
  // Pattern SELF ou sem maxRange = alcance 0
  if (ability.targetingPattern?.origin === "CASTER") {
    return 0;
  }
  return 0;
}

// =============================================================================
// PROJECTILE SYSTEM
// =============================================================================

/**
 * Determina se uma ability é um projétil interceptável
 * Fonte de verdade: targetingPattern.isProjectile
 * Default: OFFENSIVE é projétil, outros não
 */
export function isAbilityProjectile(ability: AbilityDefinition): boolean {
  // Verificar definição no pattern
  if (ability.targetingPattern?.isProjectile !== undefined) {
    return ability.targetingPattern.isProjectile;
  }

  // SELF/CASTER origin não é projétil
  if (ability.targetingPattern?.origin === "CASTER") {
    return false;
  }

  // OFFENSIVE é projétil por padrão
  if (ability.effectType === "OFFENSIVE") {
    return true;
  }

  // Outros tipos não são projéteis
  return false;
}

/**
 * Obtém configuração de projétil de uma ability
 * Fonte de verdade: targetingPattern
 */
export function getAbilityProjectileConfig(ability: AbilityDefinition): {
  isProjectile: boolean;
  piercing: boolean;
  maxTargets: number;
  projectileOrder: "DISTANCE" | "SEQUENTIAL" | "REVERSE";
} {
  const isProjectile = isAbilityProjectile(ability);
  const pattern = ability.targetingPattern;

  return {
    isProjectile,
    piercing: pattern?.piercing ?? false,
    maxTargets: pattern?.maxTargets ?? (pattern?.piercing ? Infinity : 1),
    projectileOrder: pattern?.projectileOrder ?? "DISTANCE",
  };
}
