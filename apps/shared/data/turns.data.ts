// src/data/turns.ts
// Configurações de turnos, rodadas e custos

export enum TurnType {
  ADMINISTRACAO = "ADMINISTRACAO",
  EXERCITOS = "EXERCITOS",
  MOVIMENTACAO = "MOVIMENTACAO",
  CRISE = "CRISE",
  ACAO = "ACAO",
  BATALHA = "BATALHA",
}

// Ordem dos turnos em uma rodada
export const TURN_ORDER: TurnType[] = [
  TurnType.ADMINISTRACAO,
  TurnType.EXERCITOS,
  TurnType.MOVIMENTACAO,
  TurnType.CRISE,
  TurnType.ACAO,
  TurnType.BATALHA,
];

// --- CONSTRUÇÃO ---
// Custos de construção baseado na quantidade de construções já existentes
export const CONSTRUCTION_COSTS: Record<number, number> = {
  1: 0, // Primeira construção (capital) é grátis
  2: 2, // Segunda construção
  3: 4, // Terceira construção
  4: 6, // Quarta construção
  5: 8, // Quinta construção
  6: 10, // Sexta construção
  7: 12, // Sétima construção
  8: 14, // Oitava construção
};

// Limites de construção
export const MAX_CONSTRUCTIONS_PER_TERRITORY = 8;
export const MAX_FORTRESSES_PER_TERRITORY = 3;

// --- MOVIMENTO ---
export const MOVEMENT_COST_BETWEEN_TERRITORIES = 1; // 1 Suprimento por movimento entre territórios
export const MOVEMENT_WITHIN_TERRITORY_COST = 0; // Movimento dentro do mesmo território é grátis
