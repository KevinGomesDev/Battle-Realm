// src/lib/auth/rate-limiter.ts

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number | null;
}

/**
 * Rate Limiter simples em memória
 * Em produção, use Redis para ambientes distribuídos
 */
class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();

  // Configurações
  private readonly MAX_ATTEMPTS = 5; // Máximo de tentativas
  private readonly WINDOW_MS = 60 * 1000; // Janela de 1 minuto
  private readonly BLOCK_DURATION_MS = 5 * 60 * 1000; // Bloqueio de 5 minutos

  // Cleanup automático a cada 10 minutos
  constructor() {
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Verifica se um identificador pode fazer uma tentativa
   * @param identifier - IP, username ou combinação
   * @returns { allowed: boolean, retryAfter?: number }
   */
  check(identifier: string): {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
  } {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    // Sem registro anterior
    if (!entry) {
      return { allowed: true, remaining: this.MAX_ATTEMPTS };
    }

    // Está bloqueado?
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Bloqueio expirou, reset
    if (entry.blockedUntil && now >= entry.blockedUntil) {
      this.attempts.delete(identifier);
      return { allowed: true, remaining: this.MAX_ATTEMPTS };
    }

    // Janela de tempo expirou, reset
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      this.attempts.delete(identifier);
      return { allowed: true, remaining: this.MAX_ATTEMPTS };
    }

    // Ainda dentro da janela
    const remaining = this.MAX_ATTEMPTS - entry.attempts;
    return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
  }

  /**
   * Registra uma tentativa (chamado após tentativa falha)
   */
  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      this.attempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        blockedUntil: null,
      });
      return;
    }

    // Janela expirou, começar nova
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      this.attempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        blockedUntil: null,
      });
      return;
    }

    // Incrementar tentativas
    entry.attempts++;

    // Atingiu limite? Bloquear
    if (entry.attempts >= this.MAX_ATTEMPTS) {
      entry.blockedUntil = now + this.BLOCK_DURATION_MS;
      console.log(
        `[RATE-LIMIT] Bloqueado: ${identifier} por ${
          this.BLOCK_DURATION_MS / 1000
        }s`
      );
    }

    this.attempts.set(identifier, entry);
  }

  /**
   * Reseta tentativas após sucesso
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Limpa entradas antigas
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.attempts.entries()) {
      const isExpired = now - entry.firstAttempt > this.WINDOW_MS * 2;
      const isUnblocked =
        entry.blockedUntil && now > entry.blockedUntil + this.WINDOW_MS;

      if (isExpired || isUnblocked) {
        this.attempts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RATE-LIMIT] Cleanup: ${cleaned} entradas removidas`);
    }
  }
}

// Singleton
export const rateLimiter = new RateLimiter();
