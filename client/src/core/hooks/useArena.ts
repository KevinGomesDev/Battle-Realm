// client/src/core/hooks/useArena.ts
// Hook para arena/batalha usando Colyseus

import { useState, useEffect, useCallback, useRef } from "react";
import {
  colyseusService,
  type ArenaBattleState,
  type BattleUnitState,
  type BattlePlayerState,
} from "../../services/colyseus.service";

interface UseArenaReturn {
  // Estado
  isInArena: boolean;
  isLoading: boolean;
  error: string | null;
  battleState: ArenaBattleState | null;
  units: BattleUnitState[];
  players: BattlePlayerState[];
  activeUnit: BattleUnitState | null;

  // Lobby
  createLobby: (
    kingdomId: string,
    options?: { maxPlayers?: number; vsBot?: boolean }
  ) => Promise<void>;
  joinLobby: (roomId: string, kingdomId: string) => Promise<void>;
  leaveLobby: () => Promise<void>;
  setReady: () => void;
  startBattle: () => void;

  // Batalha
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerId: string,
    targetId?: string,
    targetObstacleId?: string
  ) => void;
  endAction: (unitId: string) => void;
  executeAction: (
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) => void;
  castSpell: (
    unitId: string,
    spellCode: string,
    targetId?: string,
    targetPosition?: { x: number; y: number }
  ) => void;
  surrender: () => void;
  requestRematch: () => void;

  // Utilitários
  getUnit: (unitId: string) => BattleUnitState | undefined;
  getMyUnits: (userId: string) => BattleUnitState[];
  clearError: () => void;
}

export function useArena(): UseArenaReturn {
  const [isInArena, setIsInArena] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battleState, setBattleState] = useState<ArenaBattleState | null>(null);
  const [units, setUnits] = useState<BattleUnitState[]>([]);
  const [players, setPlayers] = useState<BattlePlayerState[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handleStateChanged = (state: ArenaBattleState) => {
      if (!mountedRef.current) return;

      setBattleState(state);

      // Converter MapSchema para array
      if (state.units) {
        const unitsArray: BattleUnitState[] = [];
        state.units.forEach((unit: BattleUnitState) => {
          unitsArray.push(unit);
        });
        setUnits(unitsArray);
      }

      if (state.players) {
        const playersArray: BattlePlayerState[] = [];
        state.players.forEach((player: BattlePlayerState) => {
          playersArray.push(player);
        });
        setPlayers(playersArray);
      }
    };

    const handleLeft = () => {
      if (mountedRef.current) {
        setIsInArena(false);
        setBattleState(null);
        setUnits([]);
        setPlayers([]);
      }
    };

    const handleError = (data: { code?: number; message?: string }) => {
      if (mountedRef.current) {
        setError(data.message || "Erro na arena");
        setIsLoading(false);
      }
    };

    colyseusService.on("arena:state_changed", handleStateChanged);
    colyseusService.on("arena:left", handleLeft);
    colyseusService.on("arena:error", handleError);

    // Verificar se já está em arena
    if (colyseusService.isInArena()) {
      setIsInArena(true);
      const state = colyseusService.getArenaState();
      if (state) {
        handleStateChanged(state);
      }
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("arena:state_changed", handleStateChanged);
      colyseusService.off("arena:left", handleLeft);
      colyseusService.off("arena:error", handleError);
    };
  }, []);

  // Lobby Actions
  const createLobby = useCallback(
    async (
      kingdomId: string,
      options?: { maxPlayers?: number; vsBot?: boolean }
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        await colyseusService.createArenaLobby({
          kingdomId,
          maxPlayers: options?.maxPlayers,
          vsBot: options?.vsBot,
        });
        setIsInArena(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const joinLobby = useCallback(async (roomId: string, kingdomId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await colyseusService.joinArenaLobby(roomId, kingdomId);
      setIsInArena(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const leaveLobby = useCallback(async () => {
    await colyseusService.leaveArena();
    setIsInArena(false);
    setBattleState(null);
    setUnits([]);
    setPlayers([]);
  }, []);

  const setReady = useCallback(() => {
    colyseusService.sendToArena("lobby:ready", {});
  }, []);

  const startBattle = useCallback(() => {
    colyseusService.sendToArena("lobby:start", {});
  }, []);

  // Battle Actions
  const beginAction = useCallback((unitId: string) => {
    colyseusService.sendToArena("battle:begin_action", { unitId });
  }, []);

  const moveUnit = useCallback((unitId: string, toX: number, toY: number) => {
    colyseusService.sendToArena("battle:move", { unitId, toX, toY });
  }, []);

  const attackUnit = useCallback(
    (attackerId: string, targetId?: string, targetObstacleId?: string) => {
      colyseusService.sendToArena("battle:attack", {
        attackerId,
        targetId,
        targetObstacleId,
      });
    },
    []
  );

  const endAction = useCallback((unitId: string) => {
    colyseusService.sendToArena("battle:end_action", { unitId });
  }, []);

  const executeAction = useCallback(
    (actionName: string, unitId: string, params?: Record<string, unknown>) => {
      colyseusService.sendToArena("battle:execute_action", {
        actionName,
        unitId,
        params,
      });
    },
    []
  );

  const castSpell = useCallback(
    (
      unitId: string,
      spellCode: string,
      targetId?: string,
      targetPosition?: { x: number; y: number }
    ) => {
      colyseusService.sendToArena("battle:cast_spell", {
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });
    },
    []
  );

  const surrender = useCallback(() => {
    colyseusService.sendToArena("battle:surrender", {});
  }, []);

  const requestRematch = useCallback(() => {
    colyseusService.sendToArena("battle:request_rematch", {});
  }, []);

  // Utilities
  const getUnit = useCallback(
    (unitId: string): BattleUnitState | undefined => {
      return units.find((u) => u.id === unitId);
    },
    [units]
  );

  const getMyUnits = useCallback(
    (userId: string): BattleUnitState[] => {
      return units.filter((u) => u.ownerId === userId);
    },
    [units]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Computed
  const activeUnit = battleState?.activeUnitId
    ? units.find((u) => u.id === battleState.activeUnitId) || null
    : null;

  return {
    isInArena,
    isLoading,
    error,
    battleState,
    units,
    players,
    activeUnit,
    createLobby,
    joinLobby,
    leaveLobby,
    setReady,
    startBattle,
    beginAction,
    moveUnit,
    attackUnit,
    endAction,
    executeAction,
    castSpell,
    surrender,
    requestRematch,
    getUnit,
    getMyUnits,
    clearError,
  };
}
