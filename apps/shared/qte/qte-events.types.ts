// shared/qte/qte-events.types.ts
// Tipos de eventos Colyseus para sincronização de QTE

import type { QTEConfig, QTEResponse, QTEResult } from "./qte.types";

// =============================================================================
// EVENTOS DO QTE SIMPLES (ATAQUE/DEFESA)
// =============================================================================

/**
 * Evento: QTE iniciado (servidor -> cliente)
 */
export interface QTEStartEvent {
  type: "qte:start";
  config: QTEConfig;
}

/**
 * Evento: QTE respondido (cliente -> servidor)
 */
export interface QTEResponseEvent {
  type: "qte:response";
  response: QTEResponse;
}

/**
 * Evento: QTE resolvido (servidor -> todos)
 */
export interface QTEResolvedEvent {
  type: "qte:resolved";
  result: QTEResult;
}

/**
 * Evento: QTE expirado (servidor -> todos)
 */
export interface QTEExpiredEvent {
  type: "qte:expired";
  qteId: string;
  responderId: string;
  /** Resultado automático por timeout */
  result: QTEResult;
}

/**
 * Evento: Cascata de QTE (quando projétil atinge novo alvo)
 */
export interface QTECascadeEvent {
  type: "qte:cascade";
  previousQteId: string;
  newConfig: QTEConfig;
  /** Informações da trajetória para animação */
  projectileTrajectory: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };
}

/**
 * Evento: QTE iniciado (para observadores)
 */
export interface QTEInitiatedEvent {
  type: "qte:initiated";
  qteId: string;
  attackerId: string;
  targetId: string;
  phase: "ATTACK" | "DEFENSE";
  attackResult?: string;
}

// =============================================================================
// UNION TYPE PARA TODOS OS EVENTOS
// =============================================================================

/**
 * Todos os eventos de QTE possíveis
 */
export type QTEEvent =
  | QTEStartEvent
  | QTEResponseEvent
  | QTEResolvedEvent
  | QTEExpiredEvent
  | QTECascadeEvent
  | QTEInitiatedEvent;

/**
 * Eventos que o cliente envia para o servidor
 */
export type QTEClientToServerEvent = QTEResponseEvent;

/**
 * Eventos que o servidor envia para o cliente
 */
export type QTEServerToClientEvent =
  | QTEStartEvent
  | QTEResolvedEvent
  | QTEExpiredEvent
  | QTECascadeEvent
  | QTEInitiatedEvent;
