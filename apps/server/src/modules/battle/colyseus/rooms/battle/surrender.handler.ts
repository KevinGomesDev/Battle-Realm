// surrender.handler.ts - Handlers de rendição e rematch
import type { Room } from "@colyseus/core";
import type { BattleSessionState, BattlePlayerSchema } from "../../schemas";

/**
 * Handler de rendição
 */
export function handleSurrender(
  userId: string,
  state: BattleSessionState,
  broadcast: Room<BattleSessionState>["broadcast"],
  checkBattleEnd: () => void
): void {
  const player = state.getPlayer(userId);
  if (!player || player.surrendered) return;

  player.surrendered = true;

  state.units.forEach((unit) => {
    if (unit.ownerId === userId) {
      unit.isAlive = false;
      unit.currentHp = 0;
    }
  });

  broadcast("battle:player_surrendered", { userId });

  checkBattleEnd();
}

/**
 * Handler de pedido de rematch
 */
export function handleRematchRequest(
  userId: string,
  state: BattleSessionState,
  rematchRequests: Set<string>,
  broadcast: Room<BattleSessionState>["broadcast"],
  resetForRematch: () => void
): void {
  if (state.status !== "ENDED") return;

  rematchRequests.add(userId);
  state.rematchRequests.push(userId);

  broadcast("battle:rematch_requested", { userId });

  const alivePlayers = state.players.filter(
    (p: BattlePlayerSchema) => !p.surrendered
  );
  if (rematchRequests.size >= alivePlayers.length && alivePlayers.length >= 2) {
    broadcast("battle:rematch_starting", {});
    resetForRematch();
  }
}

/**
 * Reseta a batalha para rematch
 */
export function resetForRematch(
  state: BattleSessionState,
  rematchRequests: Set<string>,
  startBattle: () => Promise<void>
): void {
  state.units.clear();
  state.obstacles.clear();
  state.actionOrder.clear();
  state.logs.clear();
  state.rematchRequests.clear();
  rematchRequests.clear();

  state.players.forEach((p: BattlePlayerSchema) => {
    p.surrendered = false;
  });

  state.status = "ACTIVE";
  state.round = 1;
  state.currentTurnIndex = 0;
  state.activeUnitId = "";
  state.winnerId = "";
  state.winReason = "";

  startBattle();
}
