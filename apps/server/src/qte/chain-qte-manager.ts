// server/src/qte/chain-qte-manager.ts
// Gerenciador de Chain QTE (QTEs em cascata/playlist)
// Orquestra QTEs pré-calculados com validação por step

import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { applyDamage } from "../modules/combat/damage.utils";
import type {
  ChainQTEConfig,
  ChainQTEStepResponse,
  ChainQTEBatchResponse,
  ChainQTEStepResult,
  ChainQTEResult,
  QTEResultGrade,
} from "@boundless/shared/qte";
import {
  QTE_TIMEOUT_BUFFER,
  QTE_TOLERANCE_MS,
  CHAIN_COMBO_MULTIPLIERS,
  QTE_FEEDBACK_COLORS,
} from "@boundless/shared/qte";

import { calculateZones, determineResultGrade } from "./qte-processor";
import type { GetServerTimeFn } from "./qte-manager";

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Estado de um Chain QTE pendente
 */
export interface PendingChainQTE {
  config: ChainQTEConfig;
  casterUnit: BattleUnit;
  targetUnits: BattleUnit[];
  stepResults: ChainQTEStepResult[];
  currentCombo: number;
  consecutiveHits: number;
  consecutivePerfects: number;
  chainBroken: boolean;
  brokenAtStep?: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Callback quando Chain QTE é completado
 */
export type ChainQTECompletionCallback = (result: ChainQTEResult) => void;

// =============================================================================
// CLASSE GERENCIADORA
// =============================================================================

export class ChainQTEManager {
  /** Chain QTEs pendentes por chainId */
  private pendingChains = new Map<string, PendingChainQTE>();

  /** Callbacks de conclusão */
  private completionCallbacks = new Map<string, ChainQTECompletionCallback>();

  /** Referência para unidades */
  private allUnits: BattleUnit[] = [];

  /** Callback para enviar eventos */
  private broadcastFn: (event: string, data: unknown) => void;

  /** Callback para enviar para cliente específico */
  private sendToClientFn: (
    userId: string,
    event: string,
    data: unknown
  ) => void;

  /** Função para obter o tempo atual do servidor */
  private getServerTime: GetServerTimeFn;

  constructor(
    broadcastFn: (event: string, data: unknown) => void,
    sendToClientFn: (userId: string, event: string, data: unknown) => void,
    getServerTime: GetServerTimeFn = () => Date.now()
  ) {
    this.broadcastFn = broadcastFn;
    this.sendToClientFn = sendToClientFn;
    this.getServerTime = getServerTime;
  }

  // =============================================================================
  // CONFIGURAÇÃO
  // =============================================================================

  /**
   * Atualiza referências de unidades
   */
  updateUnits(units: BattleUnit[]): void {
    this.allUnits = units;
  }

  // =============================================================================
  // FLUXO PRINCIPAL
  // =============================================================================

  /**
   * Inicia um Chain QTE
   * Envia a playlist completa para o cliente
   */
  initiateChainQTE(
    config: ChainQTEConfig,
    caster: BattleUnit,
    targets: BattleUnit[],
    onComplete: ChainQTECompletionCallback
  ): void {
    const pending: PendingChainQTE = {
      config,
      casterUnit: caster,
      targetUnits: targets,
      stepResults: [],
      currentCombo: 1.0,
      consecutiveHits: 0,
      consecutivePerfects: 0,
      chainBroken: false,
    };

    this.pendingChains.set(config.chainId, pending);
    this.completionCallbacks.set(config.chainId, onComplete);

    // Timeout para todo o Chain (último step + buffer)
    const lastStep = config.steps[config.steps.length - 1];
    const totalTimeout =
      lastStep.offsetMs + lastStep.duration + QTE_TIMEOUT_BUFFER * 2;

    const timeout = setTimeout(() => {
      this.handleChainTimeout(config.chainId);
    }, totalTimeout);

    pending.timeoutId = timeout;

    // Enviar playlist completa para o cliente
    this.sendToClientFn(config.playerId, "chain_qte:start", config);

    // Broadcast que Chain iniciou (para observadores)
    this.broadcastFn("chain_qte:initiated", {
      chainId: config.chainId,
      casterId: caster.id,
      targetIds: targets.map((t) => t.id),
      chainType: config.chainType,
      totalSteps: config.steps.length,
    });
  }

  /**
   * Processa resposta de um step
   */
  processStepResponse(response: ChainQTEStepResponse): void {
    const pending = this.pendingChains.get(response.chainId);
    if (!pending) {
      console.warn(
        `[ChainQTEManager] Chain não encontrado: ${response.chainId}`
      );
      return;
    }

    // Verificar se Chain já quebrou
    if (pending.chainBroken) {
      console.warn(`[ChainQTEManager] Chain já quebrado: ${response.chainId}`);
      return;
    }

    const step = pending.config.steps[response.stepIndex];
    if (!step) {
      console.warn(
        `[ChainQTEManager] Step não encontrado: ${response.stepIndex}`
      );
      return;
    }

    // Validar timestamp (Trust but Verify)
    const expectedTime = pending.config.serverBaseTime + step.offsetMs;
    const tolerance = step.duration / 2 + QTE_TOLERANCE_MS;
    const isValidTimestamp =
      Math.abs(response.serverTimestamp - expectedTime) <= tolerance;

    // Calcular zonas
    const zones = calculateZones(step.hitZoneSize, step.perfectZoneSize);

    // Determinar resultado
    const grade = isValidTimestamp
      ? determineResultGrade(
          response.hitPosition,
          zones.hitZoneStart,
          zones.hitZoneEnd,
          zones.perfectZoneStart,
          zones.perfectZoneEnd,
          response.input === "NONE"
        )
      : "FAIL";

    // Atualizar combo
    if (grade === "FAIL") {
      pending.consecutiveHits = 0;
      pending.consecutivePerfects = 0;

      if (pending.config.failMode === "BREAK") {
        pending.chainBroken = true;
        pending.brokenAtStep = response.stepIndex;
      } else if (pending.config.failMode === "COMBO") {
        pending.currentCombo = CHAIN_COMBO_MULTIPLIERS.FAIL_RESET;
      }
    } else {
      pending.consecutiveHits++;
      if (grade === "PERFECT") {
        pending.consecutivePerfects++;
      }

      // Recalcular combo
      pending.currentCombo =
        1.0 +
        pending.consecutiveHits * CHAIN_COMBO_MULTIPLIERS.PER_HIT +
        pending.consecutivePerfects * CHAIN_COMBO_MULTIPLIERS.PERFECT_BONUS;

      pending.currentCombo = Math.min(
        pending.currentCombo,
        CHAIN_COMBO_MULTIPLIERS.MAX_COMBO
      );
    }

    // Calcular dano
    const damageMultiplier =
      grade === "PERFECT" ? 1.5 : grade === "HIT" ? 1.0 : 0.5;
    const damageDealt = Math.round(
      step.baseDamage * damageMultiplier * pending.currentCombo
    );

    // Verificar se alvo morreu
    const target = this.allUnits.find((u) => u.id === step.targetId);

    // Aplicar dano (Chain QTE é dano físico)
    let targetDefeated = false;
    if (target && damageDealt > 0) {
      const result = applyDamage(
        target.physicalProtection,
        target.magicalProtection,
        target.currentHp,
        damageDealt,
        "FISICO"
      );
      target.physicalProtection = result.newPhysicalProtection;
      target.magicalProtection = result.newMagicalProtection;
      target.currentHp = result.newHp;
      targetDefeated = target.currentHp <= 0;
      if (targetDefeated) {
        target.isAlive = false;
      }
    }

    // Registrar resultado do step
    const stepResult: ChainQTEStepResult = {
      stepIndex: response.stepIndex,
      targetId: step.targetId,
      grade,
      damageDealt,
      currentCombo: pending.currentCombo,
      targetDefeated,
    };

    pending.stepResults.push(stepResult);

    // Broadcast resultado do step
    this.broadcastFn("chain_qte:step_resolved", {
      chainId: response.chainId,
      stepResult,
    });

    // Verificar se Chain terminou
    const allStepsCompleted =
      pending.stepResults.length === pending.config.steps.length;
    if (allStepsCompleted || pending.chainBroken) {
      this.completeChain(response.chainId);
    }
  }

  /**
   * Processa batch de respostas (para Omnislash)
   */
  processBatchResponse(response: ChainQTEBatchResponse): void {
    const pending = this.pendingChains.get(response.chainId);
    if (!pending) {
      console.warn(
        `[ChainQTEManager] Chain não encontrado: ${response.chainId}`
      );
      return;
    }

    // Processar cada step no batch
    for (const stepResponse of response.stepResults) {
      this.processStepResponse({
        chainId: response.chainId,
        battleId: response.battleId,
        playerId: response.playerId,
        stepIndex: stepResponse.stepIndex,
        input: stepResponse.input,
        hitPosition: stepResponse.hitPosition,
        serverTimestamp: stepResponse.serverTimestamp,
      });
    }
  }

  /**
   * Finaliza o Chain QTE
   */
  private completeChain(chainId: string): void {
    const pending = this.pendingChains.get(chainId);
    if (!pending) return;

    // Limpar timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Calcular estatísticas
    const totalHits = pending.stepResults.filter(
      (r) => r.grade !== "FAIL"
    ).length;
    const totalPerfects = pending.stepResults.filter(
      (r) => r.grade === "PERFECT"
    ).length;
    const totalFails = pending.stepResults.filter(
      (r) => r.grade === "FAIL"
    ).length;
    const totalDamage = pending.stepResults.reduce(
      (sum, r) => sum + r.damageDealt,
      0
    );

    // Encontrar maior combo
    let maxCombo = 0;
    let currentStreak = 0;
    for (const result of pending.stepResults) {
      if (result.grade !== "FAIL") {
        currentStreak++;
        maxCombo = Math.max(maxCombo, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Gerar mensagem de feedback
    let feedbackMessage: string;
    let feedbackColor: string;

    if (pending.chainBroken) {
      feedbackMessage = "Corrente Quebrada!";
      feedbackColor = QTE_FEEDBACK_COLORS.FAIL;
    } else if (totalPerfects === pending.config.steps.length) {
      feedbackMessage = "PERFEITO! Combo Máximo!";
      feedbackColor = QTE_FEEDBACK_COLORS.PERFECT;
    } else if (totalFails === 0) {
      feedbackMessage = "Excelente! Todos os Hits!";
      feedbackColor = QTE_FEEDBACK_COLORS.HIT;
    } else if (totalHits > totalFails) {
      feedbackMessage = `Bom! ${totalHits}/${pending.config.steps.length}`;
      feedbackColor = QTE_FEEDBACK_COLORS.HIT;
    } else {
      feedbackMessage = `Fraco... ${totalHits}/${pending.config.steps.length}`;
      feedbackColor = QTE_FEEDBACK_COLORS.FAIL;
    }

    const result: ChainQTEResult = {
      chainId,
      battleId: pending.config.battleId,
      stepResults: pending.stepResults,
      totalHits,
      totalPerfects,
      totalFails,
      maxCombo,
      totalDamage,
      chainBroken: pending.chainBroken,
      brokenAtStep: pending.brokenAtStep,
      feedbackMessage,
      feedbackColor,
    };

    // Limpar estado
    this.pendingChains.delete(chainId);

    // Broadcast resultado final
    this.broadcastFn("chain_qte:complete", result);

    // Chamar callback
    const callback = this.completionCallbacks.get(chainId);
    if (callback) {
      this.completionCallbacks.delete(chainId);
      callback(result);
    }
  }

  /**
   * Trata timeout de Chain QTE
   */
  private handleChainTimeout(chainId: string): void {
    const pending = this.pendingChains.get(chainId);
    if (!pending) return;

    console.log(`[ChainQTEManager] Chain expirado: ${chainId}`);

    // Preencher steps faltantes como FAIL
    const completedIndices = new Set(
      pending.stepResults.map((r) => r.stepIndex)
    );

    for (const step of pending.config.steps) {
      if (!completedIndices.has(step.stepIndex)) {
        pending.stepResults.push({
          stepIndex: step.stepIndex,
          targetId: step.targetId,
          grade: "FAIL",
          damageDealt: 0,
          currentCombo: 0,
          targetDefeated: false,
        });
      }
    }

    // Ordenar por índice
    pending.stepResults.sort((a, b) => a.stepIndex - b.stepIndex);

    // Completar chain
    this.completeChain(chainId);
  }

  /**
   * Limpa todos os Chain QTEs pendentes
   */
  cleanup(): void {
    for (const pending of this.pendingChains.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this.pendingChains.clear();
    this.completionCallbacks.clear();
  }

  /**
   * Verifica se há Chain QTE pendente
   */
  hasPendingChainQTE(unitId: string): boolean {
    for (const pending of this.pendingChains.values()) {
      if (pending.casterUnit.id === unitId) return true;
      if (pending.targetUnits.some((t) => t.id === unitId)) return true;
    }
    return false;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Cria uma instância do ChainQTEManager
 */
export function createChainQTEManager(
  broadcastFn: (event: string, data: unknown) => void,
  sendToClientFn: (userId: string, event: string, data: unknown) => void,
  getServerTime: GetServerTimeFn = () => Date.now()
): ChainQTEManager {
  return new ChainQTEManager(broadcastFn, sendToClientFn, getServerTime);
}
