// server/src/qte/qte-manager.ts
// Gerenciador de Quick Time Events para batalhas
// Orquestra o fluxo de QTEs entre atacante e defensor
// Implementa arquitetura "Trust but Verify" com sincronização de tempo

import type {
  BattleUnit,
  BattleObstacle,
} from "../../../shared/types/battle.types";
import type { QTEConfig, QTEResponse, QTEResult } from "../../../shared/qte";
import { QTE_TIMEOUT_BUFFER } from "../../../shared/qte";

import { generateAttackQTE, generateDefenseQTE } from "./qte-calculator";
import {
  processAttackQTEResponse,
  processDefenseQTEResponse,
  applyAttackQTEResult,
  applyDefenseQTEResult,
  applyPerfectDodgeBuff,
  applyDodgeMovement,
} from "./qte-processor";

// =============================================================================
// TIPOS
// =============================================================================

/**
 * Estado de um QTE pendente
 */
export interface PendingQTE {
  config: QTEConfig;
  attackerUnit: BattleUnit;
  targetUnit: BattleUnit;
  baseDamage: number;
  isMagicAttack: boolean;
  phase: "ATTACK" | "DEFENSE";
  attackQTEResult?: QTEResult;
  /** Timeout para expiração */
  timeoutId?: NodeJS.Timeout;
}

/**
 * Resultado final do combate com QTE
 */
export interface QTECombatResult {
  success: boolean;
  attackerQTE: QTEResult;
  defenderQTE?: QTEResult;
  finalDamage: number;
  dodged: boolean;
  blocked: boolean;
  newDefenderPosition?: { x: number; y: number };
  projectileContinues?: boolean;
  nextTargetId?: string;
  attackerDamageModifier: number;
  defenderDamageModifier: number;
}

/**
 * Callback quando QTE é completado
 */
export type QTECompletionCallback = (result: QTECombatResult) => void;

/**
 * Função para obter o tempo atual do servidor
 */
export type GetServerTimeFn = () => number;

// =============================================================================
// CLASSE GERENCIADORA
// =============================================================================

export class QTEManager {
  /** QTEs pendentes por qteId */
  private pendingQTEs = new Map<string, PendingQTE>();

  /** Callbacks de conclusão */
  private completionCallbacks = new Map<string, QTECompletionCallback>();

  /** Referência para todas as unidades (para cascata) */
  private allUnits: BattleUnit[] = [];

  /** Referência para obstáculos */
  private obstacles: BattleObstacle[] = [];

  /** Dimensões do grid */
  private gridWidth: number = 10;
  private gridHeight: number = 10;

  /** Callback para enviar eventos */
  private broadcastFn: (event: string, data: unknown) => void;

  /** Callback para enviar para cliente específico */
  private sendToClientFn: (
    userId: string,
    event: string,
    data: unknown
  ) => void;

  /** Função para obter o tempo atual do servidor (clock.currentTime) */
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
   * Atualiza referências de estado da batalha
   */
  updateBattleState(
    units: BattleUnit[],
    obstacles: BattleObstacle[],
    gridWidth: number,
    gridHeight: number
  ): void {
    this.allUnits = units;
    this.obstacles = obstacles;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
  }

  // =============================================================================
  // FLUXO PRINCIPAL
  // =============================================================================

  /**
   * Inicia um ataque com QTE
   * Retorna o QTE do atacante (fase 1)
   *
   * Usa arquitetura "Trust but Verify":
   * - QTE é agendado para o futuro (serverStartTime)
   * - Cliente agenda o visual e responde com serverTimestamp
   * - Servidor valida se timestamp está na janela com tolerância
   */
  initiateAttack(
    attacker: BattleUnit,
    target: BattleUnit,
    battleId: string,
    baseDamage: number,
    isMagicAttack: boolean = false,
    onComplete: QTECompletionCallback
  ): QTEConfig {
    const serverTime = this.getServerTime();

    // Gerar QTE do atacante com tempo do servidor
    const attackQTE = generateAttackQTE(
      attacker,
      target,
      battleId,
      isMagicAttack,
      serverTime
    );

    // Armazenar estado pendente
    const pending: PendingQTE = {
      config: attackQTE,
      attackerUnit: attacker,
      targetUnit: target,
      baseDamage,
      isMagicAttack,
      phase: "ATTACK",
    };

    this.pendingQTEs.set(attackQTE.qteId, pending);
    this.completionCallbacks.set(attackQTE.qteId, onComplete);

    // Configurar timeout baseado no serverEndTime + buffer
    const timeUntilExpiry =
      attackQTE.serverEndTime - serverTime + QTE_TIMEOUT_BUFFER;
    const timeout = setTimeout(() => {
      this.handleQTETimeout(attackQTE.qteId);
    }, timeUntilExpiry);

    pending.timeoutId = timeout;

    // Broadcast QTE para todos os jogadores
    // Cada cliente verifica responderOwnerId para saber se deve aceitar inputs
    this.broadcastFn("qte:start", attackQTE);

    return attackQTE;
  }

  /**
   * Processa resposta do QTE
   */
  processResponse(response: QTEResponse): void {
    const pending = this.pendingQTEs.get(response.qteId);
    if (!pending) {
      console.warn(`[QTEManager] QTE não encontrado: ${response.qteId}`);
      return;
    }

    // Limpar timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    if (pending.phase === "ATTACK") {
      this.processAttackResponse(pending, response);
    } else {
      this.processDefenseResponse(pending, response);
    }
  }

  /**
   * Processa resposta do QTE de ataque
   */
  private processAttackResponse(
    pending: PendingQTE,
    response: QTEResponse
  ): void {
    const attackResult = processAttackQTEResponse(pending.config, response);

    // Broadcast resultado do ataque
    this.broadcastFn("qte:resolved", attackResult);

    // Calcular dano modificado
    const modifiedDamage = applyAttackQTEResult(
      pending.baseDamage,
      attackResult
    );

    const serverTime = this.getServerTime();

    // Gerar QTE de defesa com tempo do servidor
    const defenseQTE = generateDefenseQTE(
      pending.attackerUnit,
      pending.targetUnit,
      pending.config.battleId,
      this.allUnits,
      this.obstacles,
      this.gridWidth,
      this.gridHeight,
      pending.isMagicAttack,
      false,
      serverTime
    );

    // Atualizar estado pendente
    pending.config = defenseQTE;
    pending.phase = "DEFENSE";
    pending.attackQTEResult = attackResult;
    pending.baseDamage = modifiedDamage;

    // Remover QTE antigo e adicionar novo
    this.pendingQTEs.delete(response.qteId);
    this.pendingQTEs.set(defenseQTE.qteId, pending);

    // Mover callback para novo ID
    const callback = this.completionCallbacks.get(response.qteId);
    if (callback) {
      this.completionCallbacks.delete(response.qteId);
      this.completionCallbacks.set(defenseQTE.qteId, callback);
    }

    // Configurar novo timeout baseado no serverEndTime
    const timeUntilExpiry =
      defenseQTE.serverEndTime - serverTime + QTE_TIMEOUT_BUFFER;
    const timeout = setTimeout(() => {
      this.handleQTETimeout(defenseQTE.qteId);
    }, timeUntilExpiry);

    pending.timeoutId = timeout;

    // Broadcast QTE de defesa para todos os jogadores
    // Cada cliente verifica responderOwnerId para saber se deve aceitar inputs
    this.broadcastFn("qte:start", defenseQTE);
  }

  /**
   * Processa resposta do QTE de defesa
   */
  private processDefenseResponse(
    pending: PendingQTE,
    response: QTEResponse
  ): void {
    const defenseResult = processDefenseQTEResponse(
      pending.config,
      response,
      this.allUnits
    );

    // Broadcast resultado da defesa
    this.broadcastFn("qte:resolved", defenseResult);

    // Aplicar resultado
    const defenseApplication = applyDefenseQTEResult(
      pending.baseDamage,
      defenseResult
    );

    // Aplicar buff de esquiva perfeita
    if (defenseResult.perfectDodgeBuff) {
      applyPerfectDodgeBuff(pending.targetUnit, defenseResult);
    }

    // Aplicar movimento de esquiva
    if (defenseResult.dodgeSuccessful && defenseResult.newPosition) {
      applyDodgeMovement(pending.targetUnit, defenseResult);
    }

    // Construir resultado final
    const combatResult: QTECombatResult = {
      success: true,
      attackerQTE: pending.attackQTEResult!,
      defenderQTE: defenseResult,
      finalDamage: defenseApplication.finalDamage,
      dodged: defenseApplication.dodged,
      blocked: defenseResult.actionType === "BLOCK",
      newDefenderPosition: defenseApplication.newPosition,
      projectileContinues: defenseResult.projectileContinues,
      nextTargetId: defenseResult.nextTargetId,
      attackerDamageModifier: pending.attackQTEResult!.damageModifier,
      defenderDamageModifier: defenseResult.damageReductionModifier ?? 1.0,
    };

    // Limpar estado
    this.pendingQTEs.delete(response.qteId);

    // Chamar callback de conclusão
    const callback = this.completionCallbacks.get(response.qteId);
    if (callback) {
      this.completionCallbacks.delete(response.qteId);
      callback(combatResult);
    }

    // Se projétil continua, iniciar cascata
    if (
      defenseResult.projectileContinues &&
      defenseResult.nextTargetId &&
      callback
    ) {
      const nextTarget = this.allUnits.find(
        (u) => u.id === defenseResult.nextTargetId
      );
      if (nextTarget && nextTarget.isAlive) {
        // Iniciar novo QTE para o próximo alvo
        this.initiateCascade(
          pending.attackerUnit,
          nextTarget,
          pending.config.battleId,
          pending.baseDamage,
          pending.isMagicAttack,
          pending.config.qteId,
          callback
        );
      }
    }
  }

  /**
   * Inicia QTE de cascata (quando projétil continua após esquiva)
   */
  private initiateCascade(
    attacker: BattleUnit,
    newTarget: BattleUnit,
    battleId: string,
    damage: number,
    isMagicAttack: boolean,
    previousQteId: string,
    onComplete: QTECompletionCallback
  ): void {
    const serverTime = this.getServerTime();

    // Gerar QTE de defesa para novo alvo (pula fase de ataque)
    const cascadeQTE = generateDefenseQTE(
      attacker,
      newTarget,
      battleId,
      this.allUnits,
      this.obstacles,
      this.gridWidth,
      this.gridHeight,
      isMagicAttack,
      true, // isCascade
      serverTime
    );

    // Criar resultado de ataque fictício (mantém o dano do atacante original)
    const fakeAttackResult: QTEResult = {
      qteId: previousQteId,
      battleId,
      grade: "HIT",
      actionType: "ATTACK",
      responderId: attacker.id,
      damageModifier: 1.0,
      feedbackMessage: "Projétil continua!",
      feedbackColor: "#f97316",
      timedOut: false,
    };

    // Armazenar estado pendente
    const pending: PendingQTE = {
      config: cascadeQTE,
      attackerUnit: attacker,
      targetUnit: newTarget,
      baseDamage: damage,
      isMagicAttack,
      phase: "DEFENSE",
      attackQTEResult: fakeAttackResult,
    };

    this.pendingQTEs.set(cascadeQTE.qteId, pending);
    this.completionCallbacks.set(cascadeQTE.qteId, onComplete);

    // Configurar timeout baseado no serverEndTime
    const timeUntilExpiry =
      cascadeQTE.serverEndTime - serverTime + QTE_TIMEOUT_BUFFER;
    const timeout = setTimeout(() => {
      this.handleQTETimeout(cascadeQTE.qteId);
    }, timeUntilExpiry);

    pending.timeoutId = timeout;

    // Broadcast cascata com QTE para todos os jogadores
    this.broadcastFn("qte:cascade", {
      previousQteId,
      newConfig: cascadeQTE,
      projectileTrajectory: {
        fromX: attacker.posX,
        fromY: attacker.posY,
        toX: newTarget.posX,
        toY: newTarget.posY,
      },
    });
  }

  /**
   * Trata timeout de QTE
   */
  private handleQTETimeout(qteId: string): void {
    const pending = this.pendingQTEs.get(qteId);
    if (!pending) return;

    console.log(`[QTEManager] QTE expirado: ${qteId}`);

    const serverTime = this.getServerTime();

    // Criar resposta vazia (timeout) com serverTimestamp
    const timeoutResponse: QTEResponse = {
      qteId,
      battleId: pending.config.battleId,
      playerId: pending.config.responderId,
      unitId: pending.config.responderId,
      input: "NONE",
      hitPosition: 0,
      serverTimestamp: serverTime, // Tempo atual do servidor
      respondedAt: serverTime, // Compatibilidade
    };

    // Processar como falha
    this.processResponse(timeoutResponse);
  }

  /**
   * Limpa todos os QTEs pendentes
   */
  cleanup(): void {
    for (const pending of this.pendingQTEs.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this.pendingQTEs.clear();
    this.completionCallbacks.clear();
  }

  /**
   * Verifica se há QTE pendente para uma unidade
   */
  hasPendingQTE(unitId: string): boolean {
    for (const pending of this.pendingQTEs.values()) {
      if (
        pending.attackerUnit.id === unitId ||
        pending.targetUnit.id === unitId
      ) {
        return true;
      }
    }
    return false;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Cria uma instância do QTEManager
 */
export function createQTEManager(
  broadcastFn: (event: string, data: unknown) => void,
  sendToClientFn: (userId: string, event: string, data: unknown) => void,
  getServerTime: GetServerTimeFn = () => Date.now()
): QTEManager {
  return new QTEManager(broadcastFn, sendToClientFn, getServerTime);
}
