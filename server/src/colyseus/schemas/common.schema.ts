// server/src/colyseus/schemas/common.schema.ts
// Schemas comuns reutilizáveis em várias rooms

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * Posição no grid
 */
export class Position extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

/**
 * Efeito ativo em uma unidade
 * Corresponde ao tipo ActiveEffect em shared/types/conditions.types.ts
 */
export class ActiveEffectSchema extends Schema {
  /** Chave do efeito (ex: "extraAttacks", "bonusDamage") */
  @type("string") key: string = "";
  /** Valor numérico ou booleano (serializado como string) */
  @type("string") value: string = "";
  /** IDs das condições que contribuem para este efeito (JSON array) */
  @type("string") sources: string = "[]";
}

/**
 * Mapa de efeitos ativos por ID
 */
export class ActiveEffectsMap extends Schema {
  @type({ map: ActiveEffectSchema }) effects =
    new MapSchema<ActiveEffectSchema>();
}

/**
 * Recursos de um jogador
 */
export class PlayerResources extends Schema {
  @type("number") ore: number = 0;
  @type("number") supplies: number = 0;
  @type("number") arcane: number = 0;
  @type("number") experience: number = 0;
  @type("number") devotion: number = 0;
}

/**
 * Obstáculo no grid de batalha
 * Usa sistema visual 2.5D com tipos
 */
export class BattleObstacleSchema extends Schema {
  @type("string") id: string = "";
  @type("number") posX: number = 0;
  @type("number") posY: number = 0;
  /** Tipo do obstáculo para renderização 2.5D */
  @type("string") type: string = "ROCK";
  /** @deprecated Use 'type' - mantido apenas para compatibilidade */
  @type("string") emoji: string = "";
  @type("number") hp: number = 5;
  @type("number") maxHp: number = 5;
  @type("boolean") destroyed: boolean = false;
}

/**
 * Configuração do mapa de batalha
 */
export class BattleMapConfigSchema extends Schema {
  @type("string") terrainType: string = "PLAINS";
  @type("string") territorySize: string = "MEDIUM";
  @type([BattleObstacleSchema]) obstacles =
    new ArraySchema<BattleObstacleSchema>();
}

/**
 * Configuração de arena
 */
export class ArenaConfigSchema extends Schema {
  @type(BattleMapConfigSchema) map = new BattleMapConfigSchema();
  @type("string") weather: string = "CLEAR";
  @type("number") timeOfDay: number = 12;
}

/**
 * Log de batalha
 */
export class BattleLogEntry extends Schema {
  @type("number") timestamp: number = 0;
  @type("string") type: string = "";
  @type("string") message: string = "";
  @type("string") actorId: string = "";
  @type("string") targetId: string = "";
  @type("number") value: number = 0;
}
