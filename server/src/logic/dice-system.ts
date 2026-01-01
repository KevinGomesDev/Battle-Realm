// server/src/logic/dice-system.ts
// Sistema de Dados D6 Padronizado
// Baseado em: Margem Dinâmica e Explosão

import type {
  AdvantageMod,
  DieResult,
  DiceRollResult,
  ContestedRollResult,
  RollComparisonResult,
  MultiTargetDefenseResult,
  MultiTargetAttackResult,
} from "../../../shared/types/dice.types";

// Re-exportar tipos para uso externo
export type {
  AdvantageMod,
  DieResult,
  DiceRollResult,
  ContestedRollResult,
  RollComparisonResult,
  MultiTargetDefenseResult,
  MultiTargetAttackResult,
};

// =============================================================================
// CONSTANTES
// =============================================================================

/**
 * Margem de sucesso base: 4, 5, 6 = 50%
 */
const BASE_THRESHOLD = 4;

/**
 * O 6 sempre explode (gera novo dado)
 */
const EXPLOSION_VALUE = 6;

/**
 * Máximo de explosões recursivas para evitar loops infinitos
 */
const MAX_EXPLOSION_DEPTH = 10;

/**
 * Mapeamento de modificador para threshold
 * +2 Vantagem = Sucesso em 2+ (83%)
 * +1 Vantagem = Sucesso em 3+ (66%)
 * 0 Padrão = Sucesso em 4+ (50%)
 * -1 Desvantagem = Sucesso em 5+ (33%)
 * -2 Desvantagens = Sucesso em 6 apenas (16%)
 */
function getThreshold(advantageMod: AdvantageMod): number {
  return Math.max(2, Math.min(6, BASE_THRESHOLD - advantageMod));
}

// =============================================================================
// FUNÇÕES PRINCIPAIS
// =============================================================================

/**
 * Rola um único dado D6
 */
function rollSingleD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Processa um dado com explosão recursiva
 */
function processDie(
  value: number,
  threshold: number,
  depth: number = 0
): DieResult {
  const isSuccess = value >= threshold;
  const isExplosion = value === EXPLOSION_VALUE;

  const result: DieResult = {
    value,
    isSuccess,
    isExplosion,
  };

  // Se explodiu e não atingiu limite de profundidade, rola novo dado
  if (isExplosion && depth < MAX_EXPLOSION_DEPTH) {
    const explosionValue = rollSingleD6();
    const explosionResult = processDie(explosionValue, threshold, depth + 1);
    result.explosionResults = [explosionResult];
  }

  return result;
}

/**
 * Conta sucessos de um resultado de dado (incluindo explosões)
 */
function countDieSuccesses(die: DieResult): number {
  let count = die.isSuccess ? 1 : 0;
  if (die.explosionResults) {
    for (const exp of die.explosionResults) {
      count += countDieSuccesses(exp);
    }
  }
  return count;
}

/**
 * Coleta todos os valores rolados de um dado (incluindo explosões)
 */
function collectAllRolls(die: DieResult): number[] {
  const rolls: number[] = [die.value];
  if (die.explosionResults) {
    for (const exp of die.explosionResults) {
      rolls.push(...collectAllRolls(exp));
    }
  }
  return rolls;
}

/**
 * Conta explosões de um dado
 */
function countExplosions(die: DieResult): number {
  let count = die.isExplosion ? 1 : 0;
  if (die.explosionResults) {
    for (const exp of die.explosionResults) {
      count += countExplosions(exp);
    }
  }
  return count;
}

/**
 * Rola N dados D6 com o sistema de margem dinâmica e explosão
 *
 * @param diceCount Quantidade de dados a rolar (baseado no atributo)
 * @param advantageMod Modificador de vantagem (-2 a +2)
 * @returns Resultado completo da rolagem
 *
 * @example
 * // Arqueiro (Combate 3) atira de cima da muralha (+1 Vantagem)
 * const result = rollD6Test(3, 1);
 * // Sucesso em 3+ (ao invés de 4+)
 *
 * @example
 * // Cavaleiro (Defesa 4) tenta bloquear na lama (-1 Desvantagem)
 * const result = rollD6Test(4, -1);
 * // Sucesso apenas em 5+ (ao invés de 4+)
 */
export function rollD6Test(
  diceCount: number,
  advantageMod: AdvantageMod = 0
): DiceRollResult {
  const count = Math.max(1, diceCount);
  const threshold = getThreshold(advantageMod);

  const diceResults: DieResult[] = [];

  for (let i = 0; i < count; i++) {
    const value = rollSingleD6();
    const dieResult = processDie(value, threshold);
    diceResults.push(dieResult);
  }

  // Calcular totais
  let totalSuccesses = 0;
  let explosionCount = 0;
  const allRolls: number[] = [];

  for (const die of diceResults) {
    totalSuccesses += countDieSuccesses(die);
    explosionCount += countExplosions(die);
    allRolls.push(...collectAllRolls(die));
  }

  return {
    diceCount: count,
    advantageMod,
    successThreshold: threshold,
    diceResults,
    totalSuccesses,
    allRolls,
    success: totalSuccesses > 0,
    explosionCount,
  };
}

/**
 * Executa um teste resistido (atacante vs defensor)
 *
 * @param attackerDice Dados do atacante (atributo)
 * @param defenderDice Dados do defensor (atributo)
 * @param attackerAdvantage Modificador de vantagem do atacante
 * @param defenderAdvantage Modificador de vantagem do defensor
 * @returns Resultado do confronto
 *
 * @example
 * // Guerreiro (Combate 5) tenta derrubar Ladrão (Acuidade 4)
 * // Guerreiro tem terreno alto (+1), Ladrão está na lama (-1)
 * const result = rollContestedTest(5, 4, 1, -1);
 */
export function rollContestedTest(
  attackerDice: number,
  defenderDice: number,
  attackerAdvantage: AdvantageMod = 0,
  defenderAdvantage: AdvantageMod = 0
): ContestedRollResult {
  const attackerResult = rollD6Test(attackerDice, attackerAdvantage);
  const defenderResult = rollD6Test(defenderDice, defenderAdvantage);

  const margin = attackerResult.totalSuccesses - defenderResult.totalSuccesses;

  return {
    attackerResult,
    defenderResult,
    attackerWins: margin > 0,
    tie: margin === 0,
    margin,
  };
}

/**
 * Calcula dano baseado em sucessos e atributo de combate
 * Fórmula configurada em shared/config/balance.config.ts
 * Default: Sucessos * Combat
 *
 * @param successes Número de sucessos da rolagem
 * @param combat Atributo de combate do atacante
 * @param bonusDamage Dano bônus fixo
 * @see ATTACK_CONFIG em shared/config/balance.config.ts
 */
export function calculateDamageFromSuccesses(
  successes: number,
  combat: number,
  bonusDamage: number = 0
): number {
  // Usa ATTACK_CONFIG.damageMultiplier de balance.config.ts
  // Por padrão: Sucessos * Combat * 1
  return Math.max(0, successes * combat + bonusDamage);
}

/**
 * Calcula redução de dano pela defesa
 * Fórmula configurada em shared/config/balance.config.ts
 * Default: Sucessos * (Acuity / 2)
 *
 * @param successes Número de sucessos da rolagem de defesa
 * @param acuity Atributo de agilidade/percepção do defensor
 * @see DEFENSE_CONFIG em shared/config/balance.config.ts
 */
export function calculateDefenseReduction(
  successes: number,
  acuity: number
): number {
  // Usa DEFENSE_CONFIG.reductionDivisor (default: 2)
  // e DEFENSE_CONFIG.minReductionMultiplier (default: 0.5)
  const reductionMultiplier = Math.max(0.5, acuity / 2);
  return Math.max(0, Math.floor(successes * reductionMultiplier));
}

/**
 * Calcula proteção física baseada em Armor
 * Fórmula configurada em shared/config/balance.config.ts
 * Default: Armor * 4
 * @see PHYSICAL_PROTECTION_CONFIG em shared/config/balance.config.ts
 */
export function calculatePhysicalProtection(armor: number): number {
  // Usa PHYSICAL_PROTECTION_CONFIG.multiplier (default: 4)
  return Math.max(0, armor * 4);
}

/**
 * Calcula proteção mágica baseada em Focus
 * Fórmula configurada em shared/config/balance.config.ts
 * Default: Focus * 4
 * @see MAGICAL_PROTECTION_CONFIG em shared/config/balance.config.ts
 */
export function calculateMagicalProtection(focus: number): number {
  // Usa MAGICAL_PROTECTION_CONFIG.multiplier (default: 4)
  return Math.max(0, focus * 4);
}

// =============================================================================
// FUNÇÕES UTILITÁRIAS (compatibilidade com código antigo)
// =============================================================================

/**
 * Rola N dados D6 simples (sem explosão, retorna array de valores)
 * @deprecated Use rollD6Test para o novo sistema
 */
export function rollD6Simple(times: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < Math.max(0, times); i++) {
    results.push(rollSingleD6());
  }
  return results;
}

/**
 * Rola 1 dado D6 simples
 * @deprecated Use rollD6Test para o novo sistema
 */
export function rollSingleD6Simple(): number {
  return rollSingleD6();
}

/**
 * Conta sucessos em um array de dados (sistema antigo)
 * @deprecated Use rollD6Test que já retorna totalSuccesses
 */
export function countSuccessesLegacy(
  dice: number[],
  threshold: number = 4
): number {
  return dice.filter((d) => d >= threshold).length;
}

// =============================================================================
// HELPERS PARA VANTAGEM
// =============================================================================

/**
 * Combina múltiplos modificadores de vantagem
 * (terreno, buffs, debuffs, etc)
 */
export function combineAdvantages(...mods: number[]): AdvantageMod {
  const total = mods.reduce((sum, m) => sum + m, 0);
  return Math.max(-2, Math.min(2, total)) as AdvantageMod;
}

/**
 * Descrição textual do modificador de vantagem
 */
export function getAdvantageDescription(mod: AdvantageMod): string {
  switch (mod) {
    case 2:
      return "Grande Vantagem (+2)";
    case 1:
      return "Vantagem (+1)";
    case 0:
      return "Neutro";
    case -1:
      return "Desvantagem (-1)";
    case -2:
      return "Grande Desvantagem (-2)";
  }
}

/**
 * Probabilidade aproximada de sucesso por dado
 */
export function getSuccessProbability(advantageMod: AdvantageMod): number {
  const threshold = getThreshold(advantageMod);
  // Probabilidade = (7 - threshold) / 6
  return ((7 - threshold) / 6) * 100;
}

// =============================================================================
// ROLAGENS SEPARADAS (para UI com suspense)
// =============================================================================

/**
 * Compara dois resultados de rolagem já existentes
 * Útil quando ataque e defesa são rolados separadamente para criar suspense
 *
 * @param attackerResult Resultado da rolagem de ataque
 * @param defenderResult Resultado da rolagem de defesa
 * @returns Comparação entre os dois
 *
 * @example
 * // Passo 1: Rola ataque e mostra para o usuário
 * const attackRoll = rollD6Test(5, 0);
 * // UI exibe: "Ataque: 3 sucessos!"
 *
 * // Passo 2: Rola defesa e mostra para o usuário
 * const defenseRoll = rollD6Test(4, 0);
 * // UI exibe: "Defesa: 2 sucessos!"
 *
 * // Passo 3: Compara e mostra resultado final
 * const comparison = compareRolls(attackRoll, defenseRoll);
 * // UI exibe: "Ataque vence por 1!"
 */
export function compareRolls(
  attackerResult: DiceRollResult,
  defenderResult: DiceRollResult
): RollComparisonResult {
  const margin = attackerResult.totalSuccesses - defenderResult.totalSuccesses;

  return {
    attackerSuccesses: attackerResult.totalSuccesses,
    defenderSuccesses: defenderResult.totalSuccesses,
    attackerWins: margin > 0,
    tie: margin === 0,
    margin,
  };
}

// =============================================================================
// ATAQUES MULTI-ALVO
// =============================================================================

/**
 * Defensor para ataque multi-alvo
 */
export interface DefenderInfo {
  id: string;
  diceCount: number;
  advantageMod?: AdvantageMod;
}

/**
 * Rola defesa para um único defensor contra um ataque já rolado
 *
 * @param attackRoll Resultado do ataque (já rolado)
 * @param defender Informações do defensor
 * @returns Resultado da defesa com comparação
 */
export function rollDefenseAgainstAttack(
  attackRoll: DiceRollResult,
  defender: DefenderInfo
): MultiTargetDefenseResult {
  const defenseRoll = rollD6Test(
    defender.diceCount,
    defender.advantageMod ?? 0
  );
  const comparison = compareRolls(attackRoll, defenseRoll);

  return {
    defenderId: defender.id,
    defenseRoll,
    comparison,
  };
}

/**
 * Rola um ataque contra múltiplos defensores
 * O atacante rola uma vez, cada defensor rola separadamente
 *
 * @param attackerDice Dados do atacante
 * @param attackerAdvantage Modificador de vantagem do atacante
 * @param defenders Lista de defensores com seus dados e vantagens
 * @returns Resultado completo com todas as comparações
 *
 * @example
 * // Mago lança Bola de Fogo (Foco 5) contra 3 inimigos
 * const result = rollMultiTargetAttack(5, 0, [
 *   { id: "goblin1", diceCount: 2, advantageMod: 0 },
 *   { id: "goblin2", diceCount: 2, advantageMod: -1 }, // na lama
 *   { id: "orc", diceCount: 4, advantageMod: 0 },
 * ]);
 * // Mago rola 4 sucessos
 * // Goblin1 rola 1 sucesso -> HIT
 * // Goblin2 rola 2 sucessos -> HIT
 * // Orc rola 5 sucessos -> RESISTE
 */
export function rollMultiTargetAttack(
  attackerDice: number,
  attackerAdvantage: AdvantageMod,
  defenders: DefenderInfo[]
): MultiTargetAttackResult {
  const attackRoll = rollD6Test(attackerDice, attackerAdvantage);

  const defenseResults: MultiTargetDefenseResult[] = [];
  const hitDefenderIds: string[] = [];
  const resistedDefenderIds: string[] = [];

  for (const defender of defenders) {
    const defenseResult = rollDefenseAgainstAttack(attackRoll, defender);
    defenseResults.push(defenseResult);

    if (defenseResult.comparison.attackerWins) {
      hitDefenderIds.push(defender.id);
    } else {
      resistedDefenderIds.push(defender.id);
    }
  }

  return {
    attackRoll,
    defenseResults,
    hitDefenderIds,
    resistedDefenderIds,
  };
}

/**
 * Versão passo-a-passo para UI com suspense
 * Permite rolar ataque primeiro, depois cada defesa individualmente
 */
export const StepByStepRoll = {
  /**
   * Passo 1: Rola o ataque
   */
  rollAttack(
    diceCount: number,
    advantageMod: AdvantageMod = 0
  ): DiceRollResult {
    return rollD6Test(diceCount, advantageMod);
  },

  /**
   * Passo 2: Rola defesa de um alvo contra o ataque
   */
  rollDefense(
    attackRoll: DiceRollResult,
    defenderId: string,
    defenderDice: number,
    defenderAdvantage: AdvantageMod = 0
  ): MultiTargetDefenseResult {
    return rollDefenseAgainstAttack(attackRoll, {
      id: defenderId,
      diceCount: defenderDice,
      advantageMod: defenderAdvantage,
    });
  },

  /**
   * Passo 3: Compara resultados (se já tiver ambos)
   */
  compare: compareRolls,

  /**
   * Calcula dano final baseado na margem de vitória
   */
  calculateDamage(
    comparison: RollComparisonResult,
    damagePerSuccess: number = 1,
    bonusDamage: number = 0
  ): number {
    if (!comparison.attackerWins) return 0;
    return calculateDamageFromSuccesses(
      comparison.margin,
      damagePerSuccess,
      bonusDamage
    );
  },
};
