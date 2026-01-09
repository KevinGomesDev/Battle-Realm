// utils.ts - Utilitários para handlers do BattleRoom
import type {
  BattleUnitSchema,
  BattleObstacleSchema,
  BattleSessionState,
} from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { AttackActionResult } from "../../../../abilities/executors/types";
import {
  getUnitSizeDefinition,
  getObstacleDimension,
  type UnitSize,
  type ObstacleSize,
} from "@boundless/shared/config";

/**
 * Converte um BattleUnitSchema para BattleUnit (tipos simples)
 */
export function schemaUnitToBattleUnit(schema: BattleUnitSchema): BattleUnit {
  return {
    id: schema.id,
    sourceUnitId: schema.sourceUnitId,
    ownerId: schema.ownerId,
    ownerKingdomId: schema.ownerKingdomId,
    name: schema.name,
    avatar: schema.avatar,
    category: schema.category,
    troopSlot: schema.troopSlot,
    level: schema.level,
    race: schema.race,
    classCode: schema.classCode,
    features: Array.from(schema.features).filter(
      (f): f is string => f !== undefined
    ),
    equipment: Array.from(schema.equipment).filter(
      (e): e is string => e !== undefined
    ),
    combat: schema.combat,
    speed: schema.speed,
    focus: schema.focus,
    resistance: schema.resistance,
    will: schema.will,
    vitality: schema.vitality,
    damageReduction: schema.damageReduction,
    currentHp: schema.currentHp,
    maxHp: schema.maxHp,
    currentMana: schema.currentMana,
    maxMana: schema.maxMana,
    posX: schema.posX,
    posY: schema.posY,
    movesLeft: schema.movesLeft,
    actionsLeft: schema.actionsLeft,
    attacksLeftThisTurn: schema.attacksLeftThisTurn,
    isAlive: schema.isAlive,
    actionMarks: schema.actionMarks,
    physicalProtection: schema.physicalProtection,
    maxPhysicalProtection: schema.maxPhysicalProtection,
    magicalProtection: schema.magicalProtection,
    maxMagicalProtection: schema.maxMagicalProtection,
    conditions: Array.from(schema.conditions).filter(
      (c): c is string => c !== undefined
    ),
    spells: Array.from(schema.spells).filter(
      (s): s is string => s !== undefined
    ),
    hasStartedAction: schema.hasStartedAction,
    grabbedByUnitId: schema.grabbedByUnitId || undefined,
    size: schema.size as BattleUnit["size"],
    visionRange: schema.visionRange,
    unitCooldowns: Object.fromEntries(schema.unitCooldowns.entries()),
    isAIControlled: schema.isAIControlled,
    aiBehavior: schema.aiBehavior as BattleUnit["aiBehavior"],
  };
}

/**
 * Converte todas as unidades do state para BattleUnit[]
 */
export function getAllUnitsAsBattleUnits(
  state: BattleSessionState
): BattleUnit[] {
  const units: BattleUnit[] = [];
  state.units.forEach((schema) => {
    units.push(schemaUnitToBattleUnit(schema));
  });
  return units;
}

/**
 * Verifica se uma posição é válida no grid
 */
export function isValidPosition(
  state: BattleSessionState,
  x: number,
  y: number
): boolean {
  // Verificar limites do grid
  if (x < 0 || x >= state.gridWidth || y < 0 || y >= state.gridHeight) {
    return false;
  }

  // Verificar obstáculos (considerando tamanho)
  for (const obs of state.obstacles) {
    if (obs.destroyed) continue;

    const dimension = getObstacleDimension(obs.size as ObstacleSize);
    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (obs.posX + dx === x && obs.posY + dy === y) {
          return false;
        }
      }
    }
  }

  // Verificar outras unidades (considerando tamanho)
  let occupied = false;
  state.units.forEach((unit) => {
    if (!unit.isAlive) return;

    const sizeDef = getUnitSizeDefinition(unit.size as UnitSize);
    const dimension = sizeDef.dimension;
    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (unit.posX + dx === x && unit.posY + dy === y) {
          occupied = true;
          return;
        }
      }
    }
  });

  return !occupied;
}

/**
 * Verifica se a unidade tem recursos para atacar (sem consumir)
 */
export function canAttack(attacker: BattleUnitSchema): boolean {
  return attacker.attacksLeftThisTurn > 0 || attacker.actionsLeft > 0;
}

/**
 * Consome recurso de ataque (para casos especiais como ataque no ar)
 */
export function consumeAttackResource(attacker: BattleUnitSchema): void {
  if (attacker.attacksLeftThisTurn > 0) {
    attacker.attacksLeftThisTurn--;
  } else if (attacker.actionsLeft > 0) {
    attacker.actionsLeft--;
  }
}

/**
 * Sincroniza resultado do ataque de volta para os schemas Colyseus
 */
export function syncAttackResultToSchemas(
  attackerSchema: BattleUnitSchema,
  targetSchema: BattleUnitSchema,
  attackerUnit: BattleUnit,
  targetUnit: BattleUnit,
  allUnits: BattleUnit[],
  result: AttackActionResult,
  state: BattleSessionState
): void {
  // Sincronizar recursos de ataque consumidos pelo executor
  attackerSchema.actionsLeft = attackerUnit.actionsLeft;
  attackerSchema.attacksLeftThisTurn = attackerUnit.attacksLeftThisTurn;

  // Sincronizar condições do atacante
  attackerSchema.conditions.clear();
  attackerUnit.conditions.forEach((c) => attackerSchema.conditions.push(c));
  attackerSchema.syncActiveEffects();

  // Sincronizar alvo
  targetSchema.currentHp = targetUnit.currentHp;
  targetSchema.physicalProtection = targetUnit.physicalProtection;
  targetSchema.magicalProtection = targetUnit.magicalProtection;
  targetSchema.isAlive = targetUnit.isAlive;
  targetSchema.conditions.clear();
  targetUnit.conditions.forEach((c) => targetSchema.conditions.push(c));
  targetSchema.syncActiveEffects();

  // Se houve transferência para Eidolon, sincronizar Eidolon
  if (result.damageTransferredToEidolon) {
    const eidolon = allUnits.find(
      (u) =>
        u.ownerId === targetUnit.ownerId &&
        u.category === "SUMMON" &&
        u.conditions.includes("EIDOLON_GROWTH")
    );
    if (eidolon) {
      const eidolonSchema = state.units.get(eidolon.id);
      if (eidolonSchema) {
        eidolonSchema.currentHp = eidolon.currentHp;
        eidolonSchema.isAlive = eidolon.isAlive;
      }
    }
  }

  // Sincronizar summons mortos
  if (result.killedSummonIds && result.killedSummonIds.length > 0) {
    for (const summonId of result.killedSummonIds) {
      const summonSchema = state.units.get(summonId);
      if (summonSchema) {
        summonSchema.isAlive = false;
        summonSchema.currentHp = 0;
      }
    }
  }
}

/**
 * Sincroniza mudanças do resultado da execução de volta para o schema
 */
export function syncUnitFromResult(
  schema: BattleUnitSchema,
  unit: BattleUnit,
  result: {
    casterActionsLeft?: number;
    targetHpAfter?: number;
    targetDefeated?: boolean;
    unitsMoved?: Array<{
      unitId: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }>;
  }
): void {
  // Sincronizar ações restantes
  if (result.casterActionsLeft !== undefined) {
    schema.actionsLeft = result.casterActionsLeft;
  }

  // Sincronizar posição (para TELEPORT e outras habilidades de movimento)
  if (result.unitsMoved) {
    const movedUnit = result.unitsMoved.find((m) => m.unitId === schema.id);
    if (movedUnit) {
      schema.posX = movedUnit.to.x;
      schema.posY = movedUnit.to.y;
    }
  }

  // Sincronizar movimento (pode ter sido alterado por DASH, etc)
  schema.movesLeft = unit.movesLeft;

  // Sincronizar HP
  schema.currentHp = unit.currentHp;
  schema.currentMana = unit.currentMana;

  // Sincronizar cooldowns
  if (unit.unitCooldowns) {
    for (const [code, value] of Object.entries(unit.unitCooldowns)) {
      schema.unitCooldowns.set(code, value);
    }
  }

  // Sincronizar condições
  schema.conditions.clear();
  for (const cond of unit.conditions) {
    schema.conditions.push(cond);
  }
  schema.syncActiveEffects();

  // Verificar morte
  if (unit.currentHp <= 0 && schema.isAlive) {
    schema.isAlive = false;
  }
}

/**
 * Serializa a configuração do mapa para envio ao cliente
 */
export function serializeConfig(state: BattleSessionState): object {
  return {
    map: {
      terrainType: state.config.map.terrainType,
      territorySize: state.config.map.territorySize,
      obstacles: Array.from(state.obstacles)
        .filter((o): o is NonNullable<typeof o> => o !== undefined)
        .map((o) => ({
          id: o.id,
          posX: o.posX,
          posY: o.posY,
          emoji: o.emoji,
          hp: o.hp,
          maxHp: o.maxHp,
        })),
    },
    weather: state.config.weather,
    timeOfDay: state.config.timeOfDay,
  };
}

/**
 * Retorna informações dos jogadores para envio ao cliente
 */
export function getPlayersInfo(state: BattleSessionState): object[] {
  return state.players.map((p) => ({
    oderId: p.oderId,
    username: p.username,
    kingdomName: p.kingdomName,
    playerIndex: p.playerIndex,
    playerColor: p.playerColor,
  }));
}

/**
 * Serializa o estado completo da batalha para envio ao cliente
 * Usado em reconexão e início de batalha
 */
export function serializeFullState(state: BattleSessionState): object {
  const serializedState = {
    battleId: state.battleId,
    lobbyId: state.lobbyId,
    matchId: state.matchId,
    isBattle: state.isBattle,
    maxPlayers: state.maxPlayers,
    status: state.status,
    round: state.round,
    currentTurnIndex: state.currentTurnIndex,
    activeUnitId: state.activeUnitId,
    selectedUnitId: state.selectedUnitId,
    currentPlayerId: state.currentPlayerId,
    unitLocked: state.unitLocked,
    turnTimer: state.turnTimer,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    winnerId: state.winnerId || "",
    winReason: state.winReason || "",
    rematchRequests: Array.from(state.rematchRequests),
    players: state.players.map((p) => ({
      oderId: p.oderId,
      kingdomId: p.kingdomId,
      kingdomName: p.kingdomName,
      username: p.username,
      playerIndex: p.playerIndex,
      playerColor: p.playerColor,
      isConnected: p.isConnected,
      surrendered: p.surrendered,
    })),
    actionOrder: Array.from(state.actionOrder),
    units: {} as Record<string, object>,
    obstacles: state.obstacles.map((o) => ({
      id: o.id,
      posX: o.posX,
      posY: o.posY,
      type: o.type,
      hp: o.hp,
      maxHp: o.maxHp,
      destroyed: o.destroyed,
    })),
    config: serializeConfig(state),
  };

  // Serializar unidades
  state.units.forEach((unit, id) => {
    serializedState.units[id] = {
      id: unit.id,
      sourceUnitId: unit.sourceUnitId,
      name: unit.name,
      ownerId: unit.ownerId,
      ownerKingdomId: unit.ownerKingdomId,
      posX: unit.posX,
      posY: unit.posY,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      currentMana: unit.currentMana,
      maxMana: unit.maxMana,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      attacksLeftThisTurn: unit.attacksLeftThisTurn,
      combat: unit.combat,
      speed: unit.speed,
      focus: unit.focus,
      resistance: unit.resistance,
      will: unit.will,
      vitality: unit.vitality,
      damageReduction: unit.damageReduction,
      race: unit.race,
      classCode: unit.classCode,
      category: unit.category,
      level: unit.level,
      avatar: unit.avatar,
      features: Array.from(unit.features),
      equipment: Array.from(unit.equipment),
      hasStartedAction: unit.hasStartedAction,
      size: unit.size,
      spells: Array.from(unit.spells),
      conditions: Array.from(unit.conditions),
      isAlive: unit.isAlive,
      actionMarks: unit.actionMarks,
      physicalProtection: unit.physicalProtection,
      maxPhysicalProtection: unit.maxPhysicalProtection,
      magicalProtection: unit.magicalProtection,
      maxMagicalProtection: unit.maxMagicalProtection,
      visionRange: unit.visionRange,
      isAIControlled: unit.isAIControlled,
      aiBehavior: unit.aiBehavior,
      unitCooldowns: Object.fromEntries(unit.unitCooldowns.entries()),
    };
  });

  return serializedState;
}
