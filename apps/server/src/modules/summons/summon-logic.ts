// server/src/logic/summon-logic.ts
// Lógica de invocações (summons) - Criação e mecânicas especiais

import {
  getSummonByCode,
  createSummonStats,
} from "@boundless/shared/data/summons.data";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";
import {
  HP_CONFIG,
  MANA_CONFIG,
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  getMaxMarksByCategory,
  type UnitSize,
  getUnitSizeDefinition,
} from "@boundless/shared/config";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { applyDamage } from "../combat/damage.utils";

// =============================================================================
// TIPOS
// =============================================================================

export interface SummonCreationResult {
  success: boolean;
  summon?: BattleUnit;
  error?: string;
  position?: { x: number; y: number };
}

export interface EidolonState {
  /** Bônus acumulado de kills (permanente na partida) */
  killBonus: number;
  /** ID do invocador */
  summonerId: string;
}

// Armazenamento de estado do Eidolon (por partida)
// Chave: matchId_summonerId
const eidolonStates = new Map<string, EidolonState>();

// =============================================================================
// GERENCIAMENTO DE ESTADO DO EIDOLON
// =============================================================================

/**
 * Obtém a chave de estado do Eidolon
 */
function getEidolonStateKey(matchId: string, summonerId: string): string {
  return `${matchId}_${summonerId}`;
}

/**
 * Obtém o estado do Eidolon de um invocador
 */
export function getEidolonState(
  matchId: string,
  summonerId: string
): EidolonState | undefined {
  return eidolonStates.get(getEidolonStateKey(matchId, summonerId));
}

/**
 * Define o estado do Eidolon
 */
export function setEidolonState(
  matchId: string,
  summonerId: string,
  state: EidolonState
): void {
  eidolonStates.set(getEidolonStateKey(matchId, summonerId), state);
}

/**
 * Incrementa o bônus de kill do Eidolon
 */
export function incrementEidolonKillBonus(
  matchId: string,
  summonerId: string
): number {
  const key = getEidolonStateKey(matchId, summonerId);
  const state = eidolonStates.get(key) || { killBonus: 0, summonerId };
  state.killBonus += 1;
  eidolonStates.set(key, state);
  return state.killBonus;
}

/**
 * Reseta o bônus do Eidolon quando ele morre
 */
export function resetEidolonBonus(matchId: string, summonerId: string): void {
  const key = getEidolonStateKey(matchId, summonerId);
  eidolonStates.set(key, { killBonus: 0, summonerId });
}

/**
 * Calcula o tamanho do Eidolon baseado no total de stats
 * A cada 10 pontos de stat total (começa com 15), aumenta 1 categoria
 * - 15 (base) = NORMAL
 * - 25+ = LARGE
 * - 35+ = HUGE
 * - 45+ = GARGANTUAN
 */
export function calculateEidolonSize(totalStats: number): UnitSize {
  if (totalStats >= 45) return "GARGANTUAN";
  if (totalStats >= 35) return "HUGE";
  if (totalStats >= 25) return "LARGE";
  return "NORMAL";
}

/**
 * Obtém o total de stats de uma unidade
 */
export function getTotalStats(unit: BattleUnit): number {
  return (
    unit.combat +
    unit.speed +
    unit.focus +
    unit.resistance +
    unit.will +
    unit.vitality
  );
}

/**
 * Limpa todos os estados de Eidolon de uma partida
 */
export function clearEidolonStatesForMatch(matchId: string): void {
  for (const key of eidolonStates.keys()) {
    if (key.startsWith(`${matchId}_`)) {
      eidolonStates.delete(key);
    }
  }
}

// =============================================================================
// CRIAÇÃO DE INVOCAÇÕES
// =============================================================================

/**
 * Encontra uma posição adjacente livre para invocar
 */
export function findAdjacentFreePosition(
  summoner: BattleUnit,
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number,
  obstacles: Array<{ x: number; y: number }> = []
): { x: number; y: number } | null {
  // Direções adjacentes (8 direções)
  const directions = [
    { dx: 0, dy: -1 }, // cima
    { dx: 1, dy: -1 }, // cima-direita
    { dx: 1, dy: 0 }, // direita
    { dx: 1, dy: 1 }, // baixo-direita
    { dx: 0, dy: 1 }, // baixo
    { dx: -1, dy: 1 }, // baixo-esquerda
    { dx: -1, dy: 0 }, // esquerda
    { dx: -1, dy: -1 }, // cima-esquerda
  ];

  for (const dir of directions) {
    const x = summoner.posX + dir.dx;
    const y = summoner.posY + dir.dy;

    // Verificar limites do grid
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) continue;

    // Verificar se há unidade no local (considerando tamanho)
    let occupied = false;
    for (const u of allUnits) {
      if (!u.isAlive) continue;
      const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
      const dimension = sizeDef.dimension;
      for (let ux = 0; ux < dimension; ux++) {
        for (let uy = 0; uy < dimension; uy++) {
          if (u.posX + ux === x && u.posY + uy === y) {
            occupied = true;
            break;
          }
        }
        if (occupied) break;
      }
      if (occupied) break;
    }
    if (occupied) continue;

    // Verificar obstáculos (já vem como células ocupadas)
    const hasObstacle = obstacles.some((o) => o.x === x && o.y === y);
    if (hasObstacle) continue;

    return { x, y };
  }

  return null;
}

/**
 * Cria um Eidolon para um invocador
 */
export function createEidolon(
  summoner: BattleUnit,
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number,
  matchId: string = "battle",
  obstacles: Array<{ x: number; y: number }> = []
): SummonCreationResult {
  const template = getSummonByCode("EIDOLON");
  if (!template) {
    return { success: false, error: "Template EIDOLON não encontrado" };
  }

  // Encontrar posição adjacente livre
  const position = findAdjacentFreePosition(
    summoner,
    allUnits,
    gridWidth,
    gridHeight,
    obstacles
  );
  if (!position) {
    return { success: false, error: "Sem espaço adjacente para invocar" };
  }

  // Obter bônus acumulado (se houver)
  const state = getEidolonState(matchId, summoner.id);
  const killBonus = state?.killBonus || 0;

  // Criar stats com bônus
  const stats = createSummonStats("EIDOLON", killBonus);
  if (!stats) {
    return { success: false, error: "Falha ao criar stats do Eidolon" };
  }

  // Calcular HP e proteções
  const maxHp = stats.vitality * HP_CONFIG.multiplier;
  const maxPhysicalProtection =
    stats.resistance * PHYSICAL_PROTECTION_CONFIG.multiplier;
  const maxMagicalProtection =
    stats.will * MAGICAL_PROTECTION_CONFIG.multiplier;

  // Calcular tamanho baseado no total de stats
  const totalStats =
    stats.combat +
    stats.speed +
    stats.focus +
    stats.resistance +
    stats.will +
    stats.vitality;
  const initialSize = calculateEidolonSize(totalStats);

  // Extrair ownerKingdomId do summoner (se disponível)
  const summonerAsBattleUnit = summoner as unknown as BattleUnit;
  const ownerKingdomId = summonerAsBattleUnit.ownerKingdomId || "";

  // Criar a unidade do Eidolon como BattleUnit completo
  const eidolon: BattleUnit = {
    id: `eidolon_${summoner.id}_${Date.now()}`,
    sourceUnitId: `eidolon_source_${summoner.id}`,
    ownerId: summoner.ownerId,
    ownerKingdomId,
    name: `Eidolon de ${summoner.name}`,
    avatar: undefined, // TODO: Definir sprite do Eidolon
    category: "SUMMON",
    troopSlot: undefined,
    level: 1,
    race: "EIDOLON",
    classCode: undefined,
    features: template.actionCodes || [], // Skills disponíveis para o Eidolon
    equipment: [],
    spells: [],
    combat: stats.combat,
    speed: stats.speed,
    focus: stats.focus,
    resistance: stats.resistance,
    will: stats.will,
    vitality: stats.vitality,
    damageReduction: stats.damageReduction,
    currentHp: maxHp,
    maxHp,
    currentMana: (stats.will || 0) * MANA_CONFIG.multiplier,
    maxMana: (stats.will || 0) * MANA_CONFIG.multiplier,
    posX: position.x,
    posY: position.y,
    movesLeft: 0,
    actionsLeft: 1,
    attacksLeftThisTurn: 0,
    isAlive: true,
    actionMarks: getMaxMarksByCategory("SUMMON"),
    physicalProtection: maxPhysicalProtection,
    maxPhysicalProtection,
    magicalProtection: maxMagicalProtection,
    maxMagicalProtection,
    conditions: ["EIDOLON_GROWTH"], // Marca como Eidolon
    hasStartedAction: false,
    size: initialSize,
    visionRange: Math.max(10, stats.focus),
    unitCooldowns: {},
    isAIControlled: true, // Summons são controlados por IA
    aiBehavior: template.aiBehavior || "AGGRESSIVE", // Comportamento de IA do template
  };

  // Log de criação

  // Inicializar estado se não existir
  if (!state) {
    setEidolonState(matchId, summoner.id, {
      killBonus: 0,
      summonerId: summoner.id,
    });
  }

  return {
    success: true,
    summon: eidolon,
    position,
  };
}

// =============================================================================
// MECÂNICAS DE PROTEÇÃO DO EIDOLON
// =============================================================================

/**
 * Verifica se o dano deve ser transferido para o Eidolon
 * Retorna o Eidolon se deve transferir, null caso contrário
 */
export function shouldTransferDamageToEidolon(
  target: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit | null {
  // Verificar se o alvo tem a passiva EIDOLON_PROTECTION
  if (!target.conditions.includes("EIDOLON_PROTECTION")) {
    return null;
  }

  // Encontrar o Eidolon do alvo
  const eidolon = allUnits.find(
    (u) =>
      u.ownerId === target.ownerId &&
      u.category === "SUMMON" &&
      u.conditions.includes("EIDOLON_GROWTH") &&
      u.isAlive
  );

  if (!eidolon) return null;

  // Verificar se está adjacente
  if (
    !isAdjacentOmnidirectional(
      target.posX,
      target.posY,
      eidolon.posX,
      eidolon.posY
    )
  ) {
    return null;
  }

  return eidolon;
}

/**
 * Transfere dano para o Eidolon (como dano verdadeiro)
 * Dano verdadeiro ignora proteção e redução de dano
 */
export function transferDamageToEidolon(
  eidolon: BattleUnit,
  damage: number
): { damageDealt: number; eidolonDefeated: boolean } {
  // Usar função centralizada de dano (dano verdadeiro para Eidolon)
  const result = applyDamage(
    eidolon.physicalProtection,
    eidolon.magicalProtection,
    eidolon.currentHp,
    damage,
    "VERDADEIRO"
  );
  eidolon.physicalProtection = result.newPhysicalProtection;
  eidolon.magicalProtection = result.newMagicalProtection;
  eidolon.currentHp = result.newHp;

  const eidolonDefeated = eidolon.currentHp <= 0;
  if (eidolonDefeated) {
    eidolon.isAlive = false;
  }

  return {
    damageDealt: result.damageToHp,
    eidolonDefeated,
  };
}

// =============================================================================
// HOOKS PARA INTEGRAÇÃO COM COMBATE
// =============================================================================

/**
 * Processa morte de uma unidade - verifica se foi morta por um Eidolon
 */
export function processUnitDeathForEidolon(
  killer: BattleUnit | null,
  _victim: BattleUnit,
  matchId: string = "battle"
): { eidolonGrew: boolean; newBonus: number; newSize?: UnitSize } {
  if (!killer) return { eidolonGrew: false, newBonus: 0 };

  // Verificar se o killer é um Eidolon
  if (
    killer.category !== "SUMMON" ||
    !killer.conditions.includes("EIDOLON_GROWTH")
  ) {
    return { eidolonGrew: false, newBonus: 0 };
  }

  // Encontrar o invocador (ownerId do Eidolon)
  const summonerId = killer.ownerId;

  // Incrementar bônus
  const newBonus = incrementEidolonKillBonus(matchId, summonerId);

  // Aplicar stats imediatamente ao Eidolon
  killer.combat += 1;
  killer.speed += 1;
  killer.focus += 1;
  killer.resistance += 1;
  killer.will += 1;
  killer.vitality += 1;
  killer.currentHp += HP_CONFIG.multiplier; // +2 HP por ponto de vitality
  killer.maxPhysicalProtection =
    killer.resistance * PHYSICAL_PROTECTION_CONFIG.multiplier;
  killer.maxMagicalProtection =
    killer.will * MAGICAL_PROTECTION_CONFIG.multiplier;

  // Calcular e aplicar novo tamanho baseado no total de stats
  const totalStats = getTotalStats(killer);
  const oldSize = killer.size;
  const newSize = calculateEidolonSize(totalStats);
  killer.size = newSize;

  if (oldSize !== newSize) {
  }

  return { eidolonGrew: true, newBonus, newSize };
}

/**
 * Processa morte do Eidolon - reseta bônus e tamanho
 */
export function processEidolonDeath(
  eidolon: BattleUnit,
  matchId: string = "battle"
): void {
  if (
    eidolon.category !== "SUMMON" ||
    !eidolon.conditions.includes("EIDOLON_GROWTH")
  ) {
    return;
  }

  // Encontrar o invocador
  const summonerId = eidolon.ownerId;

  // Obter bônus atual para log
  const state = getEidolonState(matchId, summonerId);
  const lostBonus = state?.killBonus || 0;
  const lostSize = eidolon.size;

  // Resetar bônus
  resetEidolonBonus(matchId, summonerId);

  // Resetar tamanho para NORMAL (será aplicado quando reinvocar)
  eidolon.size = "NORMAL";
}

// =============================================================================
// HOOK: PROCESSAR INVOCAÇÕES NO INÍCIO DA BATALHA
// =============================================================================

/**
 * Processa todas as invocações que devem ocorrer no início da batalha
 * Retorna array de unidades invocadas que devem ser adicionadas à batalha
 */
export function processEidolonSummonsOnBattleStart(
  allUnits: BattleUnit[],
  gridWidth: number,
  gridHeight: number,
  obstacles: Array<{ x: number; y: number }> = [],
  matchId: string = "battle"
): BattleUnit[] {
  const summonedUnits: BattleUnit[] = [];

  // Encontrar todas as unidades com a condição EIDOLON_CHARGE
  const summoners = allUnits.filter(
    (u) => u.isAlive && u.conditions.includes("EIDOLON_CHARGE")
  );

  for (const summoner of summoners) {

    // Criar lista de unidades incluindo as já invocadas
    const currentUnits = [...allUnits, ...summonedUnits];

    const result = createEidolon(
      summoner,
      currentUnits,
      gridWidth,
      gridHeight,
      matchId,
      obstacles
    );

    if (result.success && result.summon) {
      summonedUnits.push(result.summon);
    } else {
      console.warn(
        `[EIDOLON] ⚠️ Falha ao invocar Eidolon para ${summoner.name}: ${result.error}`
      );
    }
  }

  return summonedUnits;
}

// =============================================================================
// MORTE DO INVOCADOR - MATA SUAS INVOCAÇÕES
// =============================================================================

/**
 * Encontra todas as invocações de uma unidade
 * Identificação: Eidolons têm ID no formato `eidolon_${summonerId}_timestamp`
 * Ou são SUMMON com mesmo ownerId
 */
export function findSummonsOfUnit(
  summonerUnit: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit[] {
  const summons: BattleUnit[] = [];

  for (const unit of allUnits) {
    if (!unit.isAlive) continue;
    if (unit.id === summonerUnit.id) continue;

    // Verificar se é um Eidolon desta unidade pelo padrão de ID
    if (unit.id.startsWith(`eidolon_${summonerUnit.id}_`)) {
      summons.push(unit);
      continue;
    }

    // Verificar pelo sourceUnitId (outros tipos de summon)
    if (unit.sourceUnitId?.includes(summonerUnit.id)) {
      summons.push(unit);
      continue;
    }
  }

  return summons;
}

/**
 * Processa a morte do invocador - mata todas as suas invocações
 * Deve ser chamado quando uma unidade morre
 * @returns Lista de invocações que foram mortas
 */
export function processSummonerDeath(
  deadUnit: BattleUnit,
  allUnits: BattleUnit[],
  matchId: string = "battle"
): BattleUnit[] {
  // Encontrar todos os summons desta unidade
  const summons = findSummonsOfUnit(deadUnit, allUnits);

  if (summons.length === 0) {
    return [];
  }

  const killedSummons: BattleUnit[] = [];

  for (const summon of summons) {

    // Marcar como morto
    summon.currentHp = 0;
    summon.isAlive = false;

    // Se for Eidolon, processar lógica de morte específica
    if (summon.conditions.includes("EIDOLON_GROWTH")) {
      processEidolonDeath(summon, matchId);
    }

    killedSummons.push(summon);
  }

  return killedSummons;
}
