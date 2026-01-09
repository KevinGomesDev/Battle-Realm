// client/src/stores/battleStore.ts
// Store Zustand para Batalha PvP

import { create } from "zustand";
import {
  colyseusService,
  serializeSchemaObject,
  type BattleSessionState,
  type BattleUnitState,
  type BattlePlayerState,
  type BattleObstacleState,
} from "../services/colyseus.service";
import { BATTLE_COLORS } from "@boundless/shared/config";
import { CONDITION_COLORS } from "../config/colors.config";

// ============================================
// Types
// ============================================

interface BattleSessionResult {
  battleId: string;
  winnerId: string;
  winReason: string;
  finalUnits: BattleUnitState[];
}

export interface BattleComputed {
  battleId: string;
  round: number;
  turnTimer: number;
  activeUnitId: string | null;
  selectedUnitId: string | null;
  currentPlayerId: string | null;
  unitLocked: boolean;
  actionOrder: string[];
  kingdoms: Array<{
    ownerId: string;
    kingdomId: string;
    kingdomName: string;
    playerIndex: number;
    playerColor: string;
  }>;
  config: {
    grid: {
      width: number;
      height: number;
    };
    map: {
      obstacles: BattleObstacleState[];
      terrainType?: string;
      terrainColors?: {
        primary?: { hex: string };
        secondary?: { hex: string };
        accent?: { hex: string };
      };
    };
    colors: typeof BATTLE_COLORS;
    conditionColors: typeof CONDITION_COLORS;
  };
}

interface BattleState {
  // Battle
  battleId: string | null;
  isInBattle: boolean;
  status: string;
  round: number;
  turnTimer: number;
  gridWidth: number;
  gridHeight: number;

  // Players
  players: BattlePlayerState[];

  // Units
  units: BattleUnitState[];
  activeUnitId: string | null;
  selectedUnitId: string | null;
  currentPlayerId: string | null;
  unitLocked: boolean;
  actionOrder: string[];

  // Obstacles
  obstacles: BattleObstacleState[];

  // Result
  winnerId: string | null;
  winReason: string | null;
  rematchRequests: string[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Computed
  battle: BattleComputed | null;
  battleResult: BattleSessionResult | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

interface BattleActions {
  // Battle
  selectUnit: (unitId: string) => void;
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerId: string,
    targetPosition: { x: number; y: number },
    targetUnitId?: string
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
  leaveBattle: () => Promise<void>;

  // Utilities
  getUnit: (unitId: string) => BattleUnitState | undefined;
  getMyUnits: (userId: string) => BattleUnitState[];
  clearError: () => void;
  dismissBattleResult: () => Promise<void>;

  // State setters
  setBattleState: (state: Partial<BattleState>) => void;
  setUnits: (units: BattleUnitState[]) => void;
  updateUnit: (unit: BattleUnitState) => void;
  setPlayers: (players: BattlePlayerState[]) => void;
  setObstacles: (obstacles: BattleObstacleState[]) => void;
  setActiveUnit: (unitId: string | null) => void;
  setResult: (winnerId: string, winReason: string) => void;
  addRematchRequest: (userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initializeListeners: (userId: string | undefined) => () => void;
  computeBattle: (userId: string | undefined) => void;
}

const initialState: BattleState = {
  battleId: null,
  isInBattle: false,
  status: "IDLE",
  round: 0,
  turnTimer: 0,
  gridWidth: 12,
  gridHeight: 8,
  players: [],
  units: [],
  activeUnitId: null,
  selectedUnitId: null,
  currentPlayerId: null,
  unitLocked: false,
  actionOrder: [],
  obstacles: [],
  winnerId: null,
  winReason: null,
  rematchRequests: [],
  isLoading: false,
  error: null,
  battle: null,
  battleResult: null,
  rematchPending: false,
  opponentWantsRematch: false,
};

export const useBattleStore = create<BattleState & BattleActions>(
  (set, get) => ({
    ...initialState,

    // State setters
    setBattleState: (state) => set((prev) => ({ ...prev, ...state })),

    setUnits: (units) => set({ units }),

    updateUnit: (unit) =>
      set((state) => ({
        units: state.units.map((u) => (u.id === unit.id ? unit : u)),
      })),

    setPlayers: (players) => set({ players }),

    setObstacles: (obstacles) => set({ obstacles }),

    setActiveUnit: (activeUnitId) => set({ activeUnitId }),

    setResult: (winnerId, winReason) => set({ winnerId, winReason }),

    addRematchRequest: (userId) =>
      set((state) => ({
        rematchRequests: [...state.rematchRequests, userId],
      })),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error, isLoading: false }),

    reset: () => set(initialState),

    clearError: () => set({ error: null }),

    // Compute battle object for compatibility with BattleView
    computeBattle: (userId) => {
      const state = get();

      const battle: BattleComputed | null =
        state.isInBattle && state.battleId
          ? {
              battleId: state.battleId,
              round: state.round,
              turnTimer: state.turnTimer,
              activeUnitId: state.activeUnitId,
              selectedUnitId: state.selectedUnitId,
              currentPlayerId: state.currentPlayerId,
              unitLocked: state.unitLocked,
              actionOrder: state.actionOrder,
              kingdoms: state.players.map((p) => ({
                ownerId: p.oderId,
                kingdomId: p.kingdomId,
                kingdomName: p.kingdomName,
                playerIndex: p.playerIndex,
                playerColor: p.playerColor,
              })),
              config: {
                grid: {
                  width: state.gridWidth,
                  height: state.gridHeight,
                },
                map: {
                  obstacles: state.obstacles,
                },
                colors: BATTLE_COLORS,
                conditionColors: CONDITION_COLORS,
              },
            }
          : null;

      const battleResult: BattleSessionResult | null =
        state.winnerId && state.winReason && state.battleId
          ? {
              battleId: state.battleId,
              winnerId: state.winnerId,
              winReason: state.winReason,
              finalUnits: state.units,
            }
          : null;

      const rematchPending = userId
        ? state.rematchRequests.includes(userId)
        : false;
      const opponentWantsRematch = userId
        ? state.rematchRequests.some((id) => id !== userId)
        : false;

      set({ battle, battleResult, rematchPending, opponentWantsRematch });
    },

    // Battle Actions
    selectUnit: (unitId) => {
      colyseusService.sendToBattle("battle:select_unit", { unitId });
    },

    beginAction: (unitId) => {
      colyseusService.sendToBattle("battle:begin_action", { unitId });
    },

    moveUnit: (unitId, toX, toY) => {
      colyseusService.sendToBattle("battle:move", { unitId, toX, toY });
    },

    attackUnit: (attackerId, targetPosition, targetUnitId?: string) => {
      // FLUXO UNIFICADO: ATTACK passa pelo mesmo caminho das outras abilities
      colyseusService.sendToBattle("battle:execute_action", {
        actionName: "use_ability",
        unitId: attackerId,
        params: {
          abilityCode: "ATTACK",
          targetPosition,
          targetUnitId,
        },
      });
    },

    endAction: (unitId) => {
      colyseusService.sendToBattle("battle:end_action", { unitId });
    },

    executeAction: (actionName, unitId, params) => {
      colyseusService.sendToBattle("battle:execute_action", {
        actionName,
        unitId,
        params,
      });
    },

    castSpell: (unitId, spellCode, targetId, targetPosition) => {
      colyseusService.sendToBattle("battle:cast_spell", {
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });
    },

    surrender: () => {
      colyseusService.sendToBattle("battle:surrender", {});
    },

    requestRematch: () => {
      colyseusService.sendToBattle("battle:request_rematch", {});
    },

    leaveBattle: async () => {
      await colyseusService.leaveBattle();
      set(initialState);
    },

    // Utilities
    getUnit: (unitId) => {
      return get().units.find((u) => u.id === unitId);
    },

    getMyUnits: (userId) => {
      if (!userId) return [];
      return get().units.filter((u) => u.ownerId === userId);
    },

    dismissBattleResult: async () => {
      set({ winnerId: "", winReason: "" });

      try {
        await colyseusService.leaveBattle();
      } catch (err) {
        console.error("[Battle] Erro ao sair da battle:", err);
      }

      set(initialState);
    },

    initializeListeners: (userId) => {
      console.log("[Battle] initializeListeners chamado, userId:", userId);

      // Flag para evitar reconexões múltiplas simultâneas
      let isReconnecting = false;

      const handleStateChanged = (colyseusState: BattleSessionState) => {
        console.log("[Battle] handleStateChanged recebido:", {
          battleId: colyseusState.battleId,
          status: colyseusState.status,
          round: colyseusState.round,
          playersCount: colyseusState.players?.length ?? 0,
        });
        const unitsArray: BattleUnitState[] = [];
        if (colyseusState.units) {
          colyseusState.units.forEach((unit: BattleUnitState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            unitsArray.push(serializeSchemaObject(unit));
          });
        }

        const playersArray: BattlePlayerState[] = [];
        if (colyseusState.players) {
          colyseusState.players.forEach((player: BattlePlayerState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            playersArray.push(serializeSchemaObject(player));
          });
        }

        const obstaclesArray: BattleObstacleState[] = [];
        if (colyseusState.obstacles) {
          colyseusState.obstacles.forEach((obs: BattleObstacleState) => {
            // Serializar objeto Colyseus Schema para objeto JS puro
            obstaclesArray.push(serializeSchemaObject(obs));
          });
        }

        const hasActiveUnits = unitsArray.length > 0;
        const hasBattleData =
          !!colyseusState.battleId && colyseusState.round > 0;
        const isStatusActive = colyseusState.status === "ACTIVE";
        const isInBattle = isStatusActive || (hasActiveUnits && hasBattleData);

        set({
          battleId: colyseusState.battleId,
          isInBattle,
          isLoading: false, // Estado válido recebido, não está mais carregando
          status: colyseusState.status,
          round: colyseusState.round,
          turnTimer: colyseusState.turnTimer,
          gridWidth: colyseusState.gridWidth,
          gridHeight: colyseusState.gridHeight,
          activeUnitId: colyseusState.activeUnitId || null,
          selectedUnitId: colyseusState.selectedUnitId || null,
          currentPlayerId: colyseusState.currentPlayerId || null,
          unitLocked: colyseusState.unitLocked || false,
          actionOrder: Array.from(colyseusState.actionOrder || []),
          winnerId: colyseusState.winnerId || null,
          winReason: colyseusState.winReason || null,
          rematchRequests: Array.from(colyseusState.rematchRequests || []),
          units: unitsArray,
          players: playersArray,
          obstacles: obstaclesArray,
        });

        // Compute battle after state update
        // Se userId não foi passado, tenta pegar do localStorage
        const effectiveUserId =
          userId ||
          (() => {
            const userData = localStorage.getItem("auth_user");
            return userData ? JSON.parse(userData)?.id : undefined;
          })();
        get().computeBattle(effectiveUserId);
      };

      const handleLeft = () => {
        set(initialState);
      };

      const handleError = (data: { message?: string }) => {
        set({ error: data.message || "Erro na battle" });
      };

      const handleSessionActive = async (data: {
        type: string;
        roomId?: string;
        battleId?: string;
        kingdomId?: string;
        status?: string;
        source?: "memory" | "database";
        needsRestore?: boolean;
      }) => {
        console.log("[Battle] handleSessionActive recebido:", data);

        // Aceitar tanto BATTLE_SESSION quanto BATTLE_LOBBY
        if (data.type !== "BATTLE_SESSION" && data.type !== "BATTLE_LOBBY") {
          return;
        }

        const roomId = data.roomId || data.battleId;
        if (!roomId) {
          console.warn(
            "[Battle] Sessão ativa sem roomId, não é possível reconectar"
          );
          return;
        }

        // Já está conectado na mesma room - não fazer nada
        if (colyseusService.isInBattle()) {
          const currentRoom = colyseusService.getBattleRoom();
          if (currentRoom?.id === roomId) {
            console.log("[Battle] Já conectado à room:", roomId);
            set({ battleId: roomId, isLoading: false });
            return;
          }
        }

        // Evitar reconexões múltiplas simultâneas
        if (isReconnecting) {
          console.log("[Battle] Já está reconectando, ignorando...");
          return;
        }

        set({ battleId: roomId, isLoading: true });
        isReconnecting = true;

        try {
          let kingdomId = data.kingdomId;

          if (!kingdomId) {
            const userData = localStorage.getItem("auth_user");
            const authUser = userData ? JSON.parse(userData) : null;
            const selectedKingdom = localStorage.getItem("selected_kingdom");
            kingdomId = selectedKingdom
              ? JSON.parse(selectedKingdom)?.id
              : authUser?.kingdoms?.[0]?.id;
          }

          if (!kingdomId) {
            console.error(
              "[Battle] Não foi possível encontrar kingdomId para reconexão"
            );
            set({
              error: "Reino não encontrado para reconexão",
              isLoading: false,
            });
            isReconnecting = false;
            return;
          }

          // Se precisa restaurar do banco (room não existe), criar nova room
          if (data.needsRestore && data.source === "database") {
            console.log(
              "[Battle] Restaurando batalha do banco:",
              data.battleId
            );
            await colyseusService.restoreBattle(data.battleId!, kingdomId);
          } else {
            // Room existe em memória, apenas reconectar
            await colyseusService.joinBattleLobby(roomId, kingdomId);
          }

          // Não seta isLoading: false aqui - o handleStateChanged vai fazer isso
          // quando receber o estado válido do servidor
          console.log("[Battle] Reconexão completada, aguardando state sync");
        } catch (err: any) {
          console.error("[Battle] Erro ao reconectar:", err);
          set({ error: err.message || "Erro ao reconectar", isLoading: false });
        } finally {
          isReconnecting = false;
        }
      };

      // Handler para quando a batalha é iniciada (garante re-sync do estado)
      // O servidor agora envia o estado completo serializado no broadcast
      const handleBattleStarted = (data: any) => {
        console.log("[Battle] battle:started recebido com estado:", {
          battleId: data?.battleId,
          status: data?.status,
          round: data?.round,
          currentPlayerId: data?.currentPlayerId,
          activeUnitId: data?.activeUnitId,
          actionOrderLength: data?.actionOrder?.length ?? 0,
          unitsCount: data?.units ? Object.keys(data.units).length : 0,
          playersCount: data?.players?.length ?? 0,
        });

        if (!data || !data.battleId) {
          console.warn("[Battle] battle:started sem dados válidos");
          return;
        }

        // Converter unidades de objeto para array
        const unitsArray: BattleUnitState[] = [];
        if (data.units) {
          Object.values(data.units).forEach((unit: any) => {
            console.log("[Battle] Unidade recebida:", {
              id: unit.id,
              name: unit.name,
              ownerId: unit.ownerId,
              features: unit.features,
              featuresLength: unit.features?.length ?? 0,
              spells: unit.spells,
              spellsLength: unit.spells?.length ?? 0,
              movesLeft: unit.movesLeft,
              actionsLeft: unit.actionsLeft,
            });
            unitsArray.push(unit);
          });
        }

        console.log("[Battle] Total unidades processadas:", unitsArray.length);
        console.log(
          "[Battle] Primeira unidade features:",
          unitsArray[0]?.features
        );

        const playersArray: BattlePlayerState[] = data.players || [];
        const obstaclesArray: BattleObstacleState[] = data.obstacles || [];

        set({
          battleId: data.battleId,
          isInBattle: true,
          status: data.status,
          round: data.round,
          turnTimer: data.turnTimer,
          gridWidth: data.gridWidth,
          gridHeight: data.gridHeight,
          activeUnitId: data.activeUnitId || null,
          selectedUnitId: data.selectedUnitId || null,
          currentPlayerId: data.currentPlayerId || null,
          unitLocked: data.unitLocked || false,
          actionOrder: data.actionOrder || [],
          winnerId: data.winnerId || null,
          winReason: data.winReason || null,
          rematchRequests: data.rematchRequests || [],
          units: unitsArray,
          players: playersArray,
          obstacles: obstaclesArray,
        });

        // Compute battle after state update
        const effectiveUserId =
          userId ||
          (() => {
            const userData = localStorage.getItem("auth_user");
            return userData ? JSON.parse(userData)?.id : undefined;
          })();
        get().computeBattle(effectiveUserId);
      };

      // Handler para reconexão em batalha já iniciada
      // O servidor agora envia o estado completo serializado na mensagem
      const handleBattleReconnected = (data: any) => {
        console.log("[Battle] battle:reconnected recebido com estado:", {
          success: data?.success,
          battleId: data?.battleId,
          status: data?.status,
          round: data?.round,
          unitsCount: data?.units ? Object.keys(data.units).length : 0,
          playersCount: data?.players?.length ?? 0,
        });

        // Se a mensagem contém o estado completo, usar diretamente
        if (data && data.battleId) {
          // Converter unidades de objeto para array
          const unitsArray: BattleUnitState[] = [];
          if (data.units) {
            Object.values(data.units).forEach((unit: any) => {
              unitsArray.push(unit);
            });
          }

          const playersArray: BattlePlayerState[] = data.players || [];
          const obstaclesArray: BattleObstacleState[] = data.obstacles || [];

          set({
            battleId: data.battleId,
            isInBattle: true,
            isLoading: false,
            status: data.status,
            round: data.round,
            turnTimer: data.turnTimer,
            gridWidth: data.gridWidth,
            gridHeight: data.gridHeight,
            activeUnitId: data.activeUnitId || null,
            selectedUnitId: data.selectedUnitId || null,
            currentPlayerId: data.currentPlayerId || null,
            unitLocked: data.unitLocked || false,
            actionOrder: data.actionOrder || [],
            winnerId: data.winnerId || null,
            winReason: data.winReason || null,
            rematchRequests: data.rematchRequests || [],
            units: unitsArray,
            players: playersArray,
            obstacles: obstaclesArray,
          });

          // Compute battle after state update
          const effectiveUserId =
            userId ||
            (() => {
              const userData = localStorage.getItem("auth_user");
              return userData ? JSON.parse(userData)?.id : undefined;
            })();
          get().computeBattle(effectiveUserId);
          return;
        }

        // Fallback: tentar ler do estado do Colyseus (compatibilidade)
        console.log("[Battle] Fallback: tentando ler do Colyseus state");
        const battleState = colyseusService.getBattleState();
        if (battleState && battleState.battleId) {
          handleStateChanged(battleState);
        }
      };

      // Handler para atualização do timer
      const handleTimerUpdate = (data: { turnTimer: number }) => {
        set({ turnTimer: data.turnTimer });
      };

      // Handler para movimento de unidade
      const handleUnitMoved = (data: {
        unitId: string;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
        movesLeft: number;
      }) => {
        console.log("[Battle] unit_moved:", data);
        set((state) => ({
          units: state.units.map((u) =>
            u.id === data.unitId
              ? {
                  ...u,
                  posX: data.toX,
                  posY: data.toY,
                  movesLeft: data.movesLeft,
                }
              : u
          ),
        }));
      };

      // Handler para movimento por esquiva (dodge)
      const handleUnitDodged = (data: {
        unitId: string;
        fromX: number;
        fromY: number;
        toX: number;
        toY: number;
      }) => {
        console.log("[Battle] unit_dodged:", data);
        set((state) => ({
          units: state.units.map((u) =>
            u.id === data.unitId
              ? {
                  ...u,
                  posX: data.toX,
                  posY: data.toY,
                }
              : u
          ),
        }));
      };

      // Handler para mudança de turno
      const handleTurnChanged = (data: {
        unitId: string;
        playerId: string;
        round: number;
        turnTimer: number;
        unitUpdated?: {
          movesLeft: number;
          actionsLeft: number;
          attacksLeftThisTurn: number;
          hasStartedAction: boolean;
        };
      }) => {
        console.log("[Battle] turn_changed:", data);

        // Atualizar estado global
        set({
          activeUnitId: data.unitId,
          currentPlayerId: data.playerId,
          round: data.round,
          turnTimer: data.turnTimer,
        });

        // Atualizar dados da unidade que recebeu o turno
        if (data.unitUpdated) {
          set((state) => ({
            units: state.units.map((u) =>
              u.id === data.unitId
                ? {
                    ...u,
                    movesLeft: data.unitUpdated!.movesLeft,
                    actionsLeft: data.unitUpdated!.actionsLeft,
                    attacksLeftThisTurn: data.unitUpdated!.attacksLeftThisTurn,
                    hasStartedAction: data.unitUpdated!.hasStartedAction,
                  }
                : u
            ),
          }));
        }

        // Recompute battle
        const effectiveUserId =
          userId ||
          (() => {
            const userData = localStorage.getItem("auth_user");
            return userData ? JSON.parse(userData)?.id : undefined;
          })();
        get().computeBattle(effectiveUserId);
      };

      // Handler para ataque de unidade
      const handleUnitAttacked = (data: {
        attackerId: string;
        targetId: string;
        damage: number;
        targetHp: number;
        targetMaxHp: number;
        targetDied: boolean;
        targetUpdated?: {
          currentHp: number;
          physicalProtection: number;
          magicalProtection: number;
          isAlive: boolean;
        };
        attackerUpdated?: {
          actionsLeft: number;
          attacksLeftThisTurn: number;
        };
      }) => {
        console.log("[Battle] unit_attacked:", data);
        set((state) => ({
          units: state.units.map((u) => {
            // Atualizar alvo
            if (u.id === data.targetId) {
              // Usar targetUpdated se disponível, senão fallback para campos antigos
              if (data.targetUpdated) {
                return {
                  ...u,
                  currentHp: data.targetUpdated.currentHp,
                  physicalProtection: data.targetUpdated.physicalProtection,
                  magicalProtection: data.targetUpdated.magicalProtection,
                  isAlive: data.targetUpdated.isAlive,
                };
              }
              return {
                ...u,
                currentHp: data.targetHp,
                isAlive: !data.targetDied,
              };
            }
            // Atualizar atacante
            if (u.id === data.attackerId && data.attackerUpdated) {
              return {
                ...u,
                actionsLeft: data.attackerUpdated.actionsLeft,
                attacksLeftThisTurn: data.attackerUpdated.attacksLeftThisTurn,
              };
            }
            return u;
          }),
        }));
      };

      // Handler para início de ação
      const handleActionStarted = (data: { unitId: string }) => {
        console.log("[Battle] action_started:", data);
        set((state) => ({
          units: state.units.map((u) =>
            u.id === data.unitId ? { ...u, hasStartedAction: true } : u
          ),
        }));
      };

      // Handler para skill usada - atualiza recursos da unidade
      const handleSkillUsed = (data: {
        casterUnitId: string;
        skillCode: string;
        casterUpdated?: {
          actionsLeft: number;
          movesLeft: number;
          currentHp: number;
          currentMana: number;
          attacksLeftThisTurn: number;
        };
      }) => {
        console.log("[Battle] skill_used:", data);
        if (data.casterUpdated) {
          set((state) => ({
            units: state.units.map((u) =>
              u.id === data.casterUnitId
                ? {
                    ...u,
                    actionsLeft: data.casterUpdated!.actionsLeft,
                    movesLeft: data.casterUpdated!.movesLeft,
                    currentHp: data.casterUpdated!.currentHp,
                    currentMana: data.casterUpdated!.currentMana,
                    attacksLeftThisTurn:
                      data.casterUpdated!.attacksLeftThisTurn,
                  }
                : u
            ),
          }));
        }
      };

      // Handler para fim de batalha
      const handleBattleEnded = (data: {
        winnerId: string;
        winReason: string;
      }) => {
        console.log("[Battle] battle_ended:", data);
        set({
          winnerId: data.winnerId,
          winReason: data.winReason,
          status: "ENDED",
        });
      };

      // Handler para esquiva - atualiza recursos do atacante
      const handleAttackDodged = (data: {
        attackerId: string;
        targetId: string;
        attackerUpdated?: {
          actionsLeft: number;
          attacksLeftThisTurn: number;
        };
      }) => {
        console.log("[Battle] attack_dodged:", data);
        if (data.attackerUpdated) {
          set((state) => ({
            units: state.units.map((u) =>
              u.id === data.attackerId
                ? {
                    ...u,
                    actionsLeft: data.attackerUpdated!.actionsLeft,
                    attacksLeftThisTurn:
                      data.attackerUpdated!.attacksLeftThisTurn,
                  }
                : u
            ),
          }));
        }
      };

      // Handler para ataque no ar (miss) - atualiza recursos do atacante
      const handleAttackMissed = (data: {
        attackerId: string;
        targetPosition: { x: number; y: number };
        message: string;
        actionsLeft: number;
        attacksLeftThisTurn: number;
      }) => {
        console.log("[Battle] attack_missed:", data);
        set((state) => ({
          units: state.units.map((u) =>
            u.id === data.attackerId
              ? {
                  ...u,
                  actionsLeft: data.actionsLeft,
                  attacksLeftThisTurn: data.attacksLeftThisTurn,
                }
              : u
          ),
        }));
      };

      // Handler para lobby:joined - quando entra no lobby
      const handleLobbyJoined = (data: {
        lobbyId: string;
        playerIndex: number;
        players: any[];
      }) => {
        console.log("[Battle] lobby:joined recebido:", data);
        set({
          battleId: data.lobbyId,
          isLoading: false,
          // isInBattle fica false até a batalha começar
        });
      };

      // Handler para lobby:reconnected - quando reconecta ao lobby
      const handleLobbyReconnected = (data: {
        lobbyId: string;
        playerIndex: number;
        players: any[];
      }) => {
        console.log("[Battle] lobby:reconnected recebido:", data);
        set({
          battleId: data.lobbyId,
          isLoading: false,
        });
      };

      colyseusService.on("battle:state_changed", handleStateChanged);
      colyseusService.on("battle:left", handleLeft);
      colyseusService.on("battle:error", handleError);
      colyseusService.on("session:active", handleSessionActive);
      colyseusService.on("battle:lobby:joined", handleLobbyJoined);
      colyseusService.on("battle:lobby:reconnected", handleLobbyReconnected);
      colyseusService.on("battle:battle:started", handleBattleStarted);
      colyseusService.on("battle:battle:reconnected", handleBattleReconnected);
      colyseusService.on("battle:battle:timer_update", handleTimerUpdate);
      colyseusService.on("battle:battle:unit_moved", handleUnitMoved);
      colyseusService.on("battle:battle:unit_dodged", handleUnitDodged);
      colyseusService.on("battle:battle:turn_changed", handleTurnChanged);
      colyseusService.on("battle:battle:unit_attacked", handleUnitAttacked);
      colyseusService.on("battle:battle:attack_dodged", handleAttackDodged);
      colyseusService.on("battle:battle:attack_missed", handleAttackMissed);
      colyseusService.on("battle:battle:action_started", handleActionStarted);
      colyseusService.on("battle:battle:skill_used", handleSkillUsed);
      colyseusService.on("battle:battle:ended", handleBattleEnded);

      // Check if already in battle
      if (colyseusService.isInBattle()) {
        const BattleState = colyseusService.getBattleState();
        if (BattleState) {
          handleStateChanged(BattleState);
        }
      }

      return () => {
        colyseusService.off("battle:state_changed", handleStateChanged);
        colyseusService.off("battle:left", handleLeft);
        colyseusService.off("battle:error", handleError);
        colyseusService.off("session:active", handleSessionActive);
        colyseusService.off("battle:lobby:joined", handleLobbyJoined);
        colyseusService.off("battle:lobby:reconnected", handleLobbyReconnected);
        colyseusService.off("battle:battle:started", handleBattleStarted);
        colyseusService.off(
          "battle:battle:reconnected",
          handleBattleReconnected
        );
        colyseusService.off("battle:battle:timer_update", handleTimerUpdate);
        colyseusService.off("battle:battle:unit_moved", handleUnitMoved);
        colyseusService.off("battle:battle:unit_dodged", handleUnitDodged);
        colyseusService.off("battle:battle:turn_changed", handleTurnChanged);
        colyseusService.off("battle:battle:unit_attacked", handleUnitAttacked);
        colyseusService.off("battle:battle:attack_dodged", handleAttackDodged);
        colyseusService.off("battle:battle:attack_missed", handleAttackMissed);
        colyseusService.off(
          "battle:battle:action_started",
          handleActionStarted
        );
        colyseusService.off("battle:battle:skill_used", handleSkillUsed);
        colyseusService.off("battle:battle:ended", handleBattleEnded);
      };
    },
  })
);
