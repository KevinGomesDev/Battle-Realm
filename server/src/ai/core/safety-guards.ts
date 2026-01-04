// server/src/ai/core/safety-guards.ts
// Travas de segurança para garantir que a IA nunca trave

import type { AIDecision } from "../types/ai.types";
import { DEFAULT_AI_TIMEOUT } from "../types/ai.types";

/**
 * Decisão de fallback - SEMPRE passar o turno
 * Usada quando qualquer coisa dá errado
 * NOTA: Não loga aqui, apenas cria a decisão. O log deve ser feito por quem usa.
 */
export function getFallbackDecision(reason: string): AIDecision {
  return {
    type: "PASS",
    unitId: "__AI__",
    reason: `Fallback: ${reason}`,
  };
}

/**
 * Loga e retorna uma decisão de fallback
 * Usar quando o fallback está sendo USADO (não apenas criado)
 */
export function logAndReturnFallback(reason: string): AIDecision {
  console.warn(`[AI Safety] Fallback decision used: ${reason}`);
  return getFallbackDecision(reason);
}

/**
 * Wrapper que executa uma função com timeout
 * Se exceder o tempo, retorna o fallback
 */
export async function withTimeout<T>(
  operation: () => Promise<T> | T,
  fallback: T,
  timeoutMs: number = DEFAULT_AI_TIMEOUT.decisionTimeout,
  operationName: string = "operation"
): Promise<T> {
  return new Promise((resolve) => {
    let resolved = false;

    // Timeout handler
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(
          `[AI Safety] Timeout (${timeoutMs}ms) on: ${operationName}`
        );
        resolve(fallback);
      }
    }, timeoutMs);

    // Execute operation
    try {
      const result = operation();

      if (result instanceof Promise) {
        result
          .then((value) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              resolve(value);
            }
          })
          .catch((error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              console.error(`[AI Safety] Error in ${operationName}:`, error);
              resolve(fallback);
            }
          });
      } else {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(result);
        }
      }
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        console.error(`[AI Safety] Sync error in ${operationName}:`, error);
        resolve(fallback);
      }
    }
  });
}

/**
 * Wrapper síncrono com try-catch
 */
export function safeExecute<T>(
  operation: () => T,
  fallback: T,
  operationName: string = "operation"
): T {
  try {
    return operation();
  } catch (error) {
    console.error(`[AI Safety] Error in ${operationName}:`, error);
    return fallback;
  }
}

/**
 * Iterator com limite de iterações
 * Previne loops infinitos
 */
export class SafeIterator {
  private count: number = 0;
  private readonly maxIterations: number;
  private readonly name: string;

  constructor(
    maxIterations: number = DEFAULT_AI_TIMEOUT.maxIterations,
    name: string = "iterator"
  ) {
    this.maxIterations = maxIterations;
    this.name = name;
  }

  /**
   * Retorna true se pode continuar iterando
   */
  canContinue(): boolean {
    this.count++;
    if (this.count > this.maxIterations) {
      console.warn(
        `[AI Safety] Max iterations (${this.maxIterations}) reached in: ${this.name}`
      );
      return false;
    }
    return true;
  }

  /**
   * Reset do contador
   */
  reset(): void {
    this.count = 0;
  }

  /**
   * Retorna contagem atual
   */
  getCount(): number {
    return this.count;
  }
}

/**
 * Limita o tamanho de arrays para processamento
 */
export function limitArray<T>(
  array: T[],
  maxSize: number,
  name: string = "array"
): T[] {
  if (array.length > maxSize) {
    console.warn(
      `[AI Safety] Limiting ${name} from ${array.length} to ${maxSize} items`
    );
    return array.slice(0, maxSize);
  }
  return array;
}

/**
 * Valida que um valor está em um range seguro
 */
export function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Valida que uma posição está dentro do mapa
 */
export function isValidPosition(
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    x < mapWidth &&
    y >= 0 &&
    y < mapHeight
  );
}

/**
 * Wrapper para validar decisões da IA
 */
export function validateDecision(
  decision: AIDecision | null | undefined
): AIDecision {
  if (!decision) {
    return getFallbackDecision("null or undefined decision");
  }

  if (!decision.type) {
    return getFallbackDecision("missing decision type");
  }

  // Validar tipos de decisão conhecidos
  const validTypes = ["ATTACK", "MOVE", "SKILL", "SPELL", "DASH", "PASS"];
  if (!validTypes.includes(decision.type)) {
    return getFallbackDecision(`invalid decision type: ${decision.type}`);
  }

  // Validar coordenadas se for movimento
  if (decision.type === "MOVE") {
    if (
      decision.targetPosition &&
      (!Number.isFinite(decision.targetPosition.x) ||
        !Number.isFinite(decision.targetPosition.y))
    ) {
      return getFallbackDecision("invalid move coordinates");
    }
  }

  return decision;
}

/**
 * Rate limiter simples para evitar spam de ações
 */
export class ActionRateLimiter {
  private lastActionTime: number = 0;
  private readonly minInterval: number;

  constructor(minIntervalMs: number = 100) {
    this.minInterval = minIntervalMs;
  }

  canAct(): boolean {
    const now = Date.now();
    if (now - this.lastActionTime < this.minInterval) {
      return false;
    }
    this.lastActionTime = now;
    return true;
  }
}

/**
 * Logger de segurança com throttling
 */
class SafetyLogger {
  private logCounts: Map<string, number> = new Map();
  private readonly maxLogsPerKey: number = 5;
  private readonly resetInterval: number = 60000; // 1 minuto

  constructor() {
    // Reset periódico
    setInterval(() => {
      this.logCounts.clear();
    }, this.resetInterval);
  }

  warn(key: string, message: string): void {
    const count = this.logCounts.get(key) ?? 0;
    if (count < this.maxLogsPerKey) {
      console.warn(`[AI Safety] ${message}`);
      this.logCounts.set(key, count + 1);
    } else if (count === this.maxLogsPerKey) {
      console.warn(`[AI Safety] (suppressing further "${key}" warnings)`);
      this.logCounts.set(key, count + 1);
    }
  }

  error(key: string, message: string, error?: unknown): void {
    const count = this.logCounts.get(key) ?? 0;
    if (count < this.maxLogsPerKey) {
      console.error(`[AI Safety] ${message}`, error ?? "");
      this.logCounts.set(key, count + 1);
    }
  }
}

export const safetyLogger = new SafetyLogger();
