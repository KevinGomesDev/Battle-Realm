// shared/types/dice.types.ts
// Tipos do Sistema de Dados D6

/**
 * Modificador de vantagem/desvantagem
 * -2 a +2, onde negativo é desvantagem e positivo é vantagem
 */
export type AdvantageMod = -2 | -1 | 0 | 1 | 2;

/**
 * Resultado de uma rolagem individual
 */
export interface DieResult {
  /** Valor do dado (1-6) */
  value: number;
  /** Se este dado foi um sucesso */
  isSuccess: boolean;
  /** Se este dado explodiu (era 6) */
  isExplosion: boolean;
  /** Dados extras gerados pela explosão */
  explosionResults?: DieResult[];
}

/**
 * Resultado completo de uma rolagem D6
 */
export interface DiceRollResult {
  /** Quantidade de dados rolados (sem explosões) */
  diceCount: number;
  /** Modificador de vantagem aplicado */
  advantageMod: AdvantageMod;
  /** Margem de sucesso (mínimo para sucesso) */
  successThreshold: number;
  /** Resultados de cada dado */
  diceResults: DieResult[];
  /** Total de sucessos (incluindo explosões) */
  totalSuccesses: number;
  /** Todos os valores rolados (para display) */
  allRolls: number[];
  /** Se houve pelo menos um sucesso */
  success: boolean;
  /** Quantidade de explosões que ocorreram */
  explosionCount: number;
}

/**
 * Resultado de um teste resistido (contested roll)
 */
export interface ContestedRollResult {
  /** Resultado do atacante */
  attackerResult: DiceRollResult;
  /** Resultado do defensor */
  defenderResult: DiceRollResult;
  /** Atacante venceu (mais sucessos) */
  attackerWins: boolean;
  /** Empate (mesma quantidade de sucessos) */
  tie: boolean;
  /** Margem de vitória (diferença de sucessos) */
  margin: number;
}

/**
 * Resultado de comparação entre um ataque e uma defesa
 * (usado quando as rolagens são feitas separadamente)
 */
export interface RollComparisonResult {
  /** Sucessos do atacante */
  attackerSuccesses: number;
  /** Sucessos do defensor */
  defenderSuccesses: number;
  /** Atacante venceu (mais sucessos) */
  attackerWins: boolean;
  /** Empate (mesma quantidade de sucessos) */
  tie: boolean;
  /** Margem de vitória (diferença de sucessos) */
  margin: number;
}

/**
 * Resultado de defesa individual em um ataque multi-alvo
 */
export interface MultiTargetDefenseResult {
  /** ID do defensor */
  defenderId: string;
  /** Resultado da rolagem de defesa */
  defenseRoll: DiceRollResult;
  /** Comparação com o ataque */
  comparison: RollComparisonResult;
}

/**
 * Resultado completo de um ataque contra múltiplos alvos
 */
export interface MultiTargetAttackResult {
  /** Resultado da rolagem de ataque (única) */
  attackRoll: DiceRollResult;
  /** Resultados de cada defensor */
  defenseResults: MultiTargetDefenseResult[];
  /** IDs dos defensores que foram atingidos */
  hitDefenderIds: string[];
  /** IDs dos defensores que resistiram */
  resistedDefenderIds: string[];
}

/**
 * Descrição do sistema D6:
 *
 * MARGEM DE SUCESSO
 * - Base: Sucesso em 4, 5 ou 6 (50% por dado)
 * - +1 Vantagem: Sucesso em 3+ (66%)
 * - +2 Vantagem: Sucesso em 2+ (83%)
 * - -1 Desvantagem: Sucesso em 5+ (33%)
 * - -2 Desvantagem: Sucesso apenas em 6 (16%)
 *
 * EXPLOSÃO
 * - Apenas 6 explode
 * - Conta como 1 sucesso E gera novo dado
 * - Explosões são recursivas (6 no explosão também explode)
 *
 * QUANTIDADE DE DADOS
 * - Definida pelo atributo relevante (Combat, speed, Focus, etc.)
 *
 * TESTES RESISTIDOS
 * - Atacante e defensor rolam simultaneamente
 * - Quem tiver mais sucessos vence
 * - Empate favorece o defensor (status quo)
 *
 * CÁLCULO DE DANO/DEFESA
 * - Dano = Sucessos * Combat (ver ATTACK_CONFIG em balance.config.ts)
 * - Defesa = Sucessos * (speed / 2) (ver DEFENSE_CONFIG em balance.config.ts)
 * - Dano Final = Dano - Defesa (mínimo 0)
 *
 * PROTEÇÕES (ver balance.config.ts para multiplicadores)
 * - Proteção Física = Resistance * PHYSICAL_PROTECTION_CONFIG.multiplier
 * - Proteção Mágica = Will * MAGICAL_PROTECTION_CONFIG.multiplier
 * - Dano VERDADEIRO ignora todas as proteções
 * - Quando proteção chega a 0, fica "quebrada" e dano vai pro HP
 *
 * TIPOS DE DANO
 * - FISICO: Usa Proteção Física primeiro
 * - MAGICO: Usa Proteção Mágica primeiro
 * - VERDADEIRO: Ignora proteções, vai direto no HP
 */
