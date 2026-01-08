// shared/data/index.ts
// Barrel export para dados compartilhados

// === SISTEMA UNIFICADO DE ABILITIES ===
// Fonte de verdade para skills e spells
export * from "./abilities.data";

// === OUTROS DADOS ===
export * from "./races.data";
// export * from "./classes.data"; // Agora em abilities.data
export * from "./units.data";
export * from "./heroes.data";
export * from "./regents.data";
export * from "./conditions.data";
export * from "./terrains.data";
export * from "./alignments.data";
export * from "./archetypes.data";
export * from "./events.data";
export * from "./kingdoms.data";
export * from "./structures.data";
export * from "./summons.data";
export * from "./turns.data";
export * from "./crisis.data";
export * from "./effect-metadata.data";
export * from "./sounds.data";

// @deprecated - Estes módulos são wrappers de compatibilidade
// Skills e Spells agora estão unificados em abilities.data.ts
// export * from "./skills.data"; // Use abilities.data
// export * from "./spells.data"; // Use abilities.data
