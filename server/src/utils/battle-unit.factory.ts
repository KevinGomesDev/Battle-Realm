// src/utils/battle-unit.factory.ts
// Factory para criação de BattleUnits - elimina duplicação de código

import { determineUnitActions } from "../logic/unit-actions";

// Tipo para unidade do banco de dados
interface DBUnit {
  id: string;
  name: string | null;
  category: string;
  troopSlot: number | null;
  level: number;
  classCode: string | null;
  classFeatures: string | null;
  equipment: string | null;
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number | null;
}

// Tipo para BattleUnit
export interface BattleUnit {
  id: string;
  sourceUnitId: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  category: string;
  troopSlot?: number;
  level: number;
  classCode?: string;
  classFeatures: string[];
  equipment: string[];
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number;
  currentHp: number;
  maxHp: number;
  posX: number;
  posY: number;
  initiative: number;
  movesLeft: number;
  actionsLeft: number;
  isAlive: boolean;
  actionMarks: number;
  protection: number;
  protectionBroken: boolean;
  conditions: string[];
  hasStartedAction: boolean;
  actions: string[];
  grabbedByUnitId?: string;
}

interface KingdomInfo {
  id: string;
  name: string;
}

interface Position {
  x: number;
  y: number;
}

// Gerar ID único
function generateUnitId(): string {
  return `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cria uma BattleUnit a partir de uma unidade do banco de dados
 */
export function createBattleUnit(
  dbUnit: DBUnit,
  ownerId: string,
  kingdom: KingdomInfo,
  position: Position,
  battleType: "arena" | "match" = "arena"
): BattleUnit {
  // Determinar ações dinamicamente baseado nos stats
  const unitActions = determineUnitActions(
    {
      combat: dbUnit.combat,
      acuity: dbUnit.acuity,
      focus: dbUnit.focus,
      armor: dbUnit.armor,
      vitality: dbUnit.vitality,
      category: dbUnit.category,
    },
    { battleType }
  );

  return {
    id: generateUnitId(),
    sourceUnitId: dbUnit.id,
    ownerId,
    ownerKingdomId: kingdom.id,
    name: dbUnit.name || `${kingdom.name} ${dbUnit.category}`,
    category: dbUnit.category,
    troopSlot: dbUnit.troopSlot ?? undefined,
    level: dbUnit.level,
    classCode: dbUnit.classCode ?? undefined,
    classFeatures: JSON.parse(dbUnit.classFeatures || "[]"),
    equipment: JSON.parse(dbUnit.equipment || "[]"),
    combat: dbUnit.combat,
    acuity: dbUnit.acuity,
    focus: dbUnit.focus,
    armor: dbUnit.armor,
    vitality: dbUnit.vitality,
    damageReduction: dbUnit.damageReduction || 0,
    currentHp: dbUnit.vitality * 2, // HP = 2x Vitality
    maxHp: dbUnit.vitality * 2,
    posX: position.x,
    posY: position.y,
    initiative: Math.floor(Math.random() * 20) + 1 + dbUnit.acuity,
    movesLeft: 0,
    actionsLeft: 1,
    isAlive: true,
    actionMarks: 0,
    protection: (dbUnit.armor || 0) * 2,
    protectionBroken: false,
    conditions: [],
    hasStartedAction: false,
    actions: unitActions,
  };
}

/**
 * Cria múltiplas BattleUnits para um lado da batalha
 * @param units - Array de unidades do banco de dados
 * @param ownerId - ID do dono das unidades
 * @param kingdom - Informações do reino
 * @param startPosition - Posição inicial
 * @param spread - Direção de espalhamento ("horizontal" ou "vertical")
 * @param battleType - Tipo de batalha ("arena" ou "match")
 */
export function createBattleUnitsForSide(
  units: DBUnit[],
  ownerId: string,
  kingdom: KingdomInfo,
  startPosition: Position,
  spread: "horizontal" | "vertical" = "horizontal",
  battleType: "arena" | "match" = "arena"
): BattleUnit[] {
  return units.map((unit, index) => {
    const position =
      spread === "horizontal"
        ? { x: startPosition.x + index, y: startPosition.y }
        : { x: startPosition.x, y: startPosition.y + index };

    return createBattleUnit(unit, ownerId, kingdom, position, battleType);
  });
}

/**
 * Ordena unidades por iniciativa (maior primeiro)
 */
export function sortByInitiative(units: BattleUnit[]): BattleUnit[] {
  return [...units].sort((a, b) => b.initiative - a.initiative);
}

/**
 * Determina a ordem de ação dos jogadores baseada na iniciativa da primeira unidade
 */
export function determineActionOrder(
  orderedUnits: BattleUnit[],
  hostUserId: string,
  guestUserId: string
): string[] {
  if (orderedUnits.length === 0) {
    return [hostUserId, guestUserId];
  }

  const firstUnit = orderedUnits[0];
  return firstUnit.ownerId === hostUserId
    ? [hostUserId, guestUserId]
    : [guestUserId, hostUserId];
}
