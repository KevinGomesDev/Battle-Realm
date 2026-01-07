// server/src/colyseus/schemas/battle-unit.schema.ts
// Schema para unidades de batalha - sincronizado automaticamente com clientes

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { ActiveEffectSchema } from "./common.schema";
import type { BattleUnit } from "../../../../shared/types/battle.types";
import type { ActiveEffect } from "../../../../shared/types/conditions.types";

/**
 * Cooldowns de habilidades da unidade
 */
export class UnitCooldownsSchema extends Schema {
  @type({ map: "number" }) cooldowns = new MapSchema<number>();
}

/**
 * Unidade de batalha - sincronizado em tempo real
 */
export class BattleUnitSchema extends Schema {
  @type("string") id: string = "";
  @type("string") sourceUnitId: string = "";
  @type("string") ownerId: string = "";
  @type("string") ownerKingdomId: string = "";
  @type("string") name: string = "";
  @type("string") avatar: string = "";
  @type("string") category: string = "";
  @type("number") troopSlot: number = -1;
  @type("number") level: number = 1;
  @type("string") race: string = "";
  @type("string") classCode: string = "";

  // Skills e equipment como arrays de strings
  @type(["string"]) features = new ArraySchema<string>();
  @type(["string"]) equipment = new ArraySchema<string>();

  // Atributos
  @type("number") combat: number = 0;
  @type("number") speed: number = 0;
  @type("number") focus: number = 0;
  @type("number") resistance: number = 0;
  @type("number") will: number = 0;
  @type("number") vitality: number = 0;
  @type("number") damageReduction: number = 0;

  // HP e Mana
  @type("number") currentHp: number = 0;
  @type("number") maxHp: number = 0;
  @type("number") currentMana: number = 0;
  @type("number") maxMana: number = 0;

  // Posição
  @type("number") posX: number = 0;
  @type("number") posY: number = 0;

  // Ações e movimento
  @type("number") movesLeft: number = 0;
  @type("number") actionsLeft: number = 0;
  @type("number") attacksLeftThisTurn: number = 0;
  @type("boolean") isAlive: boolean = true;
  @type("number") actionMarks: number = 0;

  // Proteções
  @type("number") physicalProtection: number = 0;
  @type("number") maxPhysicalProtection: number = 0;
  @type("number") magicalProtection: number = 0;
  @type("number") maxMagicalProtection: number = 0;

  // Condições e spells
  @type(["string"]) conditions = new ArraySchema<string>();
  @type(["string"]) spells = new ArraySchema<string>();

  // Estado
  @type("boolean") hasStartedAction: boolean = false;
  @type("string") grabbedByUnitId: string = "";
  @type("string") size: string = "MEDIUM";
  @type("number") visionRange: number = 5;
  @type("boolean") isAIControlled: boolean = false;
  @type("string") aiBehavior: string = "AGGRESSIVE";

  // Cooldowns como mapa
  @type({ map: "number" }) unitCooldowns = new MapSchema<number>();

  // Efeitos ativos (JSON serializado para cada efeito)
  @type({ map: ActiveEffectSchema }) activeEffects =
    new MapSchema<ActiveEffectSchema>();

  /**
   * Cria um BattleUnitSchema a partir de um BattleUnit plain object
   */
  static fromBattleUnit(unit: BattleUnit): BattleUnitSchema {
    const schema = new BattleUnitSchema();

    schema.id = unit.id;
    schema.sourceUnitId = unit.sourceUnitId;
    schema.ownerId = unit.ownerId;
    schema.ownerKingdomId = unit.ownerKingdomId;
    schema.name = unit.name;
    schema.avatar = unit.avatar || "";
    schema.category = unit.category;
    schema.troopSlot = unit.troopSlot ?? -1;
    schema.level = unit.level;
    schema.race = unit.race;
    schema.classCode = unit.classCode || "";

    // Arrays
    unit.features.forEach((f) => schema.features.push(f));
    unit.equipment.forEach((e) => schema.equipment.push(e));

    // Atributos
    schema.combat = unit.combat;
    schema.speed = unit.speed;
    schema.focus = unit.focus;
    schema.resistance = unit.resistance;
    schema.will = unit.will;
    schema.vitality = unit.vitality;
    schema.damageReduction = unit.damageReduction;

    // HP e Mana
    schema.currentHp = unit.currentHp;
    schema.maxHp = unit.maxHp;
    schema.currentMana = unit.currentMana;
    schema.maxMana = unit.maxMana;

    // Posição
    schema.posX = unit.posX;
    schema.posY = unit.posY;

    // Ações
    schema.movesLeft = unit.movesLeft;
    schema.actionsLeft = unit.actionsLeft;
    schema.attacksLeftThisTurn = unit.attacksLeftThisTurn;
    schema.isAlive = unit.isAlive;
    schema.actionMarks = unit.actionMarks;

    // Proteções
    schema.physicalProtection = unit.physicalProtection;
    schema.maxPhysicalProtection = unit.maxPhysicalProtection;
    schema.magicalProtection = unit.magicalProtection;
    schema.maxMagicalProtection = unit.maxMagicalProtection;

    // Condições e spells
    unit.conditions.forEach((c) => schema.conditions.push(c));
    unit.spells.forEach((s) => schema.spells.push(s));

    // Estado
    schema.hasStartedAction = unit.hasStartedAction;
    schema.grabbedByUnitId = unit.grabbedByUnitId || "";
    schema.size = unit.size;
    schema.visionRange = unit.visionRange;
    schema.isAIControlled = unit.isAIControlled;
    schema.aiBehavior = unit.aiBehavior || "AGGRESSIVE";

    // Cooldowns
    if (unit.unitCooldowns) {
      Object.entries(unit.unitCooldowns).forEach(([key, value]) => {
        schema.unitCooldowns.set(key, value);
      });
    }

    // Efeitos ativos (converter do formato ActiveEffectsMap para schema)
    if (unit.activeEffects) {
      Object.entries(unit.activeEffects).forEach(([key, effect]) => {
        if (effect) {
          const effectSchema = new ActiveEffectSchema();
          effectSchema.key = effect.key || key;
          effectSchema.value = String(effect.value);
          effectSchema.sources = JSON.stringify(effect.sources || []);
          schema.activeEffects.set(key, effectSchema);
        }
      });
    }

    return schema;
  }

  /**
   * Converte de volta para BattleUnit plain object
   */
  toBattleUnit(): BattleUnit {
    const cooldowns: Record<string, number> = {};
    this.unitCooldowns.forEach((value: number, key: string) => {
      cooldowns[key] = value;
    });

    return {
      id: this.id,
      sourceUnitId: this.sourceUnitId,
      ownerId: this.ownerId,
      ownerKingdomId: this.ownerKingdomId,
      name: this.name,
      avatar: this.avatar || undefined,
      category: this.category,
      troopSlot: this.troopSlot >= 0 ? this.troopSlot : undefined,
      level: this.level,
      race: this.race,
      classCode: this.classCode || undefined,
      features: Array.from(this.features).filter((f): f is string => !!f),
      equipment: Array.from(this.equipment).filter((e): e is string => !!e),
      combat: this.combat,
      speed: this.speed,
      focus: this.focus,
      resistance: this.resistance,
      will: this.will,
      vitality: this.vitality,
      damageReduction: this.damageReduction,
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      currentMana: this.currentMana,
      maxMana: this.maxMana,
      posX: this.posX,
      posY: this.posY,
      movesLeft: this.movesLeft,
      actionsLeft: this.actionsLeft,
      attacksLeftThisTurn: this.attacksLeftThisTurn,
      isAlive: this.isAlive,
      actionMarks: this.actionMarks,
      physicalProtection: this.physicalProtection,
      maxPhysicalProtection: this.maxPhysicalProtection,
      magicalProtection: this.magicalProtection,
      maxMagicalProtection: this.maxMagicalProtection,
      conditions: Array.from(this.conditions).filter((c): c is string => !!c),
      spells: Array.from(this.spells).filter((s): s is string => !!s),
      hasStartedAction: this.hasStartedAction,
      grabbedByUnitId: this.grabbedByUnitId || undefined,
      size: this.size as any,
      visionRange: this.visionRange,
      unitCooldowns: cooldowns,
      isAIControlled: this.isAIControlled,
      aiBehavior: this.aiBehavior as any,
    };
  }

  /**
   * Atualiza o schema a partir de um BattleUnit (para mudanças parciais)
   */
  updateFrom(unit: Partial<BattleUnit>): void {
    if (unit.currentHp !== undefined) this.currentHp = unit.currentHp;
    if (unit.maxHp !== undefined) this.maxHp = unit.maxHp;
    if (unit.currentMana !== undefined) this.currentMana = unit.currentMana;
    if (unit.maxMana !== undefined) this.maxMana = unit.maxMana;
    if (unit.posX !== undefined) this.posX = unit.posX;
    if (unit.posY !== undefined) this.posY = unit.posY;
    if (unit.movesLeft !== undefined) this.movesLeft = unit.movesLeft;
    if (unit.actionsLeft !== undefined) this.actionsLeft = unit.actionsLeft;
    if (unit.attacksLeftThisTurn !== undefined)
      this.attacksLeftThisTurn = unit.attacksLeftThisTurn;
    if (unit.isAlive !== undefined) this.isAlive = unit.isAlive;
    if (unit.actionMarks !== undefined) this.actionMarks = unit.actionMarks;
    if (unit.hasStartedAction !== undefined)
      this.hasStartedAction = unit.hasStartedAction;
    if (unit.physicalProtection !== undefined)
      this.physicalProtection = unit.physicalProtection;
    if (unit.magicalProtection !== undefined)
      this.magicalProtection = unit.magicalProtection;
    if (unit.grabbedByUnitId !== undefined)
      this.grabbedByUnitId = unit.grabbedByUnitId || "";
    if (unit.damageReduction !== undefined)
      this.damageReduction = unit.damageReduction;

    // Atualizar conditions se mudaram
    if (unit.conditions) {
      this.conditions.clear();
      unit.conditions.forEach((c) => this.conditions.push(c));
    }

    // Atualizar cooldowns se mudaram
    if (unit.unitCooldowns) {
      this.unitCooldowns.clear();
      Object.entries(unit.unitCooldowns).forEach(([key, value]) => {
        this.unitCooldowns.set(key, value);
      });
    }
  }
}
