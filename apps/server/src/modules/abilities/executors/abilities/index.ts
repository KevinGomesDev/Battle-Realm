// server/src/modules/abilities/executors/abilities/index.ts
// Barrel exports de todos os executores de abilities (unificado)

// === Common Actions ===
export { executeAttackSkill, executeAttack } from "./attack.executor";
export { executeDash } from "./dash.executor";

// === Warrior ===
export { executeSecondWind } from "./second-wind.executor";
export { executeActionSurge } from "./action-surge.executor";

// === Barbarian ===
export { executeTotalDestruction } from "./total-destruction.executor";

// === Cleric ===
export { executeHeal } from "./heal.executor";
export { executeBless } from "./bless.executor";
export { executeDivineFavor } from "./divine-favor.executor";
export { executeCureWounds } from "./cure-wounds.executor";
export { executeTurnUndead } from "./turn-undead.executor";
export { executeCelestialExpulsion } from "./celestial-expulsion.executor";

// === Wizard ===
export { executeMagicWeapon } from "./magic-weapon.executor";
export { executeArcaneShield } from "./arcane-shield.executor";
export { executeFire } from "./fire.executor";
export { executeTeleport } from "./teleport.executor";

// === Ranger ===
export { executeHuntersMark } from "./hunters-mark.executor";
export { executeVolley } from "./volley.executor";

// === Summoner ===
export { executeEidolonResistance } from "./eidolon-resistance.executor";
export { executeEmpower } from "./empower.executor";
