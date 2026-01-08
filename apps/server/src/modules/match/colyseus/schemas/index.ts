// server/src/modules/match/colyseus/schemas/index.ts
// Barrel exports dos schemas de match

export * from "./match.schema";

// Re-export schemas comuns usados nas rooms
export { PlayerResources } from "../../../../colyseus/schemas/common.schema";
