// shared/types/ranking.types.ts
// Tipos de Ranking compartilhados entre Frontend e Backend

/**
 * Entrada individual no ranking
 */
export interface RankingEntry {
  rank: number;
  username: string;
  victories: number;
}

/**
 * Dados completos de ranking (arena e partida)
 */
export interface RankingData {
  arena: RankingEntry[];
  match: RankingEntry[];
}

/**
 * Tipo de ranking disponível
 */
export type RankingTab = "arena" | "match";
