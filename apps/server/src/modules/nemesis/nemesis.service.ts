// server/src/modules/nemesis/nemesis.service.ts
// Serviço principal do Sistema Nemesis - Narrativa Emergente

import type {
  Nemesis,
  NemesisId,
  PlayerId,
  CreateNemesisInput,
  RecordEncounterInput,
  NemesisQueryFilters,
  NemesisSummary,
  NemesisEventType,
  TauntContext,
} from "@boundless/shared/types/nemesis.types";

import {
  generateId,
  generateNemesisName,
  generateInitialTraits,
  calculateInitialPowerLevel,
  determineRank,
  selectTaunt,
  formatTaunt,
} from "./nemesis.generator";

import {
  saveNemesis,
  getNemesisById,
  getNemesesByPlayer,
  queryNemeses,
  canHaveMoreNemeses,
  analyzeEncounter,
  createEncounter,
  applyEncounterConsequences,
  killNemesis,
  activateNemesis,
  deactivateNemesis,
  toNemesisSummary,
  getStoreStats,
  countActiveNemeses,
} from "./nemesis.memory";

import { NEMESIS_CONFIG, NEMESIS_RANKS } from "./nemesis.config";

// =============================================================================
// SERVIÇO PRINCIPAL
// =============================================================================

export interface NemesisService {
  // Criação
  createNemesis(input: CreateNemesisInput): Nemesis | null;
  shouldPromoteToNemesis(
    eventType: NemesisEventType,
    playerId: PlayerId
  ): boolean;

  // Consultas
  getNemesis(id: NemesisId): Nemesis | undefined;
  getPlayerNemeses(playerId: PlayerId): Nemesis[];
  getActiveNemeses(playerId: PlayerId): Nemesis[];
  queryNemeses(filters: NemesisQueryFilters): Nemesis[];
  getNemesisSummaries(playerId: PlayerId): NemesisSummary[];

  // Encontros
  recordEncounter(input: RecordEncounterInput): Nemesis | null;
  processDefeat(
    nemesisId: NemesisId,
    context?: RecordEncounterInput["context"]
  ): {
    survived: boolean;
    nemesis: Nemesis | null;
  };

  // Diálogos
  getTaunt(
    nemesisId: NemesisId,
    context: TauntContext,
    playerName: string
  ): string | null;

  // Gerenciamento
  killNemesis(id: NemesisId): boolean;
  activateNemesis(id: NemesisId): boolean;
  deactivateNemesis(id: NemesisId): boolean;

  // Estatísticas
  getStats(): ReturnType<typeof getStoreStats>;
}

// =============================================================================
// IMPLEMENTAÇÃO
// =============================================================================

class NemesisServiceImpl implements NemesisService {
  /**
   * Verifica se uma unidade deve ser promovida a Nemesis
   */
  shouldPromoteToNemesis(
    eventType: NemesisEventType,
    playerId: PlayerId
  ): boolean {
    // Verifica se jogador pode ter mais Nemesis
    if (!canHaveMoreNemeses(playerId)) {
      return false;
    }

    // Eventos que sempre promovem
    const guaranteedPromotion: NemesisEventType[] = [
      "KILLED_PLAYER_HERO",
      "KILLED_PLAYER_REGENT",
    ];

    if (guaranteedPromotion.includes(eventType)) {
      return true;
    }

    // Eventos com chance de promoção
    const promotionEvents: NemesisEventType[] = [
      "KILLED_PLAYER_UNIT",
      "ROUTED_PLAYER",
      "AMBUSHED_PLAYER",
    ];

    if (promotionEvents.includes(eventType)) {
      return Math.random() < NEMESIS_CONFIG.promotionChanceOnKill;
    }

    return false;
  }

  /**
   * Cria um novo Nemesis a partir de uma unidade
   */
  createNemesis(input: CreateNemesisInput): Nemesis | null {
    const {
      unitInstanceId,
      unitType,
      race,
      factionId,
      targetPlayerId,
      originEvent,
      originContext,
    } = input;

    // Verifica limite
    if (!canHaveMoreNemeses(targetPlayerId)) {
      return null;
    }

    // Gera traços iniciais baseados no evento de origem
    const traits = generateInitialTraits(originEvent, 2);

    // Gera nome
    const nameData = generateNemesisName(traits[0], []);

    // Calcula power level inicial
    const powerLevel = calculateInitialPowerLevel(originEvent);
    const rank = determineRank(powerLevel);

    // Gera título baseado no rank
    const rankConfig = NEMESIS_RANKS[rank];
    const titlePrefix =
      rankConfig.titlePrefix[
        Math.floor(Math.random() * rankConfig.titlePrefix.length)
      ];

    const nemesis: Nemesis = {
      id: generateId(),

      // Identidade
      name: nameData.baseName,
      title: titlePrefix || "",
      fullName: nameData.fullName,

      // Origem
      originalUnitId: unitInstanceId,
      unitType,
      race,
      factionId,

      // Status
      rank,
      powerLevel,
      isAlive: true,
      lastSeen: Date.now(),
      isActive: true,

      // Personalidade
      traits,
      fears: [],
      strengths: [],

      // Aparência
      scars: [],
      visualModifiers: [],

      // Histórico
      encounters: [],
      playerKillCount: originEvent.includes("KILLED") ? 1 : 0,
      defeatCount: 0,
      escapeCount: 0,

      // Relações
      targetPlayerId,
      hatedUnitIds: originContext?.involvedUnitId
        ? [originContext.involvedUnitId]
        : [],
      allyNemesisIds: [],
      rivalNemesisIds: [],

      // Metadados
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Cria encontro inicial
    const initialEncounter = createEncounter(originEvent, originContext);
    nemesis.encounters.push(initialEncounter);

    // Salva
    saveNemesis(nemesis);

    return nemesis;
  }

  /**
   * Busca Nemesis por ID
   */
  getNemesis(id: NemesisId): Nemesis | undefined {
    return getNemesisById(id);
  }

  /**
   * Busca todos os Nemesis de um jogador
   */
  getPlayerNemeses(playerId: PlayerId): Nemesis[] {
    return getNemesesByPlayer(playerId);
  }

  /**
   * Busca Nemesis ativos de um jogador
   */
  getActiveNemeses(playerId: PlayerId): Nemesis[] {
    return queryNemeses({ playerId, isAlive: true, isActive: true });
  }

  /**
   * Busca Nemesis com filtros customizados
   */
  queryNemeses(filters: NemesisQueryFilters): Nemesis[] {
    return queryNemeses(filters);
  }

  /**
   * Retorna resumos dos Nemesis de um jogador
   */
  getNemesisSummaries(playerId: PlayerId): NemesisSummary[] {
    return getNemesesByPlayer(playerId).map(toNemesisSummary);
  }

  /**
   * Registra um encontro com um Nemesis
   */
  recordEncounter(input: RecordEncounterInput): Nemesis | null {
    const { nemesisId, eventType, context } = input;

    const nemesis = getNemesisById(nemesisId);
    if (!nemesis || !nemesis.isAlive) return null;

    // Analisa consequências
    const analysis = analyzeEncounter(nemesis, eventType, context);

    // Cria registro do encontro
    const encounter = createEncounter(eventType, context, analysis);

    // Aplica consequências
    const updated = applyEncounterConsequences(nemesis, encounter, analysis);

    // Salva
    saveNemesis(updated);

    return updated;
  }

  /**
   * Processa a derrota de um Nemesis (determina se sobrevive)
   */
  processDefeat(
    nemesisId: NemesisId,
    context?: RecordEncounterInput["context"]
  ): { survived: boolean; nemesis: Nemesis | null } {
    const nemesis = getNemesisById(nemesisId);
    if (!nemesis || !nemesis.isAlive) {
      return { survived: false, nemesis: null };
    }

    // Chance de sobreviver baseada em traços
    let survivalChance = NEMESIS_CONFIG.survivalChanceOnDefeat;

    // Traço SURVIVOR aumenta chance
    if (nemesis.traits.includes("SURVIVOR")) {
      survivalChance += 0.2;
    }

    // Traço COWARD aumenta chance (foge antes de morrer)
    if (nemesis.traits.includes("COWARD")) {
      survivalChance += 0.15;
    }

    // Força DETERMINED aumenta chance
    if (nemesis.strengths.includes("DETERMINED")) {
      survivalChance += 0.1;
    }

    // HP muito baixo diminui chance
    if (
      context?.remainingHpPercent !== undefined &&
      context.remainingHpPercent < 10
    ) {
      survivalChance -= 0.2;
    }

    // Clamp
    survivalChance = Math.max(0.1, Math.min(0.9, survivalChance));

    const survived = Math.random() < survivalChance;

    if (survived) {
      // Registra como ferido/escapou
      const eventType: NemesisEventType = nemesis.traits.includes("COWARD")
        ? "SCARED_OFF"
        : "DEFEATED_BY_PLAYER";

      const updated = this.recordEncounter({
        nemesisId,
        eventType,
        context,
      });

      // Desativa temporariamente
      deactivateNemesis(nemesisId);

      return { survived: true, nemesis: updated };
    } else {
      // Morreu de vez
      killNemesis(nemesisId);
      return { survived: false, nemesis };
    }
  }

  /**
   * Obtém uma provocação contextual do Nemesis
   */
  getTaunt(
    nemesisId: NemesisId,
    context: TauntContext,
    playerName: string
  ): string | null {
    const nemesis = getNemesisById(nemesisId);
    if (!nemesis) return null;

    const taunt = selectTaunt({
      context,
      traits: nemesis.traits,
      scars: nemesis.scars,
      killCount: nemesis.playerKillCount,
      nemesisName: nemesis.name,
      playerName,
    });

    if (!taunt) return null;

    return formatTaunt(taunt, {
      context,
      traits: nemesis.traits,
      scars: nemesis.scars,
      killCount: nemesis.playerKillCount,
      nemesisName: nemesis.name,
      playerName,
    });
  }

  /**
   * Mata um Nemesis definitivamente
   */
  killNemesis(id: NemesisId): boolean {
    return killNemesis(id);
  }

  /**
   * Ativa um Nemesis para aparecer em batalhas
   */
  activateNemesis(id: NemesisId): boolean {
    return activateNemesis(id);
  }

  /**
   * Desativa um Nemesis temporariamente
   */
  deactivateNemesis(id: NemesisId): boolean {
    return deactivateNemesis(id);
  }

  /**
   * Retorna estatísticas do sistema
   */
  getStats() {
    return getStoreStats();
  }
}

// =============================================================================
// EXPORTAÇÃO
// =============================================================================

/** Singleton do serviço Nemesis */
export const nemesisService: NemesisService = new NemesisServiceImpl();

// Exporta também a classe para testes
export { NemesisServiceImpl };
