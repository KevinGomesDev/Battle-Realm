// server/src/modules/nemesis/nemesis.memory.ts
// Sistema de memória do Nemesis - Armazena e processa histórico de encontros

import type {
  Nemesis,
  NemesisId,
  PlayerId,
  NemesisEncounter,
  NemesisEventType,
  NemesisFear,
  NemesisStrength,
  ScarType,
  PersonalityTrait,
  NemesisQueryFilters,
  NemesisSummary,
} from "@boundless/shared/types/nemesis.types";

import {
  determineFearFromDamage,
  determineStrengthFromSurvival,
  determineScarFromDamage,
  calculatePowerGain,
  determineRank,
  generateTitle,
  generateNemesisName,
  filterCompatibleTraits,
} from "./nemesis.generator";

import { NEMESIS_CONFIG } from "./nemesis.config";

// =============================================================================
// ARMAZENAMENTO EM MEMÓRIA
// =============================================================================

/** Armazenamento de todos os Nemesis (em produção seria banco de dados) */
const nemesisStore: Map<NemesisId, Nemesis> = new Map();

/** Índice por jogador para busca rápida */
const nemesisByPlayer: Map<PlayerId, Set<NemesisId>> = new Map();

// =============================================================================
// ANÁLISE DE ENCONTROS
// =============================================================================

export interface EncounterAnalysis {
  /** Se foi uma vitória do Nemesis */
  isNemesisVictory: boolean;
  /** Se foi uma derrota do Nemesis */
  isNemesisDefeat: boolean;
  /** Se o Nemesis sobreviveu (escapou) */
  nemesisSurvived: boolean;
  /** Tipo de dano envolvido */
  damageType?: string;
  /** Quantidade de mudança de power */
  powerChange: number;
  /** Novos medos potenciais */
  potentialFears: NemesisFear[];
  /** Novas forças potenciais */
  potentialStrengths: NemesisStrength[];
  /** Novas cicatrizes potenciais */
  potentialScars: ScarType[];
  /** Novos traços potenciais */
  potentialTraits: PersonalityTrait[];
}

/** Eventos que representam vitória do Nemesis */
const NEMESIS_VICTORY_EVENTS: NemesisEventType[] = [
  "KILLED_PLAYER_UNIT",
  "KILLED_PLAYER_HERO",
  "KILLED_PLAYER_REGENT",
  "ROUTED_PLAYER",
  "AMBUSHED_PLAYER",
];

/** Eventos que representam derrota do Nemesis */
const NEMESIS_DEFEAT_EVENTS: NemesisEventType[] = [
  "WOUNDED_BY_PLAYER",
  "DEFEATED_BY_PLAYER",
  "HUMILIATED",
  "SCARED_OFF",
];

/** Analisa um encontro e determina consequências */
export function analyzeEncounter(
  nemesis: Nemesis,
  eventType: NemesisEventType,
  context?: NemesisEncounter["context"]
): EncounterAnalysis {
  const isNemesisVictory = NEMESIS_VICTORY_EVENTS.includes(eventType);
  const isNemesisDefeat = NEMESIS_DEFEAT_EVENTS.includes(eventType);
  const nemesisSurvived =
    eventType === "ESCAPED_BATTLE" || eventType === "SCARED_OFF";

  const powerChange = calculatePowerGain(eventType);
  const damageType = context?.damageType;

  const potentialFears: NemesisFear[] = [];
  const potentialStrengths: NemesisStrength[] = [];
  const potentialScars: ScarType[] = [];
  const potentialTraits: PersonalityTrait[] = [];

  // Processa consequências de derrota/ferimento
  if (isNemesisDefeat) {
    // Medo do tipo de dano
    if (damageType) {
      const fear = determineFearFromDamage(damageType, context?.wasOutnumbered);
      if (fear && !nemesis.fears.includes(fear)) {
        potentialFears.push(fear);
      }
    }

    // Cicatriz se foi ferido gravemente
    if (
      context?.remainingHpPercent !== undefined &&
      context.remainingHpPercent < 30 &&
      damageType
    ) {
      const scar = determineScarFromDamage(damageType);
      if (scar && !nemesis.scars.includes(scar)) {
        potentialScars.push(scar);
      }
    }

    // Traço VENGEFUL após derrotas
    if (nemesis.defeatCount >= 1 && !nemesis.traits.includes("VENGEFUL")) {
      if (filterCompatibleTraits(nemesis.traits, "VENGEFUL")) {
        potentialTraits.push("VENGEFUL");
      }
    }
  }

  // Processa consequências de sobrevivência
  if (nemesisSurvived || isNemesisDefeat) {
    const survivalCount = nemesis.escapeCount + nemesis.defeatCount + 1;

    // Força após múltiplas sobrevivências
    const strength = determineStrengthFromSurvival(damageType, survivalCount);
    if (strength && !nemesis.strengths.includes(strength)) {
      potentialStrengths.push(strength);
    }

    // Traço SURVIVOR após muitas sobrevivências
    if (survivalCount >= 3 && !nemesis.traits.includes("SURVIVOR")) {
      if (filterCompatibleTraits(nemesis.traits, "SURVIVOR")) {
        potentialTraits.push("SURVIVOR");
      }
    }
  }

  // Processa consequências de vitória
  if (isNemesisVictory) {
    // Traço SADISTIC após muitas kills
    if (nemesis.playerKillCount >= 3 && !nemesis.traits.includes("SADISTIC")) {
      if (filterCompatibleTraits(nemesis.traits, "SADISTIC")) {
        potentialTraits.push("SADISTIC");
      }
    }

    // Traço PRIDEFUL após vitórias significativas
    if (
      (eventType === "KILLED_PLAYER_HERO" ||
        eventType === "KILLED_PLAYER_REGENT") &&
      !nemesis.traits.includes("PRIDEFUL")
    ) {
      if (filterCompatibleTraits(nemesis.traits, "PRIDEFUL")) {
        potentialTraits.push("PRIDEFUL");
      }
    }
  }

  return {
    isNemesisVictory,
    isNemesisDefeat,
    nemesisSurvived,
    damageType,
    powerChange,
    potentialFears,
    potentialStrengths,
    potentialScars,
    potentialTraits,
  };
}

// =============================================================================
// CRIAÇÃO DE ENCONTROS
// =============================================================================

/** Cria um registro de encontro */
export function createEncounter(
  eventType: NemesisEventType,
  context?: NemesisEncounter["context"],
  analysis?: EncounterAnalysis
): NemesisEncounter {
  return {
    id: `enc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    eventType,
    context: context ?? {},
    consequences: {
      fearsGained: analysis?.potentialFears ?? [],
      strengthsGained: analysis?.potentialStrengths ?? [],
      scarsGained: analysis?.potentialScars ?? [],
      traitsGained: analysis?.potentialTraits ?? [],
      rankChange: analysis?.powerChange ?? 0,
    },
  };
}

// =============================================================================
// APLICAÇÃO DE CONSEQUÊNCIAS
// =============================================================================

/** Aplica consequências de um encontro ao Nemesis */
export function applyEncounterConsequences(
  nemesis: Nemesis,
  encounter: NemesisEncounter,
  analysis: EncounterAnalysis
): Nemesis {
  // Atualiza contadores
  if (analysis.isNemesisVictory) {
    if (
      encounter.eventType === "KILLED_PLAYER_UNIT" ||
      encounter.eventType === "KILLED_PLAYER_HERO" ||
      encounter.eventType === "KILLED_PLAYER_REGENT"
    ) {
      nemesis.playerKillCount += 1;
    }
  }

  if (analysis.isNemesisDefeat) {
    nemesis.defeatCount += 1;
  }

  if (analysis.nemesisSurvived || encounter.eventType === "ESCAPED_BATTLE") {
    nemesis.escapeCount += 1;
  }

  // Aplica mudanças de poder
  nemesis.powerLevel = Math.max(1, nemesis.powerLevel + analysis.powerChange);
  nemesis.rank = determineRank(nemesis.powerLevel);

  // Aplica medos
  for (const fear of analysis.potentialFears) {
    if (!nemesis.fears.includes(fear)) {
      nemesis.fears.push(fear);
    }
  }

  // Aplica forças
  for (const strength of analysis.potentialStrengths) {
    if (!nemesis.strengths.includes(strength)) {
      nemesis.strengths.push(strength);
    }
  }

  // Aplica cicatrizes
  for (const scar of analysis.potentialScars) {
    if (!nemesis.scars.includes(scar)) {
      nemesis.scars.push(scar);
    }
  }

  // Aplica traços (com verificação de compatibilidade)
  for (const trait of analysis.potentialTraits) {
    if (
      !nemesis.traits.includes(trait) &&
      filterCompatibleTraits(nemesis.traits, trait)
    ) {
      nemesis.traits.push(trait);
    }
  }

  // Atualiza nome se ganhou cicatrizes
  if (analysis.potentialScars.length > 0) {
    const newName = generateNemesisName(nemesis.traits[0], nemesis.scars);
    nemesis.name = newName.baseName;
    nemesis.fullName = newName.fullName;
  }

  // Atualiza título baseado em conquistas
  const newTitle = generateTitle({
    heroKills: nemesis.encounters.filter(
      (e) => e.eventType === "KILLED_PLAYER_HERO"
    ).length,
    regentKills: nemesis.encounters.filter(
      (e) => e.eventType === "KILLED_PLAYER_REGENT"
    ).length,
    totalKills: nemesis.playerKillCount,
    survivalCount: nemesis.escapeCount + nemesis.defeatCount,
    escapeCount: nemesis.escapeCount,
    ambushCount: nemesis.encounters.filter(
      (e) => e.eventType === "AMBUSHED_PLAYER"
    ).length,
  });

  if (newTitle) {
    nemesis.title = newTitle;
  }

  // Adiciona encontro ao histórico
  nemesis.encounters.push(encounter);

  // Atualiza timestamps
  nemesis.lastSeen = Date.now();
  nemesis.updatedAt = Date.now();

  return nemesis;
}

// =============================================================================
// OPERAÇÕES DE ARMAZENAMENTO
// =============================================================================

/** Salva Nemesis no store */
export function saveNemesis(nemesis: Nemesis): void {
  nemesisStore.set(nemesis.id, nemesis);

  // Atualiza índice por jogador
  if (!nemesisByPlayer.has(nemesis.targetPlayerId)) {
    nemesisByPlayer.set(nemesis.targetPlayerId, new Set());
  }
  nemesisByPlayer.get(nemesis.targetPlayerId)!.add(nemesis.id);
}

/** Busca Nemesis por ID */
export function getNemesisById(id: NemesisId): Nemesis | undefined {
  return nemesisStore.get(id);
}

/** Busca todos os Nemesis de um jogador */
export function getNemesesByPlayer(playerId: PlayerId): Nemesis[] {
  const nemesisIds = nemesisByPlayer.get(playerId);
  if (!nemesisIds) return [];

  return Array.from(nemesisIds)
    .map((id) => nemesisStore.get(id))
    .filter((n): n is Nemesis => n !== undefined);
}

/** Busca Nemesis com filtros */
export function queryNemeses(filters: NemesisQueryFilters): Nemesis[] {
  let results: Nemesis[];

  // Se filtrar por jogador, começa com subset
  if (filters.playerId) {
    results = getNemesesByPlayer(filters.playerId);
  } else {
    results = Array.from(nemesisStore.values());
  }

  // Aplica filtros adicionais
  if (filters.isAlive !== undefined) {
    results = results.filter((n) => n.isAlive === filters.isAlive);
  }

  if (filters.isActive !== undefined) {
    results = results.filter((n) => n.isActive === filters.isActive);
  }

  if (filters.factionId) {
    results = results.filter((n) => n.factionId === filters.factionId);
  }

  if (filters.minRank) {
    const rankOrder = ["GRUNT", "CAPTAIN", "ELITE", "WARLORD", "OVERLORD"];
    const minRankIndex = rankOrder.indexOf(filters.minRank);
    results = results.filter((n) => rankOrder.indexOf(n.rank) >= minRankIndex);
  }

  return results;
}

/** Conta Nemesis ativos de um jogador */
export function countActiveNemeses(playerId: PlayerId): number {
  return queryNemeses({ playerId, isAlive: true, isActive: true }).length;
}

/** Verifica se jogador pode ter mais Nemesis */
export function canHaveMoreNemeses(playerId: PlayerId): boolean {
  return (
    countActiveNemeses(playerId) < NEMESIS_CONFIG.maxActiveNemesesPerPlayer
  );
}

/** Remove Nemesis (marca como morto) */
export function killNemesis(id: NemesisId): boolean {
  const nemesis = nemesisStore.get(id);
  if (!nemesis) return false;

  nemesis.isAlive = false;
  nemesis.isActive = false;
  nemesis.updatedAt = Date.now();

  return true;
}

/** Desativa Nemesis temporariamente */
export function deactivateNemesis(id: NemesisId): boolean {
  const nemesis = nemesisStore.get(id);
  if (!nemesis) return false;

  nemesis.isActive = false;
  nemesis.updatedAt = Date.now();

  return true;
}

/** Ativa Nemesis */
export function activateNemesis(id: NemesisId): boolean {
  const nemesis = nemesisStore.get(id);
  if (!nemesis || !nemesis.isAlive) return false;

  nemesis.isActive = true;
  nemesis.updatedAt = Date.now();

  return true;
}

/** Converte para resumo */
export function toNemesisSummary(nemesis: Nemesis): NemesisSummary {
  return {
    id: nemesis.id,
    fullName: nemesis.fullName,
    rank: nemesis.rank,
    powerLevel: nemesis.powerLevel,
    playerKillCount: nemesis.playerKillCount,
    isAlive: nemesis.isAlive,
    lastSeen: nemesis.lastSeen,
    primaryTrait: nemesis.traits[0],
    scarCount: nemesis.scars.length,
  };
}

// =============================================================================
// LIMPEZA E MANUTENÇÃO
// =============================================================================

/** Remove Nemesis inativos há muito tempo */
export function cleanupInactiveNemeses(maxInactiveMs: number): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, nemesis] of nemesisStore.entries()) {
    if (!nemesis.isAlive && now - nemesis.updatedAt > maxInactiveMs) {
      nemesisStore.delete(id);

      const playerSet = nemesisByPlayer.get(nemesis.targetPlayerId);
      if (playerSet) {
        playerSet.delete(id);
      }

      cleaned++;
    }
  }

  return cleaned;
}

/** Limpa todo o store (para testes) */
export function clearAllNemeses(): void {
  nemesisStore.clear();
  nemesisByPlayer.clear();
}

/** Retorna estatísticas do store */
export function getStoreStats(): {
  totalNemeses: number;
  aliveNemeses: number;
  activeNemeses: number;
  playerCount: number;
} {
  const all = Array.from(nemesisStore.values());

  return {
    totalNemeses: all.length,
    aliveNemeses: all.filter((n) => n.isAlive).length,
    activeNemeses: all.filter((n) => n.isActive).length,
    playerCount: nemesisByPlayer.size,
  };
}
