// src/data/units.ts
// Configurações de level up e limites de unidades (Regente, Tropas)
// NOTA: Heróis são pré-definidos em heroes.data.ts (recrutáveis durante partidas)

// --- REINO ---
export const MAX_KINGDOMS_PER_USER = 3; // Limite de reinos por jogador

// --- REGENTE ---
export const REGENT_LEVELUP_BASE_COST = 6; // Começa em 6
export const REGENT_LEVELUP_INCREMENT = 3; // Incrementa 3 por nível
export const REGENT_INITIAL_ATTRIBUTE_POINTS = 30;
export const REGENT_ATTRIBUTE_POINTS_PER_LEVEL = 6;

// --- HERÓI ---
// Heróis são templates pré-definidos em heroes.data.ts
// Não são criados pelo jogador - são recrutados durante partidas
// XP e Level Up configurados em heroes.data.ts
export const MAX_HEROES_PER_KINGDOM = 3; // Máximo de heróis que um reino pode ter ao mesmo tempo
export const MAX_HERO_LEVEL = 10;

// --- TROPAS ---
// Custos de recrutamento de Tropas (baseado na quantidade de tropas da mesma categoria)
// Fórmula: (quantidade_atual + 1) × 2
export const TROOP_RECRUITMENT_BASE_COST = 2;

// Custos de Level Up de Categoria de Tropa (Nível 1→2: 2, 2→3: 3, etc.)
export const TROOP_LEVELUP_COSTS: Record<number, number> = {
  1: 2, // Nível 1 → 2
  2: 3, // Nível 2 → 3
  3: 4, // Nível 3 → 4
  4: 5, // Nível 4 → 5
  5: 6, // Nível 5 → 6
  6: 7, // Nível 6 → 7
  7: 8, // Nível 7 → 8
  8: 9, // Nível 8 → 9
  9: 10, // Nível 9 → 10
};

export const MAX_TROOP_LEVEL = 10;
export const TROOP_ATTRIBUTE_POINTS_PER_LEVEL = 2;
