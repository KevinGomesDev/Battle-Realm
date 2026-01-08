// server/src/modules/abilities/executors/skills/index.ts
// Barrel exports de todos os executores de skills

// === Common Actions ===
export {
  executeAttackSkill,
  executeAttack,
  executeAttackWithQTEModifiers,
  prepareAttackContext,
  executeAttackFromQTEResult,
} from "./attack.skill";
export { executeDash } from "./dash.skill";
export { executeDodge } from "./dodge.skill";

// === Warrior ===
export { executeSecondWind } from "./second-wind.skill";
export { executeActionSurge } from "./action-surge.skill";

// === Barbarian ===
export { executeTotalDestruction } from "./total-destruction.skill";

// === Cleric ===
export { executeHeal } from "./heal.skill";
export { executeBless } from "./bless.skill";
export { executeDivineFavor } from "./divine-favor.skill";
export { executeCureWounds } from "./cure-wounds.skill";
export { executeTurnUndead } from "./turn-undead.skill";
export { executeCelestialExpulsion } from "./celestial-expulsion.skill";

// === Wizard ===
export { executeMagicWeapon } from "./magic-weapon.skill";
export { executeArcaneShield } from "./arcane-shield.skill";

// === Ranger ===
export { executeHuntersMark } from "./hunters-mark.skill";
export { executeVolley } from "./volley.skill";

// === Summoner ===
export { executeEidolonResistance } from "./eidolon-resistance.skill";
