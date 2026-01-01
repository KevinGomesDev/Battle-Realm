import React, {
  createContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { socketService } from "../../../services/socket.service";
import { useAuth } from "../../auth";
import { useSession } from "../../../core";
import { useDiceRoll } from "../../dice-roll";
import { arenaReducer, initialArenaState } from "./arenaReducer";
import { arenaLog, battleLog, lobbyLog } from "../utils";
import type {
  ArenaContextType,
  ArenaLobby,
  ArenaBattle,
  ArenaConfig,
  LobbyCreatedResponse,
  LobbiesListResponse,
  PlayerJoinedResponse,
  BattleStartedResponse,
  UnitMovedResponse,
  UnitAttackedResponse,
  BattleEndedResponse,
  ArenaLobbyStatus,
  ArenaUnit,
} from "../types/arena.types";
import type { DiceRollPanelData, RollOutcome } from "../../dice-roll";

export const ArenaContext = createContext<ArenaContextType | null>(null);

interface ArenaProviderProps {
  children: ReactNode;
}

export const ArenaProvider: React.FC<ArenaProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(arenaReducer, initialArenaState);
  const { user } = useAuth();
  const { clearSession } = useSession();
  const { openRollPanel } = useDiceRoll();

  // Ref para acessar valores atuais nos handlers sem causar re-render do useEffect
  // IMPORTANTE: Atualizar sincronamente durante render, NÃO em useEffect!
  const stateRef = React.useRef(state);
  stateRef.current = state; // Atualiza a cada render

  // Ref para acessar openRollPanel no handler de socket
  const openRollPanelRef = React.useRef(openRollPanel);
  openRollPanelRef.current = openRollPanel;

  // Setup socket event listeners
  useEffect(() => {
    if (!user) return;

    arenaLog("🎮", "Inicializando Arena Provider", { userId: user.id });

    const handleLobbyCreated = (data: LobbyCreatedResponse) => {
      lobbyLog("✅", "LOBBY CRIADO", {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostKingdomName: data.hostKingdomName,
        status: data.status,
      });
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostUsername: user.username,
        hostKingdomName: data.hostKingdomName,
        status: data.status,
        createdAt: new Date(),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: true });
    };

    const handleLobbiesList = (data: LobbiesListResponse) => {
      lobbyLog("📋", "LISTA DE LOBBIES", {
        count: data.lobbies.length,
        lobbies: data.lobbies.map((l) => ({
          id: l.lobbyId,
          host: l.hostUsername,
          status: l.status,
        })),
      });
      dispatch({ type: "SET_LOBBIES", payload: data.lobbies });
    };

    const handlePlayerJoined = (data: PlayerJoinedResponse) => {
      lobbyLog("👤", "JOGADOR ENTROU NO LOBBY", {
        guestUserId: data.guestUserId,
        guestUsername: data.guestUsername,
        guestKingdomName: data.guestKingdomName,
        status: data.status,
      });
      // Só atualiza se já estiver em um lobby (para o host)
      // O guest recebe arena:lobby_joined separadamente
      if (stateRef.current.currentLobby) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            guestUserId: data.guestUserId,
            guestUsername: data.guestUsername,
            guestKingdomName: data.guestKingdomName,
            status: data.status,
          },
        });
      }
    };

    const handleLobbyJoined = (data: ArenaLobby) => {
      lobbyLog("🚪", "ENTROU NO LOBBY", {
        lobbyId: data.lobbyId,
        hostUsername: data.hostUsername,
        hostKingdomName: data.hostKingdomName,
      });
      dispatch({ type: "SET_CURRENT_LOBBY", payload: data });
      dispatch({ type: "SET_IS_HOST", payload: false });
    };

    const handleLobbyClosed = (data: { lobbyId: string; reason: string }) => {
      lobbyLog("🚫", "LOBBY FECHADO", {
        lobbyId: data.lobbyId,
        reason: data.reason,
      });
      dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
      dispatch({ type: "SET_IS_HOST", payload: false });
      dispatch({ type: "SET_ERROR", payload: data.reason });
    };

    const handlePlayerLeft = (data: {
      lobbyId: string;
      userId: string;
      status: ArenaLobbyStatus;
    }) => {
      lobbyLog("🚶", "JOGADOR SAIU DO LOBBY", {
        lobbyId: data.lobbyId,
        userId: data.userId,
        status: data.status,
      });
      if (stateRef.current.currentLobby?.lobbyId === data.lobbyId) {
        dispatch({
          type: "SET_CURRENT_LOBBY",
          payload: {
            ...stateRef.current.currentLobby,
            guestUserId: undefined,
            guestUsername: undefined,
            guestKingdomName: undefined,
            status: data.status,
          },
        });
      }
    };

    const handleBattleStarted = (data: BattleStartedResponse) => {
      battleLog("⚔️", "BATALHA INICIADA!", {
        battleId: data.battleId,
        gridSize: `${data.config.grid.width}x${data.config.grid.height}`,
        unitsCount: data.units.length,
        hostKingdom: data.hostKingdom.name,
        guestKingdom: data.guestKingdom.name,
        initiativeOrder: data.initiativeOrder,
        actionOrder: data.actionOrder,
      });
      battleLog(
        "🎯",
        "Unidades na batalha",
        data.units.map((u) => ({
          id: u.id,
          name: u.name,
          owner: u.ownerId,
          pos: `(${u.posX}, ${u.posY})`,
          hp: `${u.currentHp}/${u.vitality}`,
        }))
      );
      const battle: ArenaBattle = {
        battleId: data.battleId,
        lobbyId: data.lobbyId, // Salvar lobbyId para revanche
        config: data.config, // Configuração visual completa do servidor
        round: 1,
        status: "ACTIVE",
        currentTurnIndex: 0,
        currentPlayerId: data.actionOrder[0],
        actionOrder: data.actionOrder,
        initiativeOrder: data.initiativeOrder,
        units: data.units,
        hostKingdom: data.hostKingdom,
        guestKingdom: data.guestKingdom,
        turnTimer: 30, // Timer inicial (será sincronizado pelo servidor)
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    const handleActionStarted = (data: {
      battleId: string;
      unitId: string;
      movesLeft: number;
      actionsLeft: number;
    }) => {
      battleLog("🎬", "AÇÃO INICIADA", {
        battleId: data.battleId,
        unitId: data.unitId,
        movesLeft: data.movesLeft,
        actionsLeft: data.actionsLeft,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
          hasStartedAction: true,
        },
      });
      // Definir unidade ativa no turno
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              activeUnitId: data.unitId,
            }
          : null,
      });
    };

    const handleUnitMoved = (data: UnitMovedResponse) => {
      battleLog("🚶", "UNIDADE MOVEU", {
        unitId: data.unitId,
        from: `(${data.fromX}, ${data.fromY})`,
        to: `(${data.toX}, ${data.toY})`,
        movesLeft: data.movesLeft,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          posX: data.toX,
          posY: data.toY,
          movesLeft: data.movesLeft,
        },
      });
    };

    const handleUnitAttacked = (data: UnitAttackedResponse) => {
      battleLog("⚔️", "ATAQUE!", {
        attackerUnitId: data.attackerUnitId,
        targetUnitId: data.targetUnitId,
        damage: data.damage,
        targetHpAfter: data.targetHpAfter,
        targetProtection: data.targetProtection,
        damageType: data.damageType,
        rolls: data.rolls,
        diceCount: data.diceCount,
        attackerActionsLeft: data.attackerActionsLeft,
      });

      // === ABRIR PAINEL VISUAL DE ROLAGEM ===
      // Montar DiceRollResult para ataque
      const attackRoll = {
        diceCount: data.attackDiceCount,
        advantageMod: 0 as const,
        successThreshold: 4,
        diceResults: data.attackRolls.map((value) => ({
          value,
          isSuccess: value >= 4,
          isExplosion: value === 6,
        })),
        totalSuccesses: data.attackSuccesses,
        allRolls: data.attackRolls,
        success: data.attackSuccesses > 0,
        explosionCount: data.attackRolls.filter((v) => v === 6).length,
      };

      // Montar DiceRollResult para defesa
      const defenseRoll = {
        diceCount: data.defenseDiceCount,
        advantageMod: 0 as const,
        successThreshold: 4,
        diceResults: data.defenseRolls.map((value) => ({
          value,
          isSuccess: value >= 4,
          isExplosion: value === 6,
        })),
        totalSuccesses: data.defenseSuccesses,
        allRolls: data.defenseRolls,
        success: data.defenseSuccesses > 0,
        explosionCount: data.defenseRolls.filter((v) => v === 6).length,
      };

      // Montar outcome
      const outcome: RollOutcome = {
        attackerSuccesses: data.attackSuccesses,
        defenderSuccesses: data.defenseSuccesses,
        netSuccesses: data.attackSuccesses - data.defenseSuccesses,
        damageDealt: data.rawDamage,
        damageBlocked: data.damageReduction,
        finalDamage: data.finalDamage,
        isCritical: data.attackSuccesses >= 5,
        isHit: data.finalDamage > 0,
        isDodge: data.missed ?? false,
        isPartialBlock: data.defenseSuccesses > 0 && data.finalDamage > 0,
      };

      // Montar dados do painel
      const panelData: DiceRollPanelData = {
        battleId: data.battleId,
        actionId: `attack-${Date.now()}`,
        actionType: "attack",
        attacker: {
          id: data.attackerUnitId,
          name: data.attackerName,
          icon: data.attackerIcon,
          combat: data.attackerCombat,
          diceCount: data.attackDiceCount,
          advantageMod: 0,
          modifiers: [],
        },
        defender: {
          id: data.targetUnitId,
          name: data.targetName,
          icon: data.targetIcon,
          combat: data.targetCombat,
          diceCount: data.defenseDiceCount,
          advantageMod: 0,
          modifiers: [],
        },
        attackRoll,
        defenseRoll,
        outcome,
        damageType: data.damageType as "FISICO" | "MAGICO" | "VERDADEIRO",
      };

      // Abrir o painel visual
      openRollPanelRef.current({
        data: panelData,
        autoPlay: true,
        speedMultiplier: 1,
        onComplete: () => {
          // Atualizar estado após animação
          dispatch({
            type: "UPDATE_UNIT",
            payload: {
              id: data.targetUnitId,
              currentHp: data.targetHpAfter,
              // Atualizar proteções separadas
              physicalProtection: data.targetPhysicalProtection,
              magicalProtection: data.targetMagicalProtection,
              // Legado
              protection: data.targetProtection,
            },
          });
          dispatch({
            type: "UPDATE_UNIT",
            payload: {
              id: data.attackerUnitId,
              actionsLeft: data.attackerActionsLeft,
            },
          });
        },
      });
    };

    const handleUnitDefeated = (data: { battleId: string; unitId: string }) => {
      battleLog("💀", "UNIDADE DERROTADA!", {
        battleId: data.battleId,
        unitId: data.unitId,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: { id: data.unitId, isAlive: false },
      });
    };

    // Handler para Disparada (Dash)
    const handleUnitDashed = (data: {
      battleId: string;
      unitId: string;
      movesLeft: number;
      actionsLeft: number;
    }) => {
      battleLog("💨", "DISPARADA!", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          movesLeft: data.movesLeft,
          actionsLeft: data.actionsLeft,
        },
      });
      dispatch({
        type: "ADD_LOG",
        payload: {
          id: `log_${Date.now()}`,
          battleId: data.battleId,
          message: "💨 Disparada! Movimentação resetada.",
          timestamp: new Date(),
        },
      });
    };

    // Handler para Esquiva (Dodge)
    const handleUnitDodged = (data: {
      battleId: string;
      unitId: string;
      actionsLeft: number;
      conditions: string[];
    }) => {
      battleLog("🛡️", "ESQUIVA!", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionsLeft: data.actionsLeft,
          conditions: data.conditions,
        },
      });
      dispatch({
        type: "ADD_LOG",
        payload: {
          id: `log_${Date.now()}`,
          battleId: data.battleId,
          message: "🛡️ Esquiva! Entrou em modo defensivo.",
          timestamp: new Date(),
        },
      });
    };

    const handleProtectionRecovered = (data: {
      battleId: string;
      unitId: string;
      protection: number;
    }) => {
      battleLog("🛡️", "PROTEÇÃO RECUPERADA", {
        unitId: data.unitId,
        protection: data.protection,
      });
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          protection: data.protection,
          protectionBroken: false,
        },
      });
    };

    const handleNextPlayer = (data: {
      battleId: string;
      currentPlayerId: string;
      index: number;
    }) => {
      battleLog("🔄", "PRÓXIMO JOGADOR", {
        battleId: data.battleId,
        currentPlayerId: data.currentPlayerId,
        turnIndex: data.index,
      });
      // Resetar hasStartedAction de todas as unidades quando muda de jogador
      const updatedUnits = stateRef.current.units.map((u: ArenaUnit) => ({
        ...u,
        hasStartedAction: false,
        movesLeft: 0,
        actionsLeft: 0,
      }));
      dispatch({ type: "SET_UNITS", payload: updatedUnits });
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              currentPlayerId: data.currentPlayerId,
              currentTurnIndex: data.index,
              activeUnitId: undefined, // Resetar unidade ativa ao mudar jogador
            }
          : null,
      });
    };

    // Handler para sincronizar timer do turno (compartilhado pelo servidor)
    const handleTurnTimer = (data: {
      battleId: string;
      timer: number;
      currentPlayerId: string;
    }) => {
      // Atualiza o timer no estado da batalha
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? {
              ...stateRef.current.battle,
              turnTimer: data.timer,
              currentPlayerId: data.currentPlayerId,
            }
          : null,
      });
    };

    // Handler para quando a unidade finaliza o turno
    const handleUnitTurnEnded = (data: {
      battleId: string;
      unitId: string;
      actionMarks: number;
      currentHp: number;
      isAlive: boolean;
      conditions: string[];
    }) => {
      battleLog("⏹️", "TURNO FINALIZADO", data);
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: data.unitId,
          actionMarks: data.actionMarks,
          currentHp: data.currentHp,
          isAlive: data.isAlive,
          conditions: data.conditions,
        },
      });
    };

    const handleNewRound = (data: { battleId: string; round: number }) => {
      battleLog("🔔", "NOVA RODADA", {
        battleId: data.battleId,
        round: data.round,
      });
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? { ...stateRef.current.battle, round: data.round }
          : null,
      });
    };

    const handleBattleEnded = (data: BattleEndedResponse) => {
      battleLog("🏆", "BATALHA FINALIZADA!", {
        battleId: data.battleId,
        winnerId: data.winnerId,
        reason: data.reason,
        finalUnitsCount: data.finalUnits?.length,
      });
      // Salvar resultado com unidades finais (do servidor ou do state local)
      dispatch({
        type: "SET_BATTLE_RESULT",
        payload: {
          battleId: data.battleId,
          winnerId: data.winnerId,
          winnerKingdomId: data.winnerKingdomId,
          reason: data.reason,
          surrenderedBy: data.surrenderedBy,
          disconnectedBy: data.disconnectedBy,
          finalUnits: data.finalUnits || [...stateRef.current.units], // Preferir do servidor
        },
      });
      // Atualizar status da batalha
      dispatch({
        type: "SET_BATTLE",
        payload: stateRef.current.battle
          ? { ...stateRef.current.battle, status: "ENDED" }
          : null,
      });
      // Limpar flags de rematch
      dispatch({ type: "SET_REMATCH_PENDING", payload: false });
      dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
    };

    const handleError = (data: { message: string }) => {
      arenaLog("❌", "ERRO", data.message);
      dispatch({ type: "SET_ERROR", payload: data.message });
    };

    // Handler para quando oponente desconecta temporariamente
    const handlePlayerDisconnected = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      lobbyLog("⚠️", "OPONENTE DESCONECTOU", {
        lobbyId: data.lobbyId,
        userId: data.userId,
      });
      // Mostrar mensagem para o usuário
      dispatch({
        type: "SET_ERROR",
        payload: "Oponente desconectou. Aguardando reconexão...",
      });
    };

    // Handler para quando oponente reconecta
    const handlePlayerReconnected = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      lobbyLog("✅", "OPONENTE RECONECTOU", {
        lobbyId: data.lobbyId,
        userId: data.userId,
      });
      // Limpar mensagem de erro
      dispatch({ type: "SET_ERROR", payload: null });
    };

    // Handler para quando oponente quer revanche
    const handleRematchRequested = (data: {
      lobbyId: string;
      userId: string;
    }) => {
      lobbyLog("🔄", "OPONENTE QUER REVANCHE", data);
      if (data.userId !== user.id) {
        dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: true });
      }
    };

    // Handler para quando revanche é aceita e nova batalha começa
    const handleRematchStarted = (data: BattleStartedResponse) => {
      battleLog("⚔️", "REVANCHE INICIADA!", data);
      // Limpar resultado anterior
      dispatch({ type: "SET_BATTLE_RESULT", payload: null });
      dispatch({ type: "SET_REMATCH_PENDING", payload: false });
      dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
      // Configurar nova batalha (usa o handler existente)
      handleBattleStarted(data);
    };

    // Handler para quando um obstáculo é destruído
    const handleObstacleDestroyed = (data: {
      battleId: string;
      obstacleId: string;
    }) => {
      battleLog("💥", "OBSTÁCULO DESTRUÍDO", {
        battleId: data.battleId,
        obstacleId: data.obstacleId,
      });
      dispatch({
        type: "DESTROY_OBSTACLE",
        payload: { obstacleId: data.obstacleId },
      });
    };

    // Handler for session restoration (reconnection)
    const handleSessionRestored = (data: {
      lobbyId: string;
      hostUserId: string;
      hostUsername: string;
      hostKingdomName: string;
      guestUserId?: string;
      guestUsername?: string;
      guestKingdomName?: string;
      status: ArenaLobbyStatus;
      isHost: boolean;
      createdAt: string;
    }) => {
      lobbyLog("🔄", "SESSÃO RESTAURADA (LOBBY)", {
        lobbyId: data.lobbyId,
        isHost: data.isHost,
        status: data.status,
        hostUsername: data.hostUsername,
        guestUsername: data.guestUsername,
      });
      const lobby: ArenaLobby = {
        lobbyId: data.lobbyId,
        hostUserId: data.hostUserId,
        hostUsername: data.hostUsername,
        hostKingdomName: data.hostKingdomName,
        guestUserId: data.guestUserId,
        guestUsername: data.guestUsername,
        guestKingdomName: data.guestKingdomName,
        status: data.status,
        createdAt: new Date(data.createdAt),
      };
      dispatch({ type: "SET_CURRENT_LOBBY", payload: lobby });
      dispatch({ type: "SET_IS_HOST", payload: data.isHost });
    };

    // Handler for battle restoration (reconnection during battle)
    const handleBattleRestored = (data: {
      battleId: string;
      lobbyId: string;
      config: ArenaConfig;
      round: number;
      status: "ACTIVE" | "ENDED";
      currentTurnIndex: number;
      currentPlayerId: string;
      turnTimer?: number;
      units: any[];
      initiativeOrder: string[];
      actionOrder: string[];
      hostKingdom: { id: string; name: string; ownerId: string } | null;
      guestKingdom: { id: string; name: string; ownerId: string } | null;
    }) => {
      battleLog("🔄", "SESSÃO RESTAURADA (BATALHA)", {
        battleId: data.battleId,
        lobbyId: data.lobbyId,
        round: data.round,
        status: data.status,
        unitsCount: data.units.length,
        turnTimer: data.turnTimer,
      });
      const battle: ArenaBattle = {
        battleId: data.battleId,
        lobbyId: data.lobbyId, // Salvar lobbyId para revanche
        config: data.config, // Configuração visual completa do servidor
        round: data.round,
        status: data.status,
        currentTurnIndex: data.currentTurnIndex,
        currentPlayerId: data.currentPlayerId,
        actionOrder: data.actionOrder,
        initiativeOrder: data.initiativeOrder,
        units: data.units,
        hostKingdom: data.hostKingdom || {
          id: "",
          name: "Unknown",
          ownerId: "",
        },
        guestKingdom: data.guestKingdom || {
          id: "",
          name: "Unknown",
          ownerId: "",
        },
        turnTimer: data.turnTimer ?? 30, // Usar timer do servidor ou 30 como fallback
      };
      dispatch({ type: "SET_BATTLE", payload: battle });
      dispatch({ type: "SET_UNITS", payload: data.units });
    };

    // Register listeners
    socketService.on("battle:lobby_created", handleLobbyCreated);
    socketService.on("battle:lobbies_list", handleLobbiesList);
    socketService.on("battle:player_joined", handlePlayerJoined);
    socketService.on("battle:lobby_joined", handleLobbyJoined);
    socketService.on("battle:lobby_closed", handleLobbyClosed);
    socketService.on("battle:player_left", handlePlayerLeft);
    socketService.on("battle:battle_started", handleBattleStarted);
    socketService.on("battle:action_started", handleActionStarted);
    socketService.on("battle:unit_moved", handleUnitMoved);
    socketService.on("battle:unit_attacked", handleUnitAttacked);
    socketService.on("battle:unit_defeated", handleUnitDefeated);
    socketService.on("battle:protection_recovered", handleProtectionRecovered);
    socketService.on("battle:unit_turn_ended", handleUnitTurnEnded);
    socketService.on("battle:next_player", handleNextPlayer);
    socketService.on("battle:turn_timer", handleTurnTimer);
    socketService.on("battle:new_round", handleNewRound);
    socketService.on("battle:battle_ended", handleBattleEnded);
    socketService.on("battle:unit_dashed", handleUnitDashed);
    socketService.on("battle:unit_dodged", handleUnitDodged);
    socketService.on("battle:error", handleError);
    socketService.on("battle:session_restored", handleSessionRestored);
    socketService.on("battle:battle_restored", handleBattleRestored);
    socketService.on("battle:player_disconnected", handlePlayerDisconnected);
    socketService.on("battle:player_reconnected", handlePlayerReconnected);
    socketService.on("battle:rematch_requested", handleRematchRequested);
    socketService.on("battle:rematch_started", handleRematchStarted);
    socketService.on("battle:obstacle_destroyed", handleObstacleDestroyed);

    return () => {
      socketService.off("battle:lobby_created", handleLobbyCreated);
      socketService.off("battle:lobbies_list", handleLobbiesList);
      socketService.off("battle:player_joined", handlePlayerJoined);
      socketService.off("battle:lobby_joined", handleLobbyJoined);
      socketService.off("battle:lobby_closed", handleLobbyClosed);
      socketService.off("battle:player_left", handlePlayerLeft);
      socketService.off("battle:battle_started", handleBattleStarted);
      socketService.off("battle:action_started", handleActionStarted);
      socketService.off("battle:unit_moved", handleUnitMoved);
      socketService.off("battle:unit_attacked", handleUnitAttacked);
      socketService.off("battle:unit_defeated", handleUnitDefeated);
      socketService.off(
        "battle:protection_recovered",
        handleProtectionRecovered
      );
      socketService.off("battle:unit_turn_ended", handleUnitTurnEnded);
      socketService.off("battle:next_player", handleNextPlayer);
      socketService.off("battle:turn_timer", handleTurnTimer);
      socketService.off("battle:new_round", handleNewRound);
      socketService.off("battle:battle_ended", handleBattleEnded);
      socketService.off("battle:unit_dashed", handleUnitDashed);
      socketService.off("battle:unit_dodged", handleUnitDodged);
      socketService.off("battle:error", handleError);
      socketService.off("battle:session_restored", handleSessionRestored);
      socketService.off("battle:battle_restored", handleBattleRestored);
      socketService.off("battle:player_disconnected", handlePlayerDisconnected);
      socketService.off("battle:player_reconnected", handlePlayerReconnected);
      socketService.off("battle:rematch_requested", handleRematchRequested);
      socketService.off("battle:rematch_started", handleRematchStarted);
      socketService.off("battle:obstacle_destroyed", handleObstacleDestroyed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Efeito para solicitar restauração de sessão após listeners registrados
  // Resolve condição de corrida onde session:check é chamado antes dos listeners
  useEffect(() => {
    if (!user?.id) return;

    // Pequeno delay para garantir que os listeners foram registrados
    const timer = setTimeout(() => {
      // Re-solicitar check de sessão para garantir que os eventos de restauração
      // sejam recebidos pelos listeners que agora estão registrados
      arenaLog(
        "🔄",
        "Re-solicitando verificação de sessão (listeners prontos)",
        {
          userId: user.id,
        }
      );
      socketService.emit("session:check", { userId: user.id });
    }, 100);

    return () => clearTimeout(timer);
  }, [user?.id]);

  const createLobby = useCallback(
    (kingdomId: string) => {
      if (!user) return;
      lobbyLog("⬆️", "EMIT: arena:create_lobby", {
        userId: user.id,
        kingdomId,
      });
      dispatch({ type: "SET_LOADING", payload: true });
      socketService.emit("battle:create_lobby", { userId: user.id, kingdomId });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [user]
  );

  const listLobbies = useCallback(() => {
    lobbyLog("⬆️", "EMIT: arena:list_lobbies");
    socketService.emit("battle:list_lobbies");
  }, []);

  const joinLobby = useCallback(
    (lobbyId: string, kingdomId: string) => {
      if (!user) return;
      lobbyLog("⬆️", "EMIT: arena:join_lobby", {
        lobbyId,
        userId: user.id,
        kingdomId,
      });
      dispatch({ type: "SET_LOADING", payload: true });
      socketService.emit("battle:join_lobby", {
        lobbyId,
        userId: user.id,
        kingdomId,
      });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [user]
  );

  const leaveLobby = useCallback(() => {
    if (!user) return;
    lobbyLog("⬆️", "EMIT: arena:leave_lobby", { userId: user.id });
    socketService.emit("battle:leave_lobby", { userId: user.id });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
  }, [user]);

  const startBattle = useCallback(() => {
    if (!user || !state.currentLobby) return;
    battleLog("⬆️", "EMIT: arena:start_battle", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
    socketService.emit("battle:start_battle", {
      lobbyId: state.currentLobby.lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby]);

  const beginAction = useCallback(
    (unitId: string) => {
      if (!user || !state.battle) return;
      battleLog("⬆️", "EMIT: arena:begin_action", {
        battleId: state.battle.battleId,
        unitId,
        userId: user.id,
      });
      socketService.emit("battle:begin_action", {
        battleId: state.battle.battleId,
        unitId,
        userId: user.id,
      });
    },
    [user, state.battle]
  );

  const moveUnit = useCallback(
    (unitId: string, toX: number, toY: number) => {
      if (!state.battle) return;
      battleLog("⬆️", "EMIT: arena:move", {
        battleId: state.battle.battleId,
        unitId,
        toX,
        toY,
      });
      socketService.emit("battle:move", {
        battleId: state.battle.battleId,
        unitId,
        toX,
        toY,
      });
    },
    [state.battle]
  );

  const attackUnit = useCallback(
    (
      attackerUnitId: string,
      targetUnitId?: string,
      targetObstacleId?: string
    ) => {
      if (!state.battle) return;
      if (!targetUnitId && !targetObstacleId) return;

      // Validação local: verificar se atacante tem ações
      const attacker = state.units.find((u) => u.id === attackerUnitId);
      if (!attacker || attacker.actionsLeft <= 0) {
        battleLog("⚠️", "Ataque bloqueado: sem ações disponíveis", {
          attackerUnitId,
          actionsLeft: attacker?.actionsLeft ?? 0,
        });
        return;
      }

      // Update otimista: decrementar actionsLeft imediatamente para evitar cliques duplos
      dispatch({
        type: "UPDATE_UNIT",
        payload: {
          id: attackerUnitId,
          actionsLeft: attacker.actionsLeft - 1,
        },
      });

      battleLog("⬆️", "EMIT: arena:attack", {
        battleId: state.battle.battleId,
        attackerUnitId,
        targetUnitId,
        targetObstacleId,
      });
      socketService.emit("battle:attack", {
        battleId: state.battle.battleId,
        attackerUnitId,
        targetUnitId,
        targetObstacleId,
      });
    },
    [state.battle, state.units]
  );

  const endAction = useCallback(
    (unitId: string) => {
      if (!state.battle) return;
      battleLog("⬆️", "EMIT: arena:end_unit_action", {
        battleId: state.battle.battleId,
        unitId,
      });
      socketService.emit("battle:end_unit_action", {
        battleId: state.battle.battleId,
        unitId,
      });
    },
    [state.battle]
  );

  // Função genérica para executar qualquer ação de batalha
  const executeAction = useCallback(
    (actionName: string, unitId: string, params?: Record<string, unknown>) => {
      if (!state.battle) return;

      // Ações que consomem actionsLeft
      const actionsThatConsumeActions = ["dash", "dodge", "skill"];

      // Validação e update otimista para ações que consomem actionsLeft
      if (actionsThatConsumeActions.includes(actionName)) {
        const unit = state.units.find((u) => u.id === unitId);
        if (!unit || unit.actionsLeft <= 0) {
          battleLog("⚠️", `${actionName} bloqueado: sem ações disponíveis`, {
            unitId,
            actionsLeft: unit?.actionsLeft ?? 0,
          });
          return;
        }

        // Update otimista
        dispatch({
          type: "UPDATE_UNIT",
          payload: {
            id: unitId,
            actionsLeft: unit.actionsLeft - 1,
          },
        });
      }

      const eventName = `battle:${actionName}`;
      const payload = {
        battleId: state.battle.battleId,
        unitId,
        ...params,
      };

      battleLog("⬆️", `EMIT: ${eventName}`, payload);

      socketService.emit(eventName, payload);
    },
    [state.battle, state.units]
  );

  const surrender = useCallback(() => {
    if (!user || !state.battle) return;
    battleLog("⬆️", "EMIT: arena:surrender", {
      battleId: state.battle.battleId,
      userId: user.id,
    });
    socketService.emit("battle:surrender", {
      battleId: state.battle.battleId,
      userId: user.id,
    });
  }, [user, state.battle]);

  const requestRematch = useCallback(() => {
    // Usar lobbyId do currentLobby ou do battle (para reconexão)
    const lobbyId = state.currentLobby?.lobbyId || state.battle?.lobbyId;
    if (!user || !lobbyId) {
      lobbyLog(
        "⚠️",
        "Não foi possível solicitar revanche: user ou lobbyId não encontrados",
        {
          user: !!user,
          currentLobby: !!state.currentLobby,
          battle: !!state.battle,
          lobbyId,
        }
      );
      return;
    }
    lobbyLog("⬆️", "EMIT: arena:request_rematch", {
      lobbyId,
      userId: user.id,
    });
    dispatch({ type: "SET_REMATCH_PENDING", payload: true });
    socketService.emit("battle:request_rematch", {
      lobbyId,
      userId: user.id,
    });
  }, [user, state.currentLobby, state.battle]);

  const dismissBattleResult = useCallback(() => {
    arenaLog("🚪", "Fechando modal de resultado");
    dispatch({ type: "SET_BATTLE_RESULT", payload: null });
    dispatch({ type: "SET_BATTLE", payload: null });
    dispatch({ type: "SET_UNITS", payload: [] });
    dispatch({ type: "SET_CURRENT_LOBBY", payload: null });
    dispatch({ type: "SET_IS_HOST", payload: false });
    dispatch({ type: "SET_REMATCH_PENDING", payload: false });
    dispatch({ type: "SET_OPPONENT_WANTS_REMATCH", payload: false });
    // Limpar sessão ativa para evitar loop de restauração
    clearSession();
  }, [clearSession]);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const value = useMemo(
    () => ({
      state,
      createLobby,
      listLobbies,
      joinLobby,
      leaveLobby,
      startBattle,
      beginAction,
      moveUnit,
      attackUnit,
      endAction,
      executeAction,
      surrender,
      requestRematch,
      dismissBattleResult,
      clearError,
    }),
    [
      state,
      createLobby,
      listLobbies,
      joinLobby,
      leaveLobby,
      startBattle,
      beginAction,
      moveUnit,
      attackUnit,
      endAction,
      executeAction,
      surrender,
      requestRematch,
      dismissBattleResult,
      clearError,
    ]
  );

  return (
    <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>
  );
};
