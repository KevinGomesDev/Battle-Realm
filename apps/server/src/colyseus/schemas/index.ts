// server/src/colyseus/schemas/index.ts
// Export de todos os schemas

// Common
export * from "./common.schema";

// Battle Unit
export * from "../../modules/battle/colyseus/schemas/battle-unit.schema";

// Battle (Lobby + Battle)
export * from "../../modules/battle/colyseus/schemas/battle.schema";

// Match (Strategic Map)
export * from "../../modules/match/colyseus/schemas/match.schema";
