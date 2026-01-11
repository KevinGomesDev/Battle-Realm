// turn.handler.ts - Controle de turnos, timer e ordem de ação
import type { Delayed, Room } from "@colyseus/core";
import type {
  BattleSessionState,
  BattleUnitSchema,
  BattlePlayerSchema,
} from "../../schemas";
import { TURN_CONFIG } from "@boundless/shared/config";
import { CONDITIONS } from "@boundless/shared/data/conditions.data";
import {
  removeConditionsFromUnit,
  syncUnitActiveEffects,
} from "../../../../conditions/conditions";
import { applyDamage } from "../../../../combat/damage.utils";

/**
 * Verifica se uma unidade pode agir no turno.
 * Uma unidade pode agir se está viva E não possui a condição DISABLED.
 */
export function canUnitAct(unit: BattleUnitSchema | undefined): boolean {
  if (!unit) return false;
  if (!unit.isAlive) return false;
  // Verifica se a unidade possui a condição DISABLED
  const conditions = Array.from(unit.conditions || []);
  if (conditions.includes("DISABLED")) return false;
  return true;
}

/**
 * Calcula a ordem de ação baseada na velocidade das unidades
 */
export function calculateActionOrder(
  state: BattleSessionState,
  onFirstUnitAI?: (unit: BattleUnitSchema) => void
): void {
  const unitIds = Array.from(state.actionOrder).filter(
    (id): id is string => id !== undefined
  );

  unitIds.sort((a, b) => {
    const unitA = state.units.get(a);
    const unitB = state.units.get(b);
    if (!unitA || !unitB) return 0;
    return unitB.speed - unitA.speed;
  });

  state.actionOrder.clear();
  unitIds.forEach((id) => state.actionOrder.push(id));

  if (state.actionOrder.length > 0) {
    state.currentTurnIndex = 0;
    // Usar .at(0) em vez de [0] para ArraySchema do Colyseus
    let firstUnitId = state.actionOrder.at(0);

    // Procurar primeira unidade que pode agir (viva e sem DISABLED)
    let index = 0;
    while (
      firstUnitId &&
      !canUnitAct(state.units.get(firstUnitId)) &&
      index < state.actionOrder.length - 1
    ) {
      index++;
      firstUnitId = state.actionOrder.at(index);
    }

    if (firstUnitId && canUnitAct(state.units.get(firstUnitId))) {
      state.currentTurnIndex = index;
      state.activeUnitId = firstUnitId;
      const unit = state.units.get(firstUnitId)!;

      state.currentPlayerId = unit.ownerId || "";
      unit.movesLeft = unit.speed;
      unit.actionsLeft = 1;
      unit.attacksLeftThisTurn = 0;
      unit.hasStartedAction = false;

      if (unit.isAIControlled && onFirstUnitAI) {
        onFirstUnitAI(unit);
      }
    } else {
    }
  } else {
  }
}

// =============================================================================
// PROCESSAMENTO DE FIM DE TURNO DA UNIDADE
// =============================================================================

/**
 * Interface mínima de unidade para processamento de condições (compatível com Schema)
 */
interface UnitForConditionProcessing {
  conditions: { has(condId: string): boolean } & Iterable<string>;
  speed: number;
  movesLeft: number;
  actionsLeft: number;
  currentHp: number;
  maxHp: number;
  activeEffects?: any;
  physicalProtection: number;
  magicalProtection: number;
  isAlive: boolean;
  id: string;
  name: string;
}

/**
 * Processa as condições que expiram no fim do turno de uma unidade.
 * Remove condições com expiry="end_of_turn" (como DASHING, STUNNED, BURNING, etc.)
 * Aplica dano de condições (BURNING, POISON, etc.)
 */
export function processUnitEndOfTurnConditions(
  unit: UnitForConditionProcessing,
  broadcast: Room<BattleSessionState>["broadcast"]
): { conditionsRemoved: string[]; damageDealt: number; unitDefeated: boolean } {
  const conditionsToRemove: string[] = [];
  let damageFromConditions = 0;

  // Converter conditions para array (Colyseus ArraySchema)
  const conditionsArray = Array.from(unit.conditions);

  // 1. Processar dano de condições e identificar condições a remover
  for (const condId of conditionsArray) {
    const condition = CONDITIONS[condId];
    if (!condition) continue;

    // Dano de condições (BURNING, POISON, etc.)
    if (condition.effects?.damagePerTurn) {
      damageFromConditions += condition.effects.damagePerTurn;
    }

    // Marcar condições que expiram no fim do turno
    if (condition.expiry === "end_of_turn") {
      conditionsToRemove.push(condId);
    }
  }

  // 2. Aplicar dano de condições (dano verdadeiro - ignora proteção)
  if (damageFromConditions > 0) {
    const damageResult = applyDamage(
      unit.physicalProtection,
      unit.magicalProtection,
      unit.currentHp,
      damageFromConditions,
      "VERDADEIRO"
    );
    unit.physicalProtection = damageResult.newPhysicalProtection;
    unit.magicalProtection = damageResult.newMagicalProtection;
    unit.currentHp = damageResult.newHp;
    if (unit.currentHp <= 0) {
      unit.isAlive = false;
    }
  }

  // 3. Remover condições expiradas
  if (conditionsToRemove.length > 0) {
    // Para Colyseus Schema, precisamos manipular o ArraySchema diretamente
    const unitConditions = unit.conditions as unknown as {
      length: number;
      splice(start: number, deleteCount: number): void;
      indexOf(item: string): number;
    };

    for (const condId of conditionsToRemove) {
      const index = conditionsArray.indexOf(condId);
      if (index !== -1) {
        // Remover do ArraySchema
        unitConditions.splice(index, 1);
        // Atualizar array local para próximas iterações
        conditionsArray.splice(index, 1);
      }
    }

    // Broadcast para cliente sobre condições removidas
    broadcast("battle:conditions_expired", {
      unitId: unit.id,
      conditionsRemoved: conditionsToRemove,
      damageFromConditions,
    });
  }

  // 4. Sincronizar activeEffects
  if (unit.activeEffects && typeof syncUnitActiveEffects === "function") {
    // Converter para formato esperado
    const unitForSync = {
      conditions: Array.from(unit.conditions),
      speed: unit.speed,
      movesLeft: unit.movesLeft,
      actionsLeft: unit.actionsLeft,
      currentHp: unit.currentHp,
      maxHp: unit.maxHp,
      physicalProtection: unit.physicalProtection,
      magicalProtection: unit.magicalProtection,
      activeEffects: {},
    };
    syncUnitActiveEffects(unitForSync);

    // Atualizar activeEffects do Schema com os valores recalculados
    unit.activeEffects.clear();
    for (const [key, value] of Object.entries(
      unitForSync.activeEffects as Record<string, any>
    )) {
      unit.activeEffects.set(key, value);
    }
  }

  return {
    conditionsRemoved: conditionsToRemove,
    damageDealt: damageFromConditions,
    unitDefeated: !unit.isAlive,
  };
}

/**
 * Avança para a próxima unidade viva
 */
export function advanceToNextUnit(
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"],
  onRoundEnd: () => void,
  onAITurn: (unit: BattleUnitSchema) => void,
  onBattleEnd: () => void
): void {
  // Verificar se a batalha já terminou
  if (state.status === "ENDED") {
    return;
  }

  // =========================================================================
  // PROCESSAR FIM DO TURNO DA UNIDADE ATUAL
  // =========================================================================
  const currentUnitId = state.activeUnitId;
  if (currentUnitId) {
    const currentUnit = state.units.get(currentUnitId);
    if (currentUnit && currentUnit.isAlive) {
      const result = processUnitEndOfTurnConditions(currentUnit, broadcast);

      // Se a unidade morreu por dano de condição, notificar
      if (result.unitDefeated) {
        broadcast("battle:unit_defeated", {
          unitId: currentUnitId,
          reason: "condition_damage",
        });
      }
    }
  }

  let nextIndex = (state.currentTurnIndex + 1) % state.actionOrder.length;
  let attempts = 0;

  while (attempts < state.actionOrder.length) {
    const unitId = state.actionOrder.at(nextIndex);
    if (!unitId) {
      nextIndex = (nextIndex + 1) % state.actionOrder.length;
      attempts++;
      continue;
    }
    const unit = state.units.get(unitId);

    // Usa canUnitAct para verificar se a unidade pode agir (viva E sem DISABLED)
    if (unit && canUnitAct(unit)) {
      state.currentTurnIndex = nextIndex;
      state.activeUnitId = unitId;
      state.currentPlayerId = unit.ownerId;
      state.turnTimer = TURN_CONFIG.timerSeconds;

      unit.hasStartedAction = false;
      unit.movesLeft = unit.speed;
      unit.actionsLeft = 1;
      unit.attacksLeftThisTurn = 0;

      if (nextIndex === 0) {
        state.round++;
        onRoundEnd();
      }

      // Serializar activeEffects para envio
      const serializedActiveEffects: Record<string, any> = {};
      unit.activeEffects?.forEach((effect: any, key: string) => {
        serializedActiveEffects[key] = {
          key: effect.key,
          value:
            typeof effect.value === "string"
              ? isNaN(Number(effect.value))
                ? effect.value === "true"
                : Number(effect.value)
              : effect.value,
          sources:
            typeof effect.sources === "string"
              ? JSON.parse(effect.sources)
              : effect.sources,
        };
      });

      // Serializar cooldowns para envio
      const serializedCooldowns: Record<string, number> = {};
      unit.unitCooldowns?.forEach((value: number, key: string) => {
        serializedCooldowns[key] = value;
      });

      broadcast("battle:turn_changed", {
        unitId: unitId,
        playerId: unit.ownerId,
        round: state.round,
        turnTimer: state.turnTimer,
        // Dados atualizados da unidade para sync no cliente
        unitUpdated: {
          movesLeft: unit.movesLeft,
          actionsLeft: unit.actionsLeft,
          attacksLeftThisTurn: unit.attacksLeftThisTurn,
          hasStartedAction: unit.hasStartedAction,
          conditions: Array.from(unit.conditions),
          activeEffects: serializedActiveEffects,
          unitCooldowns: serializedCooldowns,
        },
      });

      if (unit.isAIControlled) {
        onAITurn(unit);
      }

      return;
    }

    nextIndex = (nextIndex + 1) % state.actionOrder.length;
    attempts++;
  }

  // Não encontrou nenhuma unidade viva na actionOrder
  // Verificar se realmente não há unidades vivas antes de terminar
  onBattleEnd();
}

/**
 * Processa o fim de uma rodada
 */
export function processRoundEnd(
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"]
): void {
  // Coletar cooldowns atualizados de todas as unidades para enviar ao cliente
  const updatedCooldowns: Record<string, Record<string, number>> = {};

  state.units.forEach((unit) => {
    if (!unit.isAlive) return;

    unit.unitCooldowns.forEach((value, key) => {
      if (value > 0) {
        unit.unitCooldowns.set(key, value - 1);
      }
    });

    // Serializar cooldowns atualizados para esta unidade
    const unitCooldowns: Record<string, number> = {};
    unit.unitCooldowns.forEach((value: number, key: string) => {
      unitCooldowns[key] = value;
    });
    updatedCooldowns[unit.id] = unitCooldowns;
  });

  broadcast("battle:round_ended", {
    round: state.round - 1,
    updatedCooldowns,
  });
}
