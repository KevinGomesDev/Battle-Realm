// server/src/qte/index.ts
// Barrel exports para o sistema QTE no servidor

// Calculadora de QTE simples
export {
  generateQTEId,
  calculateAttackDirection,
  calculateQTEDuration,
  calculateShakeIntensity,
  calculateHitZoneSize,
  calculateDefenseHitZoneSize,
  calculateBlockedCells,
  generateAttackQTE,
  generateDefenseQTE,
} from "./qte-calculator";

// Processador de respostas
export {
  determineResultGrade,
  calculateZones,
  processAttackQTEResponse,
  processDefenseQTEResponse,
  applyAttackQTEResult,
  applyDefenseQTEResult,
  applyPerfectDodgeBuff,
  applyDodgeMovement,
} from "./qte-processor";

// Manager de QTE simples
export {
  QTEManager,
  createQTEManager,
  type PendingQTE,
  type QTECombatResult,
  type QTECompletionCallback,
  type GetServerTimeFn,
} from "./qte-manager";

// Calculadora de Chain QTE
export {
  generateChainQTEId,
  calculateStepDifficulty,
  calculateStepOffset,
  calculateComboMultiplier,
  generateChainQTE,
  generateChainLightningQTE,
  generateOmnislashQTE,
  generateMeteorShowerDefenseQTE,
  type GenerateChainQTEParams,
} from "./chain-qte-calculator";

// Manager de Chain QTE
export {
  ChainQTEManager,
  createChainQTEManager,
  type PendingChainQTE,
  type ChainQTECompletionCallback,
} from "./chain-qte-manager";
