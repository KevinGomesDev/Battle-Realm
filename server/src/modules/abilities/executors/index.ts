// server/src/modules/abilities/executors/index.ts
// Barrel exports dos executors de abilities (UNIFICADO)

// Tipos
export * from "./types";

// Helpers
export * from "./helpers";

// Registry unificado
export * from "./registry";

// Executor unificado (principal)
export * from "./ability-executors";

// Re-exports individuais para compatibilidade
export * from "./skills";
export * from "./spells";
