// client/src/features/qte/hooks/useChainQTE.ts
// Hook para gerenciar Chain QTE (QTEs em cascata/playlist)
// Implementa agendamento local de passos pré-calculados

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ChainQTEConfig,
  ChainQTEStepResponse,
  ChainQTEStepResult,
  ChainQTEResult,
  ChainQTEClientState,
  QTEInput,
} from "../../../../../shared/qte";
import { colyseusService } from "../../../services/colyseus.service";

// =============================================================================
// SINCRONIZAÇÃO DE TEMPO
// =============================================================================

interface TimeSyncState {
  serverTimeDelta: number;
  synced: boolean;
}

function estimateServerTime(timeSyncState: TimeSyncState): number {
  if (!timeSyncState.synced) {
    return Date.now();
  }
  return Date.now() + timeSyncState.serverTimeDelta;
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

interface UseChainQTEOptions {
  /** ID da batalha atual */
  battleId: string | null;

  /** ID do jogador local */
  localPlayerId: string | null;

  /** Callback quando Chain QTE é completado */
  onChainComplete?: (result: ChainQTEResult) => void;

  /** Callback quando um step é resolvido */
  onStepResolved?: (stepResult: ChainQTEStepResult) => void;

  /** Callback para mover câmera para próximo alvo */
  onFocusTarget?: (
    targetId: string,
    position: { x: number; y: number }
  ) => void;
}

interface UseChainQTEReturn {
  /** Estado do Chain QTE */
  state: ChainQTEClientState;

  /** Se há Chain QTE ativo */
  isActive: boolean;

  /** Step atual (para renderizar QTE) */
  currentStep: ChainQTEConfig["steps"][number] | null;

  /** Tempo restante do step atual */
  stepTimeRemaining: number;

  /** Responder ao step atual */
  respondToStep: (input: QTEInput, hitPosition: number) => void;

  /** Limpar estado */
  clearChainQTE: () => void;
}

export function useChainQTE({
  battleId,
  localPlayerId,
  onChainComplete,
  onStepResolved,
  onFocusTarget,
}: UseChainQTEOptions): UseChainQTEReturn {
  // Estado do Chain QTE
  const [state, setState] = useState<ChainQTEClientState>({
    activeChain: null,
    currentStepIndex: 0,
    isActive: false,
    chainBroken: false,
    currentCombo: 1.0,
    completedSteps: [],
    waitingForNextStep: false,
    accumulatedDamage: 0,
  });

  // Step atual para renderização
  const [currentStep, setCurrentStep] = useState<
    ChainQTEConfig["steps"][number] | null
  >(null);

  // Tempo restante do step atual
  const [stepTimeRemaining, setStepTimeRemaining] = useState(0);

  // Sync de tempo
  const timeSyncRef = useRef<TimeSyncState>({
    serverTimeDelta: 0,
    synced: false,
  });

  // Timeouts para agendamento dos steps
  const stepTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Timestamp quando o step atual começou
  const stepStartTimeRef = useRef<number>(0);

  // Animation frame para atualizar tempo restante
  const animationFrameRef = useRef<number | null>(null);

  // Refs para callbacks
  const onChainCompleteRef = useRef(onChainComplete);
  const onStepResolvedRef = useRef(onStepResolved);
  const onFocusTargetRef = useRef(onFocusTarget);
  onChainCompleteRef.current = onChainComplete;
  onStepResolvedRef.current = onStepResolved;
  onFocusTargetRef.current = onFocusTarget;

  // === LIMPAR TIMEOUTS ===

  const clearAllTimeouts = useCallback(() => {
    stepTimeoutsRef.current.forEach(clearTimeout);
    stepTimeoutsRef.current = [];
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // === SYNC DE TEMPO ===

  const syncTimeFromChain = useCallback((config: ChainQTEConfig) => {
    const localNow = Date.now();
    const estimatedLatency = 50;
    const serverTimeDelta =
      config.serverBaseTime - (localNow - estimatedLatency);

    timeSyncRef.current = {
      serverTimeDelta,
      synced: true,
    };
  }, []);

  // === ATUALIZAR TEMPO RESTANTE ===

  const updateTimeRemaining = useCallback(() => {
    if (!currentStep) {
      setStepTimeRemaining(0);
      return;
    }

    const elapsed = Date.now() - stepStartTimeRef.current;
    const remaining = Math.max(0, currentStep.duration - elapsed);
    setStepTimeRemaining(remaining);

    if (remaining > 0) {
      animationFrameRef.current = requestAnimationFrame(updateTimeRemaining);
    }
  }, [currentStep]);

  // === INICIAR STEP ===

  const startStep = useCallback(
    (chain: ChainQTEConfig, stepIndex: number) => {
      const step = chain.steps[stepIndex];
      if (!step) return;

      console.log(`[ChainQTE] Iniciando step ${stepIndex}`, step);

      setCurrentStep(step);
      stepStartTimeRef.current = Date.now();

      setState((prev) => ({
        ...prev,
        currentStepIndex: stepIndex,
        waitingForNextStep: false,
      }));

      // Focar câmera no alvo
      if (onFocusTargetRef.current) {
        onFocusTargetRef.current(step.targetId, step.targetPosition);
      }

      // Iniciar animação de tempo restante
      updateTimeRemaining();
    },
    [updateTimeRemaining]
  );

  // === AGENDAR TODOS OS STEPS ===

  const scheduleSteps = useCallback(
    (config: ChainQTEConfig) => {
      clearAllTimeouts();

      const estimatedServerNow = estimateServerTime(timeSyncRef.current);

      for (const step of config.steps) {
        // Tempo absoluto do servidor quando o step começa
        const stepServerTime = config.serverBaseTime + step.offsetMs;

        // Converter para tempo local
        const delayUntilStep = stepServerTime - estimatedServerNow;

        // Agendar início do step
        if (delayUntilStep <= 0 && step.stepIndex === 0) {
          // Primeiro step, começar imediatamente
          startStep(config, step.stepIndex);
        } else {
          const timeout = setTimeout(() => {
            startStep(config, step.stepIndex);
          }, Math.max(0, delayUntilStep));

          stepTimeoutsRef.current.push(timeout);
        }

        // Se não é o último step, agendar "pré-foco" na câmera
        // (começar a mover câmera antes do step começar)
        if (step.stepIndex < config.steps.length - 1) {
          const nextStep = config.steps[step.stepIndex + 1];
          const preFocusDelay = delayUntilStep - 300; // 300ms antes

          if (preFocusDelay > 0 && onFocusTargetRef.current) {
            const preFocusTimeout = setTimeout(() => {
              onFocusTargetRef.current?.(
                nextStep.targetId,
                nextStep.targetPosition
              );
            }, preFocusDelay);

            stepTimeoutsRef.current.push(preFocusTimeout);
          }
        }
      }
    },
    [clearAllTimeouts, startStep]
  );

  // === LISTENERS DE EVENTOS ===

  useEffect(() => {
    if (!battleId) return;

    // Handler para Chain QTE iniciado
    const handleChainStart = (config: ChainQTEConfig) => {
      console.log("[ChainQTE] Recebido chain_qte:start", config);

      // Sync tempo
      syncTimeFromChain(config);

      // Atualizar estado
      setState({
        activeChain: config,
        currentStepIndex: 0,
        isActive: true,
        chainBroken: false,
        currentCombo: 1.0,
        completedSteps: [],
        waitingForNextStep: false,
        accumulatedDamage: 0,
      });

      // Agendar todos os steps
      scheduleSteps(config);
    };

    // Handler para step resolvido
    const handleStepResolved = (data: {
      chainId: string;
      stepResult: ChainQTEStepResult;
    }) => {
      console.log("[ChainQTE] Recebido chain_qte:step_resolved", data);

      setState((prev) => {
        if (!prev.activeChain || prev.activeChain.chainId !== data.chainId) {
          return prev;
        }

        return {
          ...prev,
          completedSteps: [...prev.completedSteps, data.stepResult],
          currentCombo: data.stepResult.currentCombo,
          accumulatedDamage:
            prev.accumulatedDamage + data.stepResult.damageDealt,
          waitingForNextStep: true,
        };
      });

      // Callback externo
      if (onStepResolvedRef.current) {
        onStepResolvedRef.current(data.stepResult);
      }
    };

    // Handler para Chain completo
    const handleChainComplete = (result: ChainQTEResult) => {
      console.log("[ChainQTE] Recebido chain_qte:complete", result);

      clearAllTimeouts();
      setCurrentStep(null);
      setStepTimeRemaining(0);

      setState((prev) => ({
        ...prev,
        activeChain: null,
        isActive: false,
        completedSteps: result.stepResults,
        accumulatedDamage: result.totalDamage,
      }));

      // Callback externo
      if (onChainCompleteRef.current) {
        onChainCompleteRef.current(result);
      }
    };

    // Handler para Chain quebrado
    const handleChainBroken = (data: {
      chainId: string;
      brokenAtStep: number;
      reason: string;
    }) => {
      console.log("[ChainQTE] Recebido chain_qte:broken", data);

      clearAllTimeouts();

      setState((prev) => ({
        ...prev,
        chainBroken: true,
      }));
    };

    // Registrar listeners (eventos prefixados com battle: pelo colyseusService)
    colyseusService.on("battle:chain_qte:start", handleChainStart);
    colyseusService.on("battle:chain_qte:step_resolved", handleStepResolved);
    colyseusService.on("battle:chain_qte:complete", handleChainComplete);
    colyseusService.on("battle:chain_qte:broken", handleChainBroken);

    return () => {
      clearAllTimeouts();
      colyseusService.off("battle:chain_qte:start", handleChainStart);
      colyseusService.off("battle:chain_qte:step_resolved", handleStepResolved);
      colyseusService.off("battle:chain_qte:complete", handleChainComplete);
      colyseusService.off("battle:chain_qte:broken", handleChainBroken);
    };
  }, [battleId, syncTimeFromChain, scheduleSteps, clearAllTimeouts]);

  // === RESPONDER AO STEP ===

  const respondToStep = useCallback(
    (input: QTEInput, hitPosition: number) => {
      if (!state.activeChain || !localPlayerId || !currentStep) {
        console.warn("[ChainQTE] Tentativa de responder step inválida");
        return;
      }

      // Já completou este step?
      const alreadyCompleted = state.completedSteps.some(
        (s) => s.stepIndex === currentStep.stepIndex
      );
      if (alreadyCompleted) {
        console.warn("[ChainQTE] Step já completado");
        return;
      }

      const localNow = Date.now();
      const timeElapsed = localNow - stepStartTimeRef.current;
      const serverTimestamp =
        state.activeChain.serverBaseTime + currentStep.offsetMs + timeElapsed;

      const response: ChainQTEStepResponse = {
        chainId: state.activeChain.chainId,
        stepIndex: currentStep.stepIndex,
        battleId: state.activeChain.battleId,
        playerId: localPlayerId,
        input,
        hitPosition,
        serverTimestamp,
      };

      console.log("[ChainQTE] Enviando resposta do step", response);

      // Parar animação de tempo restante
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      setState((prev) => ({
        ...prev,
        waitingForNextStep: true,
      }));

      // Enviar para o servidor
      colyseusService.sendToBattle("chain_qte:step_response", response);
    },
    [state.activeChain, localPlayerId, currentStep, state.completedSteps]
  );

  // === LIMPAR ESTADO ===

  const clearChainQTE = useCallback(() => {
    clearAllTimeouts();
    setCurrentStep(null);
    setStepTimeRemaining(0);

    setState({
      activeChain: null,
      currentStepIndex: 0,
      isActive: false,
      chainBroken: false,
      currentCombo: 1.0,
      completedSteps: [],
      waitingForNextStep: false,
      accumulatedDamage: 0,
    });
  }, [clearAllTimeouts]);

  return {
    state,
    isActive: state.isActive,
    currentStep,
    stepTimeRemaining,
    respondToStep,
    clearChainQTE,
  };
}

export default useChainQTE;
