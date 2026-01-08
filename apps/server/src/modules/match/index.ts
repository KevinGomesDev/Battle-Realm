// server/src/modules/match/index.ts
// Barrel exports do módulo de match (PARTIDAS)
// NOTA: Este módulo será revisado posteriormente

// Colyseus
export * from "./colyseus/rooms/MatchRoom";
export * from "./colyseus/schemas/match.schema";

// Services
export * from "./services/battle-persistence.service";
export * from "./services/event.service";

// Commands
export * from "./commands";

// Utils
export * from "./turn.utils";
export * from "./conquest.utils";
export * from "./construction.utils";
export * from "./crisis.utils";
export * from "./movement.utils";
