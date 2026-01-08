// server/src/ai/core/index.ts
// Barrel export para core

export * from "./pathfinding";
export * from "./target-selection";
export * from "./ability-evaluator";
export * from "./decision-maker";
export * from "./ai-controller";
export * from "./action-executor";

// NOTA: skill-evaluator e spell-evaluator mantidos para compatibilidade
// mas não re-exportados aqui para evitar duplicação
// Use ability-evaluator para novas implementações
