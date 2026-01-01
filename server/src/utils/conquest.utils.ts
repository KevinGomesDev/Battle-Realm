// src/utils/conquest.utils.ts

import { EVENTS, EventDef } from "../data/events";
import { rollD6Test, AdvantageMod } from "../logic/dice-system";
import {
  ALL_ATTRIBUTE_KEYS,
  AttributeKey,
} from "../../../shared/config/global.config";

// Attributes usable for conquest tests (usa config global)
export const CONQUEST_ATTRIBUTES = ALL_ATTRIBUTE_KEYS;
export type ConquestAttribute = AttributeKey;

// Check if event triggers (sucesso = 4+ em 1D6)
export function rollEventTrigger(): { roll: number; triggered: boolean } {
  const result = rollD6Test(1, 0);
  return { roll: result.allRolls[0], triggered: result.success };
}

// Pick N random unique attributes
export function pickRandomAttributes(count: number): ConquestAttribute[] {
  const shuffled = [...CONQUEST_ATTRIBUTES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, CONQUEST_ATTRIBUTES.length));
}

// Pick a random event
export function pickRandomEvent(): EventDef {
  const idx = Math.floor(Math.random() * EVENTS.length);
  return EVENTS[idx];
}

// Attribute test result
export interface AttributeTestResult {
  attribute: ConquestAttribute;
  rolls: number[];
  attributeValue: number;
  successes: number;
  threshold: number;
  success: boolean;
}

/**
 * Perform a single attribute test usando o novo sistema D6
 * Rola N dados (onde N = attributeValue), conta sucessos
 * Sucesso se tiver pelo menos 1 sucesso
 */
export function testAttribute(
  attributeValue: number,
  attribute: ConquestAttribute,
  advantageMod: AdvantageMod = 0
): AttributeTestResult {
  const result = rollD6Test(attributeValue, advantageMod);
  return {
    attribute,
    rolls: result.allRolls,
    attributeValue,
    successes: result.totalSuccesses,
    threshold: result.successThreshold,
    success: result.success,
  };
}

// Full conquest event result
export interface ConquestEventResult {
  eventTriggered: boolean;
  eventTriggerRoll: number;
  event: EventDef | null;
  attributeTests: AttributeTestResult[];
  overallSuccess: boolean;
  crisisIncrease: number;
}

// Process conquest event flow
// attributes: object with attribute name -> value (from the Hero/Regent leading the conquest)
export function processConquestEvent(
  unitAttributes: Record<ConquestAttribute, number>
): ConquestEventResult {
  // Step 1: Roll to check if event triggers (4+)
  const { roll: eventTriggerRoll, triggered: eventTriggered } =
    rollEventTrigger();

  if (!eventTriggered) {
    return {
      eventTriggered: false,
      eventTriggerRoll,
      event: null,
      attributeTests: [],
      overallSuccess: true, // No event = auto success for conquest
      crisisIncrease: 0,
    };
  }

  // Step 2: Pick random event
  const event = pickRandomEvent();

  // Step 3: Pick 3 random attributes and test them
  const randomAttrs = pickRandomAttributes(3);
  // Sistema D6: cada atributo rola N dados, conta sucessos (4+)
  // Sucesso se tiver pelo menos 1 sucesso na rolagem

  const attributeTests: AttributeTestResult[] = randomAttrs.map(
    (attr) => testAttribute(unitAttributes[attr], attr, 0) // 0 = sem vantagem/desvantagem
  );

  // Count successes
  const successCount = attributeTests.filter((t) => t.success).length;
  const failureCount = attributeTests.length - successCount;

  // Overall success = at least one success? Or majority?
  // Based on rules: "Sucesso aplica efeito, falha aumenta Medidor de Crise"
  // Interpreting: if any test fails, crisis increases by failure count
  const overallSuccess = failureCount === 0;
  const crisisIncrease = failureCount;

  return {
    eventTriggered: true,
    eventTriggerRoll,
    event,
    attributeTests,
    overallSuccess,
    crisisIncrease,
  };
}

// Calculate conquest cost (based on current territory count)
// Cost = number of territories already owned (in ore)
export function calculateConquestCost(currentTerritoryCount: number): number {
  // Minimum 1 ore, or current count
  return Math.max(1, currentTerritoryCount);
}

// Validation result
export interface ConquestValidation {
  valid: boolean;
  reason?: string;
  unitCount?: number;
  hasLeader?: boolean;
  cost?: number;
}

// Validate conquest requirements
export function validateConquestRequirements(
  unitCount: number,
  hasHeroOrRegent: boolean,
  playerResources: { ore: number },
  cost: number
): ConquestValidation {
  // Must have 3+ units in territory
  if (unitCount < 3) {
    return {
      valid: false,
      reason:
        "É necessário pelo menos 3 unidades no território para conquistá-lo.",
      unitCount,
      hasLeader: hasHeroOrRegent,
    };
  }

  // Must have Hero or Regent present
  if (!hasHeroOrRegent) {
    return {
      valid: false,
      reason:
        "É necessário um Herói ou Regente presente para liderar a conquista.",
      unitCount,
      hasLeader: hasHeroOrRegent,
    };
  }

  // Must have enough ore
  if (playerResources.ore < cost) {
    return {
      valid: false,
      reason: `Ore insufficient. Cost: ${cost}, available: ${playerResources.ore}.`,
      unitCount,
      hasLeader: hasHeroOrRegent,
      cost,
    };
  }

  return {
    valid: true,
    unitCount,
    hasLeader: hasHeroOrRegent,
    cost,
  };
}
