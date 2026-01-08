// server/src/ai/core/ai-controller.ts
// Controlador principal da IA de batalha

import type { ArenaBattle } from "../../../../shared/types/arena.types";
import type { AbilityDefinition as SkillDefinition } from "../../../../shared/types/ability.types";
import type {
  AIDecision,
  AIBattleContext,
  AITurnResult,
} from "../types/ai.types";
import { DEFAULT_AI_PROFILES, DEFAULT_AI_TIMEOUT } from "../types/ai.types";
import { getUnitAIProfile, processUnitWithTimeout } from "./decision-maker";
import {
  withTimeout,
  safeExecute,
  getFallbackDecision,
  SafeIterator,
  safetyLogger,
  limitArray,
} from "./safety-guards";
import { BattleUnit } from "../../../../shared/types/battle.types";
import {
  findSkillByCode,
  isCommonAction,
} from "../../../../shared/data/abilities.data";
import { filterVisibleUnitsWithLoS } from "./target-selection";

// ID especial para o "jogador" IA
export const AI_PLAYER_ID = "__AI__";

// =============================================================================
// IDENTIFICAÇÃO DE UNIDADES IA
// =============================================================================

/**
 * Verifica se uma unidade é controlada pela IA
 * (SUMMON ou MONSTER)
 */
export function isAIControlledUnit(unit: BattleUnit): boolean {
  const category = unit.category?.toUpperCase() || "";
  return category === "SUMMON" || category === "MONSTER";
}

/**
 * Obtém todas as unidades controladas pela IA em uma batalha
 */
export function getAIUnits(battle: ArenaBattle): BattleUnit[] {
  return battle.units.filter((u) => u.isAlive && isAIControlledUnit(u));
}

/**
 * Verifica se a batalha tem unidades IA ativas
 */
export function hasActiveAIUnits(battle: ArenaBattle): boolean {
  return getAIUnits(battle).length > 0;
}

/**
 * Verifica se é o turno da IA
 */
export function isAITurn(battle: ArenaBattle): boolean {
  return battle.currentPlayerId === AI_PLAYER_ID;
}

// =============================================================================
// CONTEXTO DE BATALHA
// =============================================================================

/**
 * Cria o contexto de batalha para a IA
 * Suporta tanto Battle (servidor) quanto ArenaBattle (client)
 * IMPORTANTE: Filtra unidades baseado no campo de visão (fog of war) com Line of Sight
 */
export function createBattleContext(
  battle:
    | ArenaBattle
    | {
        id: string;
        round: number;
        units: BattleUnit[];
        config: {
          map: { obstacles?: any[] };
          grid: { width: number; height: number };
        };
      },
  unit: BattleUnit
): AIBattleContext {
  // Suportar ambos os formatos (battleId do client, id do servidor)
  const battleId = (battle as ArenaBattle).battleId || (battle as any).id;

  // Obter obstáculos
  const obstacles = battle.config.map.obstacles || [];

  // Filtrar unidades baseado no campo de visão da unidade (com Line of Sight)
  const visibleUnits = filterVisibleUnitsWithLoS(unit, battle.units, obstacles);

  return {
    battleId,
    round: battle.round,
    units: visibleUnits, // Somente unidades visíveis!
    obstacles,
    gridSize: {
      width: battle.config.grid.width,
      height: battle.config.grid.height,
    },
    movesRemaining: unit.movesLeft,
    actionsRemaining: unit.actionsLeft,
  };
}

// =============================================================================
// OBTENÇÃO DE SKILLS E SPELLS
// =============================================================================

/**
 * Obtém as skills ativas disponíveis para uma unidade
 * Busca nas features da unidade e retorna as definições de skill correspondentes
 */
export function getUnitSkills(unit: BattleUnit): SkillDefinition[] {
  if (!unit.features || unit.features.length === 0) {
    return [];
  }

  // Filtrar apenas skills ativas (não ações comuns como ATTACK, DASH, DODGE)
  return unit.features
    .filter((featureCode: string) => !isCommonAction(featureCode))
    .map((skillCode: string) => findSkillByCode(skillCode))
    .filter(
      (skill): skill is SkillDefinition =>
        skill !== undefined &&
        skill !== null &&
        skill.activationType === "ACTIVE"
    );
}

// Re-exportar getUnitSpells do ability-evaluator (unificado)
export { getUnitSpells } from "./ability-evaluator";

// =============================================================================
// PROCESSAMENTO DO TURNO DA IA
// =============================================================================

// Máximo de unidades processadas por turno (segurança)
const MAX_AI_UNITS_PER_TURN = 50;

/**
 * Processa o turno completo da IA
 * Retorna lista de decisões para cada unidade IA
 * Com travas de segurança contra loops infinitos e timeouts
 */
export async function processAITurn(
  battle: ArenaBattle
): Promise<AITurnResult> {
  const startTime = Date.now();
  const decisions: AIDecision[] = [];
  const processedUnitIds: string[] = [];

  try {
    // Obter unidades IA com limite de segurança
    let aiUnits = getAIUnits(battle);
    aiUnits = limitArray(aiUnits, MAX_AI_UNITS_PER_TURN, "aiUnits");

    console.log(`[AI] Processando turno da IA - ${aiUnits.length} unidades`);

    // Ordenar unidades por speed (mais rápidas primeiro)
    aiUnits.sort((a, b) => b.speed - a.speed);

    // Iterator seguro para prevenir loops infinitos
    const iterator = new SafeIterator(MAX_AI_UNITS_PER_TURN, "processAITurn");

    for (const unit of aiUnits) {
      // Verificar limite de iterações
      if (!iterator.canContinue()) {
        safetyLogger.warn(
          "max-iterations",
          "Limite de unidades atingido no turno da IA"
        );
        break;
      }

      // Verificar timeout global do turno
      if (Date.now() - startTime > DEFAULT_AI_TIMEOUT.turnTimeout) {
        safetyLogger.warn("turn-timeout", "Timeout do turno da IA atingido");
        break;
      }

      console.log(`[AI] Processando ${unit.name} (${unit.id})`);

      // Obter perfil da unidade com fallback
      const profile = safeExecute(
        () => getUnitAIProfile(unit, DEFAULT_AI_PROFILES),
        DEFAULT_AI_PROFILES.MONSTER,
        `getUnitAIProfile-${unit.name}`
      );

      console.log(
        `[AI] Perfil: ${profile.behavior}, Skills: ${profile.skillPriority}`
      );

      // Criar contexto com proteção
      const context = safeExecute(
        () => createBattleContext(battle, unit),
        {
          battleId: battle.battleId,
          round: battle.round,
          units: [],
          obstacles: [],
          gridSize: { width: 10, height: 10 },
          movesRemaining: 0,
          actionsRemaining: 0,
        },
        `createBattleContext-${unit.name}`
      );

      // Obter skills com proteção
      const skills = safeExecute(
        () => getUnitSkills(unit),
        [],
        `getUnitSkills-${unit.name}`
      );

      // Processar decisão COM TIMEOUT
      const decision = await processUnitWithTimeout(
        unit,
        context,
        profile,
        skills,
        DEFAULT_AI_TIMEOUT.decisionTimeout
      );

      decisions.push(decision);
      processedUnitIds.push(unit.id);

      console.log(
        `[AI] Decisão: ${decision.type} - ${decision.reason || "sem razão"}`
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[AI] Turno processado em ${elapsed}ms - ${decisions.length} decisões`
    );

    return {
      aiPlayerId: AI_PLAYER_ID,
      decisions,
      unitsProcessed: processedUnitIds,
    };
  } catch (error) {
    // Catch-all para garantir que nunca trave
    safetyLogger.error(
      "turn-error",
      "Erro crítico no processamento do turno da IA",
      error
    );

    return {
      aiPlayerId: AI_PLAYER_ID,
      decisions: [],
      unitsProcessed: [],
    };
  }
}

/**
 * Processa uma única unidade da IA (para execução sequencial)
 * Com proteções de segurança
 */
export async function processAIUnit(
  battle: ArenaBattle,
  unitId: string
): Promise<AIDecision | null> {
  try {
    const unit = battle.units.find((u) => u.id === unitId && u.isAlive);
    if (!unit || !isAIControlledUnit(unit)) {
      return null;
    }

    const profile = safeExecute(
      () => getUnitAIProfile(unit, DEFAULT_AI_PROFILES),
      DEFAULT_AI_PROFILES.MONSTER,
      "getUnitAIProfile"
    );

    const context = safeExecute(
      () => createBattleContext(battle, unit),
      {
        battleId: battle.battleId,
        round: battle.round,
        units: [],
        obstacles: [],
        gridSize: { width: 10, height: 10 },
        movesRemaining: 0,
        actionsRemaining: 0,
      },
      "createBattleContext"
    );

    const skills = safeExecute(() => getUnitSkills(unit), [], "getUnitSkills");

    return await processUnitWithTimeout(
      unit,
      context,
      profile,
      skills,
      DEFAULT_AI_TIMEOUT.decisionTimeout
    );
  } catch (error) {
    safetyLogger.error(
      "unit-error",
      `Erro ao processar unidade ${unitId}`,
      error
    );
    return getFallbackDecision("unit-error");
  }
}

// =============================================================================
// PROCESSAMENTO DE UNIDADES BOT (sem restrição de categoria)
// =============================================================================

/**
 * Processa uma unidade BOT (qualquer categoria, não só SUMMON/MONSTER)
 * Usado para batalhas contra BOT onde o Regente é controlado por IA
 */
export async function processBotUnitDecision(
  battle: ArenaBattle,
  unit: BattleUnit
): Promise<AIDecision> {
  const startTime = Date.now();

  try {
    console.log(`[BOT-AI] Processando decisão para ${unit.name}`);
    console.log(
      `[BOT-AI] Unit state: movesLeft=${unit.movesLeft}, actionsLeft=${unit.actionsLeft}, pos=(${unit.posX}, ${unit.posY})`
    );

    // Determinar perfil baseado no aiBehavior da unidade ou categoria/classe
    let profile = DEFAULT_AI_PROFILES.WARRIOR; // Padrão para Regentes

    // Se a unidade tem aiBehavior definido, usar o perfil correspondente
    if (unit.aiBehavior) {
      const behaviorToProfile: Record<
        string,
        keyof typeof DEFAULT_AI_PROFILES
      > = {
        AGGRESSIVE: "MONSTER",
        TACTICAL: "WARRIOR",
        DEFENSIVE: "TANK",
        SUPPORT: "HEALER",
        RANGED: "ARCHER",
      };
      const profileKey = behaviorToProfile[unit.aiBehavior];
      if (profileKey) {
        profile = DEFAULT_AI_PROFILES[profileKey];
      }
    } else if (unit.category === "SUMMON") {
      profile = DEFAULT_AI_PROFILES.SUMMON;
    } else if (unit.category === "MONSTER") {
      profile = DEFAULT_AI_PROFILES.MONSTER;
    } else if (unit.classCode && unit.classCode in DEFAULT_AI_PROFILES) {
      profile =
        DEFAULT_AI_PROFILES[unit.classCode as keyof typeof DEFAULT_AI_PROFILES];
    }

    console.log(`[BOT-AI] Perfil: ${profile.behavior}`);

    // Criar contexto (com fog of war - filtra unidades por visão)
    const context = createBattleContext(battle, unit);

    // Log do contexto - mostrar visão
    const visionRange = unit.visionRange ?? Math.max(10, unit.focus);
    const totalEnemies = battle.units.filter(
      (u: BattleUnit) => u.isAlive && u.ownerId !== unit.ownerId
    ).length;
    const visibleEnemies = context.units.filter(
      (u: BattleUnit) => u.isAlive && u.ownerId !== unit.ownerId
    );
    console.log(
      `[BOT-AI] Visão: ${visionRange} blocos | Inimigos: ${visibleEnemies.length}/${totalEnemies} visíveis`
    );
    if (visibleEnemies.length === 0 && totalEnemies > 0) {
      console.log(
        `[BOT-AI] ⚠️ Nenhum inimigo no campo de visão - vai explorar`
      );
    }
    visibleEnemies.forEach((e: BattleUnit) =>
      console.log(
        `[BOT-AI]   - Inimigo: ${e.name} em (${e.posX}, ${e.posY}) HP=${e.currentHp}`
      )
    );

    // Obter skills da unidade
    const skills = getUnitSkills(unit);

    // Processar decisão com timeout
    const decision = await processUnitWithTimeout(
      unit,
      context,
      profile,
      skills,
      DEFAULT_AI_TIMEOUT.decisionTimeout
    );

    const elapsed = Date.now() - startTime;
    console.log(
      `[BOT-AI] Decisão: ${decision.type} em ${elapsed}ms - ${decision.reason}`
    );

    return decision;
  } catch (error) {
    safetyLogger.error(
      "bot-unit-error",
      `Erro ao processar decisão do BOT para ${unit.name}`,
      error
    );
    return getFallbackDecision("bot-error");
  }
}

// =============================================================================
// VERIFICAÇÃO DE VITÓRIA
// =============================================================================

/**
 * Verifica condição de vitória ignorando unidades IA
 * Retorna: null (batalha continua), 'DRAW', ou ID do jogador vencedor
 */
export function checkVictoryIgnoringAI(battle: ArenaBattle): string | null {
  const playerUnits = battle.units.filter(
    (u) => u.isAlive && !isAIControlledUnit(u)
  );

  // Agrupar por jogador
  const unitsPerPlayer = new Map<string, BattleUnit[]>();

  for (const unit of playerUnits) {
    const ownerId = unit.ownerId;
    if (!unitsPerPlayer.has(ownerId)) {
      unitsPerPlayer.set(ownerId, []);
    }
    unitsPerPlayer.get(ownerId)!.push(unit);
  }

  const playersWithUnits = Array.from(unitsPerPlayer.keys());

  // Nenhum jogador tem unidades = empate
  if (playersWithUnits.length === 0) {
    return "DRAW";
  }

  // Apenas 1 jogador tem unidades = ele venceu
  if (playersWithUnits.length === 1) {
    return playersWithUnits[0];
  }

  // Mais de 1 jogador tem unidades = batalha continua
  return null;
}

// =============================================================================
// UTILIDADES DE DELAY
// =============================================================================

/**
 * Delay para ações da IA (para visualização)
 */
export function aiActionDelay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// LOGGING
// =============================================================================

export function logAIDecision(decision: AIDecision, unit: BattleUnit): void {
  const actionDesc = {
    MOVE: `mover para (${decision.targetPosition?.x}, ${decision.targetPosition?.y})`,
    ATTACK: `atacar`,
    SKILL: `usar skill ${decision.skillCode}`,
    SPELL: `usar spell ${decision.spellCode}`,
    DASH: `usar corrida`,
    PASS: "passar turno",
  }[decision.type];

  console.log(`[AI] ${unit.name}: ${actionDesc} - ${decision.reason}`);
}
