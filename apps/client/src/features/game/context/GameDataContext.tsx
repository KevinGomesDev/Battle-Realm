import React, { createContext, useReducer, useCallback } from "react";
import type {
  GameDataState,
  GameDataContextType,
  GameDataAction,
  TerrainType,
  StructureInfo,
} from "../types/game-data.types";
import { colyseusService } from "../../../services/colyseus.service";

const initialState: GameDataState = {
  terrains: {},
  structures: [],
  isLoading: false,
  error: null,
};

function gameDataReducer(
  state: GameDataState,
  action: GameDataAction
): GameDataState {
  switch (action.type) {
    case "SET_TERRAINS":
      return { ...state, terrains: action.payload };
    case "SET_STRUCTURES":
      return { ...state, structures: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const GameDataContext = createContext<GameDataContextType | undefined>(
  undefined
);

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameDataReducer, initialState);

  const loadTerrains = useCallback(async (): Promise<
    Record<string, TerrainType>
  > => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const terrains = await colyseusService.sendAndWait<
        Record<string, TerrainType>
      >("game:get_terrains", undefined, "game:terrains_data");

      dispatch({ type: "SET_TERRAINS", payload: terrains });
      dispatch({ type: "SET_LOADING", payload: false });
      return terrains;
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error?.message });
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  }, []);

  const loadStructures = useCallback(async (): Promise<StructureInfo[]> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const data = await colyseusService.sendAndWait<
        StructureInfo[] | { structures: StructureInfo[] }
      >("game:get_structures", {}, "game:structures_data");

      const structures = Array.isArray(data) ? data : data.structures || [];

      dispatch({ type: "SET_STRUCTURES", payload: structures });
      dispatch({ type: "SET_LOADING", payload: false });
      return structures;
    } catch (error: any) {
      dispatch({ type: "SET_ERROR", payload: error?.message });
      dispatch({ type: "SET_LOADING", payload: false });
      throw error;
    }
  }, []);

  const contextValue: GameDataContextType = {
    state,
    loadTerrains,
    loadStructures,
  };

  return (
    <GameDataContext.Provider value={contextValue}>
      {children}
    </GameDataContext.Provider>
  );
}
