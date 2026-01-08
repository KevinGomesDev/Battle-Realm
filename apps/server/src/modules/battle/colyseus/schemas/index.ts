// server/src/modules/battle/colyseus/schemas/index.ts
// Barrel exports dos schemas de battle

export * from "./battle.schema";
export * from "./battle-unit.schema";

// Re-export schemas comuns usados nas rooms
export {
  BattleObstacleSchema,
  BattleConfigSchema,
  BattleMapConfigSchema,
  BattleLogEntry,
  PlayerResources,
} from "../../../../colyseus/schemas/common.schema";
