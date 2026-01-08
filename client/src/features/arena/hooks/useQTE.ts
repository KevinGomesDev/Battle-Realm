// client/src/features/arena/hooks/useQTE.ts
// Hook para gerenciar estado do Quick Time Event
// Implementa arquitetura "Trust but Verify" com sincronização de tempo

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  QTEConfig,
  QTEResponse,
  QTEResult,
  QTEInput,
  QTEClientState,
} from "../../../../../shared/qte";
import { colyseusService } from "../../../services/colyseus.service";

// =============================================================================
// SINCRONIZAÇÃO DE TEMPO
// =============================================================================

/**
 * Estado de sincronização de tempo com o servidor
 * O cliente calcula o delta entre seu tempo e o do servidor
 */
interface TimeSyncState {
  /** Diferença entre tempo do servidor e tempo local (serverTime - localTime) */
  serverTimeDelta: number;
  /** Se a sincronização foi feita */
  synced: boolean;
}

/**
 * Estima o tempo atual do servidor baseado no delta calculado
 */
function estimateServerTime(timeSyncState: TimeSyncState): number {
  if (!timeSyncState.synced) {
    // Se não sincronizado, usa tempo local como fallback
    return Date.now();
  }
  return Date.now() + timeSyncState.serverTimeDelta;
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

interface UseQTEOptions {
  /** ID da batalha atual */
  battleId: string | null;

  /** ID do jogador local */
  localPlayerId: string | null;

  /** Callback quando QTE é resolvido */
  onQTEResolved?: (result: QTEResult) => void;

  /** Callback quando QTE visual deve começar (agendado) */
  onQTEVisualStart?: (config: QTEConfig) => void;
}

interface UseQTEReturn {
  /** Estado do QTE */
  state: QTEClientState;

  /** Se o jogador local deve responder ao QTE atual */
  isLocalResponder: boolean;

  /** Enviar resposta do QTE com feedback imediato */
  respondToQTE: (input: QTEInput, hitPosition: number) => void;

  /** Limpar estado do QTE */
  clearQTE: () => void;

  /** Se o QTE visual está ativo (após serverStartTime) */
  isQTEVisualActive: boolean;
}

export function useQTE({
  battleId,
  localPlayerId,
  onQTEResolved,
  onQTEVisualStart,
}: UseQTEOptions): UseQTEReturn {
  // Estado inicial
  const [state, setState] = useState<QTEClientState>({
    activeQTE: null,
    indicatorPosition: 0,
    hasResponded: false,
    response: null,
    result: null,
    history: [],
    waitingForOpponent: false,
  });

  // Se o visual do QTE está ativo (após serverStartTime)
  const [isQTEVisualActive, setIsQTEVisualActive] = useState(false);

  // Sincronização de tempo
  const timeSyncRef = useRef<TimeSyncState>({
    serverTimeDelta: 0,
    synced: false,
  });

  // Ref para o timeout de início visual
  const visualStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Ref para o QTE config recebido (para calcular serverTimestamp na resposta)
  const qteConfigRef = useRef<QTEConfig | null>(null);

  // Timestamp local quando o visual começou
  const visualStartTimeRef = useRef<number>(0);

  // Refs para callbacks
  const onQTEResolvedRef = useRef(onQTEResolved);
  const onQTEVisualStartRef = useRef(onQTEVisualStart);
  onQTEResolvedRef.current = onQTEResolved;
  onQTEVisualStartRef.current = onQTEVisualStart;

  // === SINCRONIZAÇÃO DE TEMPO ===

  // Quando recebemos um QTE, calculamos o delta de tempo
  const syncTimeFromQTE = useCallback((config: QTEConfig) => {
    // O servidor enviou createdAt - usamos para calcular o delta
    const localNow = Date.now();
    // Delta = serverTime - localTime
    // Se serverCreatedAt é 1000 e localNow é 1050, delta = -50 (servidor está 50ms atrás)
    // Na prática, assumimos que a latência de rede é ~metade do round-trip
    // Então usamos o createdAt como referência aproximada
    const estimatedLatency = 50; // Metade de um ping típico de 100ms
    const serverTimeDelta = config.createdAt - (localNow - estimatedLatency);

    timeSyncRef.current = {
      serverTimeDelta,
      synced: true,
    };

    console.log("[QTE] Sincronização de tempo:", {
      serverCreatedAt: config.createdAt,
      localNow,
      serverTimeDelta,
    });
  }, []);

  // === LISTENERS DE EVENTOS COLYSEUS ===

  useEffect(() => {
    if (!battleId) return;

    // Handler para QTE iniciado
    const handleQTEStart = (config: QTEConfig) => {
      console.log("[QTE] Recebido qte:start", config);

      // Limpar timeout anterior se existir
      if (visualStartTimeoutRef.current) {
        clearTimeout(visualStartTimeoutRef.current);
      }

      // Sincronizar tempo com o servidor
      syncTimeFromQTE(config);

      // Guardar config para usar na resposta
      qteConfigRef.current = config;

      // Calcular delay até o visual começar
      const localNow = Date.now();
      const estimatedServerNow = estimateServerTime(timeSyncRef.current);
      const delayUntilStart = config.serverStartTime - estimatedServerNow;

      console.log("[QTE] Agendando visual:", {
        serverStartTime: config.serverStartTime,
        estimatedServerNow,
        delayUntilStart,
      });

      // Atualizar estado (mas visual ainda não está ativo)
      setState((prev) => ({
        ...prev,
        activeQTE: config,
        indicatorPosition: 0,
        hasResponded: false,
        response: null,
        result: null,
        waitingForOpponent: false,
      }));
      setIsQTEVisualActive(false);

      // Agendar o início visual do QTE
      if (delayUntilStart <= 0) {
        // Já passou do tempo - começar imediatamente
        setIsQTEVisualActive(true);
        visualStartTimeRef.current = localNow;
        if (onQTEVisualStartRef.current) {
          onQTEVisualStartRef.current(config);
        }
      } else {
        // Agendar para o futuro
        visualStartTimeoutRef.current = setTimeout(() => {
          console.log("[QTE] Visual iniciado após delay");
          setIsQTEVisualActive(true);
          visualStartTimeRef.current = Date.now();
          if (onQTEVisualStartRef.current) {
            onQTEVisualStartRef.current(config);
          }
        }, delayUntilStart);
      }
    };

    // Handler para QTE resolvido
    const handleQTEResolved = (result: QTEResult) => {
      console.log("[QTE] Recebido qte:resolved", result);

      // Limpar timeout visual
      if (visualStartTimeoutRef.current) {
        clearTimeout(visualStartTimeoutRef.current);
        visualStartTimeoutRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        result,
        activeQTE: null,
        history: [...prev.history, result],
        waitingForOpponent: false,
      }));
      setIsQTEVisualActive(false);
      qteConfigRef.current = null;

      // Callback externo
      if (onQTEResolvedRef.current) {
        onQTEResolvedRef.current(result);
      }
    };

    // Handler para QTE expirado
    const handleQTEExpired = (data: { qteId: string; result: QTEResult }) => {
      console.log("[QTE] Recebido qte:expired", data);

      // Limpar timeout visual
      if (visualStartTimeoutRef.current) {
        clearTimeout(visualStartTimeoutRef.current);
        visualStartTimeoutRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        result: data.result,
        activeQTE: null,
        history: [...prev.history, data.result],
        waitingForOpponent: false,
      }));
      setIsQTEVisualActive(false);
      qteConfigRef.current = null;

      if (onQTEResolvedRef.current) {
        onQTEResolvedRef.current(data.result);
      }
    };

    // Handler para cascata (projétil continua)
    const handleQTECascade = (data: {
      previousQteId: string;
      newConfig: QTEConfig;
    }) => {
      console.log("[QTE] Recebido qte:cascade", data);

      // Limpar timeout anterior
      if (visualStartTimeoutRef.current) {
        clearTimeout(visualStartTimeoutRef.current);
      }

      // Sincronizar tempo com o novo config
      syncTimeFromQTE(data.newConfig);
      qteConfigRef.current = data.newConfig;

      // Calcular delay para o novo QTE
      const estimatedServerNow = estimateServerTime(timeSyncRef.current);
      const delayUntilStart =
        data.newConfig.serverStartTime - estimatedServerNow;

      setState((prev) => ({
        ...prev,
        activeQTE: data.newConfig,
        indicatorPosition: 0,
        hasResponded: false,
        response: null,
        result: null,
        waitingForOpponent: false,
      }));

      if (delayUntilStart <= 0) {
        setIsQTEVisualActive(true);
        visualStartTimeRef.current = Date.now();
      } else {
        setIsQTEVisualActive(false);
        visualStartTimeoutRef.current = setTimeout(() => {
          setIsQTEVisualActive(true);
          visualStartTimeRef.current = Date.now();
        }, delayUntilStart);
      }
    };

    // Registrar listeners (eventos prefixados com arena: pelo colyseusService)
    colyseusService.on("arena:qte:start", handleQTEStart);
    colyseusService.on("arena:qte:resolved", handleQTEResolved);
    colyseusService.on("arena:qte:expired", handleQTEExpired);
    colyseusService.on("arena:qte:cascade", handleQTECascade);

    // Cleanup
    return () => {
      if (visualStartTimeoutRef.current) {
        clearTimeout(visualStartTimeoutRef.current);
      }
      colyseusService.off("arena:qte:start", handleQTEStart);
      colyseusService.off("arena:qte:resolved", handleQTEResolved);
      colyseusService.off("arena:qte:expired", handleQTEExpired);
      colyseusService.off("arena:qte:cascade", handleQTECascade);
    };
  }, [battleId, syncTimeFromQTE]);

  // === VERIFICAR SE É O RESPONDER LOCAL ===

  const isLocalResponder = Boolean(
    state.activeQTE &&
      localPlayerId &&
      // Verifica se a unidade pertence ao jogador local
      // (isso será validado pelo servidor, mas ajuda na UI)
      state.activeQTE.responderId
  );

  // === ENVIAR RESPOSTA ===

  const respondToQTE = useCallback(
    (input: QTEInput, hitPosition: number) => {
      if (!state.activeQTE || !localPlayerId || state.hasResponded) {
        console.warn("[QTE] Tentativa de responder QTE inválida", {
          hasActiveQTE: !!state.activeQTE,
          hasLocalPlayerId: !!localPlayerId,
          hasResponded: state.hasResponded,
        });
        return;
      }

      const localNow = Date.now();

      // Calcular o serverTimestamp estimado
      // serverTimestamp = serverStartTime + tempo decorrido desde o visual começar
      const timeElapsed = localNow - visualStartTimeRef.current;
      const serverTimestamp = state.activeQTE.serverStartTime + timeElapsed;

      const response: QTEResponse = {
        qteId: state.activeQTE.qteId,
        battleId: state.activeQTE.battleId,
        playerId: localPlayerId,
        unitId: state.activeQTE.responderId,
        input,
        hitPosition,
        serverTimestamp, // Tempo estimado do servidor
        respondedAt: localNow, // Compatibilidade
      };

      console.log("[QTE] Enviando resposta com serverTimestamp", {
        serverTimestamp,
        timeElapsed,
        serverStartTime: state.activeQTE.serverStartTime,
      });

      // Atualizar estado local IMEDIATAMENTE (feedback visual instantâneo)
      setState((prev) => ({
        ...prev,
        hasResponded: true,
        response,
        waitingForOpponent: true,
      }));

      // Enviar para o servidor
      colyseusService.sendToArena("qte:response", response);
    },
    [state.activeQTE, localPlayerId, state.hasResponded]
  );

  // === LIMPAR QTE ===

  const clearQTE = useCallback(() => {
    if (visualStartTimeoutRef.current) {
      clearTimeout(visualStartTimeoutRef.current);
      visualStartTimeoutRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      activeQTE: null,
      indicatorPosition: 0,
      hasResponded: false,
      response: null,
      result: null,
      waitingForOpponent: false,
    }));
    setIsQTEVisualActive(false);
    qteConfigRef.current = null;
  }, []);

  return {
    state,
    isLocalResponder,
    respondToQTE,
    clearQTE,
    isQTEVisualActive,
  };
}

// =============================================================================
// HOOK SIMPLIFICADO PARA COMPONENTES
// =============================================================================

/**
 * Hook simplificado que retorna apenas se há QTE ativo
 */
export function useActiveQTE(): QTEConfig | null {
  const [activeQTE, setActiveQTE] = useState<QTEConfig | null>(null);

  useEffect(() => {
    const handleQTEStart = (config: QTEConfig) => {
      setActiveQTE(config);
    };

    const handleQTEResolved = () => {
      setActiveQTE(null);
    };

    const handleQTEExpired = () => {
      setActiveQTE(null);
    };

    colyseusService.on("arena:qte:start", handleQTEStart);
    colyseusService.on("arena:qte:resolved", handleQTEResolved);
    colyseusService.on("arena:qte:expired", handleQTEExpired);

    return () => {
      colyseusService.off("arena:qte:start", handleQTEStart);
      colyseusService.off("arena:qte:resolved", handleQTEResolved);
      colyseusService.off("arena:qte:expired", handleQTEExpired);
    };
  }, []);

  return activeQTE;
}

export default useQTE;
