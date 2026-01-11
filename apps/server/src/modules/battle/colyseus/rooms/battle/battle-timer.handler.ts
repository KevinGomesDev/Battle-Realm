// battle-timer.handler.ts - Timer da batalha e verificação de fim de partida
import type { Delayed, Room } from "@colyseus/core";
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";

/**
 * Contexto do timer da batalha
 */
export interface BattleTimerContext {
  state: BattleSessionState;
  roomId: string;
  clock: Room<BattleSessionState>["clock"];
  broadcast: Room<BattleSessionState>["broadcast"];
  onTimeExpired: () => void;
  onBattleEnd: (winnerId: string | undefined, reason: string) => void;
}

/**
 * Manager do timer da batalha
 * Responsável por:
 * - Decrementar o timer a cada segundo
 * - Verificar condição de fim de batalha a cada segundo
 * - Notificar quando o tempo expirar
 */
export class BattleTimerManager {
  private timer: Delayed | null = null;
  private context: BattleTimerContext;

  constructor(context: BattleTimerContext) {
    this.context = context;
  }

  /**
   * Inicia o timer da batalha
   * O timer decrementa a cada segundo e verifica fim de batalha
   */
  start(): void {
    this.stop();

    const { state, clock, broadcast } = this.context;

    this.timer = clock.setInterval(() => {
      // Se a batalha não está mais ativa, parar o timer
      if (state.status !== "ACTIVE") {
        this.stop();
        return;
      }

      // Verificar fim de batalha a cada segundo
      const battleEnded = this.checkBattleEnd();
      if (battleEnded) {
        return; // Timer já foi limpo no checkBattleEnd
      }

      // Decrementar timer
      state.turnTimer--;

      // Broadcast timer update a cada segundo
      broadcast("battle:timer_update", { turnTimer: state.turnTimer });

      // Verificar se o tempo expirou
      if (state.turnTimer <= 0) {
        this.context.onTimeExpired();
      }
    }, 1000);
  }

  /**
   * Para o timer
   */
  stop(): void {
    if (this.timer) {
      this.timer.clear();
      this.timer = null;
    }
  }

  /**
   * Retorna o timer atual (para compatibilidade)
   */
  getTimer(): Delayed | null {
    return this.timer;
  }

  /**
   * Verifica se a batalha terminou
   * Chamado a cada segundo pelo timer
   * @returns true se a batalha terminou
   */
  private checkBattleEnd(): boolean {
    const { state, roomId, broadcast, onBattleEnd } = this.context;

    // Já terminou - não verificar novamente
    if (state.status === "ENDED") {
      return true;
    }

    const playersAlive: string[] = [];
    const playerUnitsInfo: Record<string, { alive: number; total: number }> =
      {};

    state.players.forEach((player: BattlePlayerSchema) => {
      if (player.surrendered) {
        return;
      }

      // Contar unidades para debug
      let aliveCount = 0;
      let totalCount = 0;
      state.units.forEach((unit) => {
        if (unit.ownerId === player.oderId) {
          totalCount++;
          if (unit.isAlive) aliveCount++;
        }
      });
      playerUnitsInfo[player.oderId] = { alive: aliveCount, total: totalCount };

      if (state.playerHasAliveUnits(player.oderId)) {
        playersAlive.push(player.oderId);
      }
    });

    // Só logar se houver mudança significativa (para evitar spam)
    if (playersAlive.length <= 1) {
    }

    if (playersAlive.length <= 1) {
      state.status = "ENDED";

      if (playersAlive.length === 1) {
        state.winnerId = playersAlive[0];
        state.winReason = "Todas as unidades inimigas foram derrotadas";
      } else {
        state.winReason = "Empate - todos foram derrotados";
      }

      // Parar o timer
      this.stop();

      // Callback para ações pós-batalha (persistência, etc)
      onBattleEnd(state.winnerId || undefined, state.winReason || "");

      // Broadcast do fim
      broadcast("battle:ended", {
        winnerId: state.winnerId,
        winReason: state.winReason,
      });

      return true;
    }

    return false;
  }

  /**
   * Força uma verificação imediata de fim de batalha
   * Útil após ações que podem causar morte (surrender)
   * @returns true se a batalha terminou
   */
  forceCheckBattleEnd(): boolean {
    return this.checkBattleEnd();
  }
}
