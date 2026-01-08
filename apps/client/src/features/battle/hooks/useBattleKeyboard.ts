import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { useMovementKeys } from "../../../hooks/useHotkey";

interface UseBattleKeyboardOptions {
  selectedUnit: BattleUnit | null;
  isMyTurn: boolean;
  canMove: boolean;
  onMoveDirection: (dx: number, dy: number) => void;
  enabled?: boolean;
}

/**
 * Hook para controle WASD do movimento de unidades na batalha
 * Usa react-hotkeys-hook internamente
 */
export function useBattleKeyboard({
  selectedUnit,
  isMyTurn,
  canMove,
  onMoveDirection,
  enabled = true,
}: UseBattleKeyboardOptions): void {
  const canAct = enabled && !!selectedUnit && isMyTurn && canMove;

  useMovementKeys(
    {
      onUp: () => onMoveDirection(0, -1),
      onDown: () => onMoveDirection(0, 1),
      onLeft: () => onMoveDirection(-1, 0),
      onRight: () => onMoveDirection(1, 0),
    },
    {
      enabled: canAct,
      ignoreInputs: true,
    }
  );
}
