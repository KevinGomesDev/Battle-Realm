// server/src/modules/nemesis/index.ts
// Barrel exports do módulo Nemesis

// Serviço principal
export { nemesisService, NemesisServiceImpl } from "./nemesis.service";
export type { NemesisService } from "./nemesis.service";

// Gerador de identidade
export {
  generateNemesisName,
  generateTitle,
  generateInitialTraits,
  generateBaseName,
  generatePrefix,
  generateSuffix,
  determineFearFromDamage,
  determineStrengthFromSurvival,
  determineScarFromDamage,
  determineRank,
  calculateInitialPowerLevel,
  calculatePowerGain,
  selectTaunt,
  formatTaunt,
  areTraitsCompatible,
  filterCompatibleTraits,
  generateId,
} from "./nemesis.generator";
export type {
  GeneratedName,
  TitleGeneratorInput,
  TauntSelectionContext,
} from "./nemesis.generator";

// Memória e armazenamento
export {
  saveNemesis,
  getNemesisById,
  getNemesesByPlayer,
  queryNemeses,
  countActiveNemeses,
  canHaveMoreNemeses,
  killNemesis,
  activateNemesis,
  deactivateNemesis,
  toNemesisSummary,
  analyzeEncounter,
  createEncounter,
  applyEncounterConsequences,
  cleanupInactiveNemeses,
  clearAllNemeses,
  getStoreStats,
} from "./nemesis.memory";
export type { EncounterAnalysis } from "./nemesis.memory";

// Configuração
export {
  NEMESIS_CONFIG,
  NEMESIS_RANKS,
  NEMESIS_TAUNTS,
} from "./nemesis.config";
