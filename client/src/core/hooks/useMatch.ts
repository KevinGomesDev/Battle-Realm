// client/src/core/hooks/useMatch.ts
// Hook para partidas estratégicas usando Colyseus

import { useState, useEffect, useCallback, useRef } from "react";
import {
  colyseusService,
  type MatchState,
  type MatchPlayerState,
  type TerritoryState,
} from "../../services/colyseus.service";

interface UseMatchReturn {
  // Estado
  isInMatch: boolean;
  isLoading: boolean;
  error: string | null;
  matchState: MatchState | null;
  players: MatchPlayerState[];
  territories: TerritoryState[];

  // Match
  createMatch: (
    kingdomId: string,
    options?: { maxPlayers?: number }
  ) => Promise<void>;
  joinMatch: (roomId: string, kingdomId: string) => Promise<void>;
  leaveMatch: () => Promise<void>;
  setReady: () => void;

  // Preparação
  selectCapital: (territoryId: string) => void;

  // Turnos
  finishTurn: () => void;
  getResources: () => void;

  // Construção
  buildStructure: (territoryId: string, structureCode: string) => void;

  // Unidades
  moveUnit: (unitId: string, toTerritoryId: string) => void;
  recruitUnit: (territoryId: string, unitType: string) => void;

  // Crise
  investigateCrisis: (territoryId: string) => void;

  // Utilitários
  getTerritory: (territoryId: string) => TerritoryState | undefined;
  getPlayerTerritories: (userId: string) => TerritoryState[];
  clearError: () => void;
}

export function useMatch(): UseMatchReturn {
  const [isInMatch, setIsInMatch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [players, setPlayers] = useState<MatchPlayerState[]>([]);
  const [territories, setTerritories] = useState<TerritoryState[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handleStateChanged = (state: MatchState) => {
      if (!mountedRef.current) return;

      setMatchState(state);

      // Converter MapSchema para arrays
      if (state.players) {
        const playersArray: MatchPlayerState[] = [];
        state.players.forEach((player: MatchPlayerState) => {
          playersArray.push(player);
        });
        setPlayers(playersArray);
      }

      if (state.territories) {
        const territoriesArray: TerritoryState[] = [];
        state.territories.forEach((territory: TerritoryState) => {
          territoriesArray.push(territory);
        });
        setTerritories(territoriesArray);
      }
    };

    const handleLeft = () => {
      if (mountedRef.current) {
        setIsInMatch(false);
        setMatchState(null);
        setPlayers([]);
        setTerritories([]);
      }
    };

    const handleError = (data: { code?: number; message?: string }) => {
      if (mountedRef.current) {
        setError(data.message || "Erro no match");
        setIsLoading(false);
      }
    };

    colyseusService.on("match:state_changed", handleStateChanged);
    colyseusService.on("match:left", handleLeft);
    colyseusService.on("match:error", handleError);

    // Verificar se já está em match
    if (colyseusService.isInMatch()) {
      setIsInMatch(true);
      const state = colyseusService.getMatchState();
      if (state) {
        handleStateChanged(state);
      }
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("match:state_changed", handleStateChanged);
      colyseusService.off("match:left", handleLeft);
      colyseusService.off("match:error", handleError);
    };
  }, []);

  // Match Actions
  const createMatch = useCallback(
    async (kingdomId: string, options?: { maxPlayers?: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        await colyseusService.createMatch({
          kingdomId,
          maxPlayers: options?.maxPlayers,
        });
        setIsInMatch(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const joinMatch = useCallback(async (roomId: string, kingdomId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await colyseusService.joinMatch(roomId, kingdomId);
      setIsInMatch(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const leaveMatch = useCallback(async () => {
    await colyseusService.leaveMatch();
    setIsInMatch(false);
    setMatchState(null);
    setPlayers([]);
    setTerritories([]);
  }, []);

  const setReady = useCallback(() => {
    colyseusService.sendToMatch("match:ready", {});
  }, []);

  // Preparation Actions
  const selectCapital = useCallback((territoryId: string) => {
    colyseusService.sendToMatch("match:select_capital", { territoryId });
  }, []);

  // Turn Actions
  const finishTurn = useCallback(() => {
    colyseusService.sendToMatch("turn:finish", {});
  }, []);

  const getResources = useCallback(() => {
    colyseusService.sendToMatch("turn:get_resources", {});
  }, []);

  // Construction Actions
  const buildStructure = useCallback(
    (territoryId: string, structureCode: string) => {
      colyseusService.sendToMatch("territory:build", {
        territoryId,
        structureCode,
      });
    },
    []
  );

  // Unit Actions
  const moveUnit = useCallback((unitId: string, toTerritoryId: string) => {
    colyseusService.sendToMatch("unit:move", { unitId, toTerritoryId });
  }, []);

  const recruitUnit = useCallback((territoryId: string, unitType: string) => {
    colyseusService.sendToMatch("unit:recruit", { territoryId, unitType });
  }, []);

  // Crisis Actions
  const investigateCrisis = useCallback((territoryId: string) => {
    colyseusService.sendToMatch("crisis:investigate", { territoryId });
  }, []);

  // Utilities
  const getTerritory = useCallback(
    (territoryId: string): TerritoryState | undefined => {
      return territories.find((t) => t.id === territoryId);
    },
    [territories]
  );

  const getPlayerTerritories = useCallback(
    (userId: string): TerritoryState[] => {
      return territories.filter((t) => t.ownerId === userId);
    },
    [territories]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isInMatch,
    isLoading,
    error,
    matchState,
    players,
    territories,
    createMatch,
    joinMatch,
    leaveMatch,
    setReady,
    selectCapital,
    finishTurn,
    getResources,
    buildStructure,
    moveUnit,
    recruitUnit,
    investigateCrisis,
    getTerritory,
    getPlayerTerritories,
    clearError,
  };
}
