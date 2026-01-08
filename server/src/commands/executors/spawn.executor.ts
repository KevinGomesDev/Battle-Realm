// server/src/commands/executors/spawn.executor.ts
// Executor do comando /spawn - Cria unidades inimigas aleatórias

import type {
  CommandExecutorFn,
  CommandExecutionContext,
} from "../command-handler";
import type { CommandResult } from "../../../../shared/types/commands.types";
import { BattleUnitSchema } from "../../colyseus/schemas";
import { RACE_DEFINITIONS } from "../../../../shared/data/Templates/RacesTemplates";
import { HERO_CLASSES } from "../../../../shared/data/abilities.data";
import { determineUnitActions } from "../../logic/unit-actions";
import { calculateActiveEffects } from "../../logic/conditions";
import { findAbilityByCode as findSkillByCode } from "../../../../shared/data/abilities.data";
import { getRacePassiveCondition } from "../../../../shared/data/races.data";
import {
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  HP_CONFIG,
  MANA_CONFIG,
  calculateUnitVision,
  getMaxMarksByCategory,
} from "../../../../shared/config/global.config";

/**
 * Gera um ID único para a unidade
 */
function generateUnitId(): string {
  return `spawn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escolhe um elemento aleatório de um array
 */
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gera um número aleatório entre min e max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Encontra uma posição aleatória livre no grid
 */
function findRandomFreePosition(
  context: CommandExecutionContext
): { x: number; y: number } | null {
  const { battleState, gridWidth, gridHeight } = context;

  // Coletar posições ocupadas
  const occupied = new Set<string>();

  battleState.units.forEach((unit) => {
    if (unit.isAlive) {
      occupied.add(`${unit.posX},${unit.posY}`);
    }
  });

  battleState.obstacles.forEach((obs) => {
    if (!obs.destroyed) {
      occupied.add(`${obs.posX},${obs.posY}`);
    }
  });

  // Tentar encontrar posição aleatória livre
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(Math.random() * gridWidth);
    const y = Math.floor(Math.random() * gridHeight);
    const key = `${x},${y}`;

    if (!occupied.has(key)) {
      return { x, y };
    }
  }

  // Fallback: busca sequencial
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Nomes aleatórios para unidades spawned
 */
const SPAWN_NAMES = [
  "Goblin Errante",
  "Esqueleto Antigo",
  "Orc Selvagem",
  "Lobo Sombrio",
  "Bandido Fugitivo",
  "Slime Venenoso",
  "Espectro Perdido",
  "Kobold Astuto",
  "Ghoul Faminto",
  "Harpia Furiosa",
  "Troll Jovem",
  "Elemental Menor",
  "Cultista Demoníaco",
  "Golem de Pedra",
  "Dragãozinho",
];

/**
 * Executor do comando /spawn
 * Cria unidades inimigas aleatórias sem IA vinculada
 */
export const executeSpawnCommand: CommandExecutorFn = (
  context: CommandExecutionContext,
  args: Record<string, number | string | boolean>
): CommandResult => {
  const quantity = typeof args.quantity === "number" ? args.quantity : 1;

  // Validar quantidade
  if (quantity < 1 || quantity > 10) {
    return {
      success: false,
      message: "A quantidade deve estar entre 1 e 10",
    };
  }

  const spawnedUnits: string[] = [];

  for (let i = 0; i < quantity; i++) {
    // Encontrar posição livre
    const position = findRandomFreePosition(context);
    if (!position) {
      return {
        success: false,
        message: `Não há espaço suficiente no grid. Spawned ${spawnedUnits.length}/${quantity}`,
        data: { spawnedUnits },
      };
    }

    // Gerar atributos aleatórios
    const race = randomElement(RACE_DEFINITIONS);
    const heroClass = randomElement(HERO_CLASSES);
    const level = randomBetween(1, 5);

    // Atributos base aleatórios (entre 2 e 6)
    const combat = randomBetween(2, 6);
    const speed = randomBetween(2, 6);
    const focus = randomBetween(2, 6);
    const resistance = randomBetween(2, 6);
    const will = randomBetween(2, 6);
    const vitality = randomBetween(2, 6);

    // Calcular HP e Mana
    const maxHp = vitality * HP_CONFIG.multiplier;
    const maxMana = will * MANA_CONFIG.multiplier;

    // Proteções
    const physicalProtection =
      resistance * PHYSICAL_PROTECTION_CONFIG.multiplier;
    const magicalProtection = will * MAGICAL_PROTECTION_CONFIG.multiplier;

    // Skills: pegar 1-2 skills aleatórias da classe
    const classSkills = heroClass.skills
      .slice(0, randomBetween(1, 2))
      .map((s) => s.code);

    // Determinar ações disponíveis
    const unitFeatures = determineUnitActions(
      {
        combat,
        speed,
        focus,
        resistance,
        will,
        vitality,
        category: "MONSTER",
        features: classSkills,
      },
      { battleType: "arena" }
    );

    // Condições iniciais (passivas de skills e raça)
    const initialConditions: string[] = [];

    for (const skillCode of classSkills) {
      const skill = findSkillByCode(skillCode);
      if (skill && skill.category === "PASSIVE" && skill.conditionApplied) {
        if (!initialConditions.includes(skill.conditionApplied)) {
          initialConditions.push(skill.conditionApplied);
        }
      }
    }

    const raceCondition = getRacePassiveCondition(race.id);
    if (raceCondition && !initialConditions.includes(raceCondition)) {
      initialConditions.push(raceCondition);
    }

    // Criar a unidade
    const unitId = generateUnitId();
    const unitName = randomElement(SPAWN_NAMES);

    const newUnit = new BattleUnitSchema();
    newUnit.id = unitId;
    newUnit.sourceUnitId = `spawn_source_${unitId}`;
    newUnit.ownerId = "SPAWN_SYSTEM";
    newUnit.ownerKingdomId = "SPAWN_SYSTEM";
    newUnit.name = unitName;
    newUnit.avatar = "";
    newUnit.category = "MONSTER";
    newUnit.troopSlot = 0;
    newUnit.level = level;
    newUnit.race = race.id;
    newUnit.classCode = heroClass.code;

    // Atributos
    newUnit.combat = combat;
    newUnit.speed = speed;
    newUnit.focus = focus;
    newUnit.resistance = resistance;
    newUnit.will = will;
    newUnit.vitality = vitality;
    newUnit.damageReduction = 0;

    // HP e Mana
    newUnit.currentHp = maxHp;
    newUnit.maxHp = maxHp;
    newUnit.currentMana = maxMana;
    newUnit.maxMana = maxMana;

    // Proteções
    newUnit.physicalProtection = physicalProtection;
    newUnit.maxPhysicalProtection = physicalProtection;
    newUnit.magicalProtection = magicalProtection;
    newUnit.maxMagicalProtection = magicalProtection;

    // Posição
    newUnit.posX = position.x;
    newUnit.posY = position.y;

    // Estado de turno
    newUnit.movesLeft = speed;
    newUnit.actionsLeft = 1;
    newUnit.attacksLeftThisTurn = 0;
    newUnit.isAlive = true;
    newUnit.hasStartedAction = false;
    newUnit.actionMarks = getMaxMarksByCategory("MONSTER");

    // Features, conditions, spells
    newUnit.features.push(...unitFeatures);
    newUnit.conditions.push(...initialConditions);
    newUnit.spells.clear();

    // Outros
    newUnit.size = "NORMAL";
    newUnit.visionRange = calculateUnitVision(focus);
    newUnit.isAIControlled = false; // Sem IA vinculada como solicitado

    // Calcular efeitos ativos
    const activeEffects = calculateActiveEffects(initialConditions);
    // Os activeEffects são calculados dinamicamente pelo state

    // Adicionar ao estado da batalha
    context.battleState.units.set(unitId, newUnit);
    spawnedUnits.push(unitName);
  }

  return {
    success: true,
    message: `✨ Spawned ${spawnedUnits.length} unidade(s): ${spawnedUnits.join(
      ", "
    )}`,
    data: {
      spawnedUnits,
      quantity: spawnedUnits.length,
    },
  };
};
