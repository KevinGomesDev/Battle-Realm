// shared/config/dice.config.ts
// Configuração do sistema de dados D6

// =============================================================================
// CONFIGURAÇÃO DE DADOS
// =============================================================================

export const DICE_CONFIG = {
  /**
   * Faces do dado
   */
  sides: 6,

  /**
   * Threshold base para sucesso (sucesso se >= threshold)
   * Com advantage/disadvantage isso muda
   */
  baseSuccessThreshold: 4,

  /**
   * Valor que explode (rola dado adicional)
   */
  explosionValue: 6,

  /**
   * Explosões são recursivas?
   */
  recursiveExplosions: true,
} as const;
