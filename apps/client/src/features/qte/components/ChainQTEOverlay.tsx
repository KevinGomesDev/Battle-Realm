// client/src/features/qte/components/ChainQTEOverlay.tsx
// Overlay para Chain QTE (QTEs em cascata/playlist)
// Mostra steps sequenciais com linha de trajetória

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHotkeys } from "react-hotkeys-hook";
import type {
  ChainQTEConfig,
  ChainQTEStepResult,
  QTEInput,
  QTEResultGrade,
} from "../../../../../shared/qte";

// =============================================================================
// PROPS
// =============================================================================

interface ChainQTEOverlayProps {
  /** Configuração do Chain QTE */
  config: ChainQTEConfig | null;

  /** Step atual (para renderizar QTE) */
  currentStep: ChainQTEConfig["steps"][number] | null;

  /** Tempo restante do step atual */
  timeRemaining: number;

  /** Steps já completados */
  completedSteps: ChainQTEStepResult[];

  /** Combo atual */
  currentCombo: number;

  /** Dano acumulado */
  accumulatedDamage: number;

  /** Se a corrente quebrou */
  chainBroken: boolean;

  /** Callback quando o jogador responde */
  onResponse: (input: QTEInput, hitPosition: number) => void;

  /** Se o jogador é quem deve responder */
  isResponder: boolean;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const ChainQTEOverlay: React.FC<ChainQTEOverlayProps> = ({
  config,
  currentStep,
  timeRemaining: _timeRemaining,
  completedSteps,
  currentCombo,
  accumulatedDamage,
  chainBroken,
  onResponse,
  isResponder,
}) => {
  // Estado do indicador (0-100%)
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [hasResponded, setHasResponded] = useState(false);
  const [lastResult, setLastResult] = useState<QTEResultGrade | null>(null);

  // Refs para animação
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Calcular zonas
  const hitZoneStart = currentStep ? 50 - currentStep.hitZoneSize / 2 : 0;
  const hitZoneEnd = currentStep ? 50 + currentStep.hitZoneSize / 2 : 100;
  const perfectZoneStart = currentStep
    ? 50 - currentStep.perfectZoneSize / 2
    : 0;
  const perfectZoneEnd = currentStep
    ? 50 + currentStep.perfectZoneSize / 2
    : 100;

  // Resetar estado quando novo step chega
  useEffect(() => {
    if (currentStep) {
      setIndicatorPosition(0);
      setHasResponded(false);
      setLastResult(null);
      startTimeRef.current = performance.now();
    }
  }, [currentStep?.stepIndex]);

  // Animação do indicador
  useEffect(() => {
    if (!currentStep || hasResponded || !isResponder || chainBroken) return;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / currentStep.duration, 1);

      setIndicatorPosition(progress * 100);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Tempo esgotado
        handleInput("NONE");
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentStep?.stepIndex, hasResponded, isResponder, chainBroken]);

  // Atualizar lastResult quando step é completado
  useEffect(() => {
    if (completedSteps.length > 0) {
      const lastStep = completedSteps[completedSteps.length - 1];
      setLastResult(lastStep.grade);
    }
  }, [completedSteps]);

  // Handler de input
  const handleInput = useCallback(
    (input: QTEInput) => {
      if (hasResponded || !currentStep || !isResponder || chainBroken) return;

      setHasResponded(true);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Determinar resultado visual
      const isInHitZone =
        indicatorPosition >= hitZoneStart && indicatorPosition <= hitZoneEnd;
      const isInPerfectZone =
        indicatorPosition >= perfectZoneStart &&
        indicatorPosition <= perfectZoneEnd;

      let grade: QTEResultGrade = "FAIL";
      if (input !== "NONE") {
        if (isInPerfectZone) {
          grade = "PERFECT";
        } else if (isInHitZone) {
          grade = "HIT";
        }
      }

      setLastResult(grade);
      onResponse(input, indicatorPosition);
    },
    [
      hasResponded,
      currentStep,
      isResponder,
      chainBroken,
      indicatorPosition,
      hitZoneStart,
      hitZoneEnd,
      perfectZoneStart,
      perfectZoneEnd,
      onResponse,
    ]
  );

  // Hotkey (apenas E para Chain QTE)
  useHotkeys(
    "e",
    () => handleInput("E"),
    { enabled: isResponder && !hasResponded && !chainBroken && !!currentStep },
    [handleInput, isResponder, hasResponded, chainBroken, currentStep]
  );

  // Não renderizar se não há Chain QTE ativo
  if (!config) return null;

  const totalSteps = config.steps.length;
  const completedCount = completedSteps.length;
  const progress = (completedCount / totalSteps) * 100;

  const getGradeColor = (grade: QTEResultGrade) => {
    switch (grade) {
      case "PERFECT":
        return "#eab308";
      case "HIT":
        return "#22c55e";
      case "FAIL":
        return "#ef4444";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        {/* Overlay escurecido */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Container principal */}
        <div className="relative flex flex-col items-center gap-4">
          {/* Header com nome da skill */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center"
          >
            <h2
              className="text-3xl font-bold drop-shadow-lg"
              style={{ color: config.trajectoryLine?.color ?? "#fbbf24" }}
            >
              {config.actionName}
            </h2>
            <p className="text-gray-300 text-sm mt-1">
              {config.chainType === "OFFENSIVE" && "Ataque em Cadeia"}
              {config.chainType === "DEFENSIVE" && "Defesa em Sequência"}
              {config.chainType === "FOCUSED" && "Ataque Concentrado"}
            </p>
          </motion.div>

          {/* Barra de progresso geral */}
          <div className="w-80 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
            <motion.div
              className="h-full"
              style={{
                backgroundColor: config.trajectoryLine?.color ?? "#fbbf24",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Indicadores de steps */}
          <div className="flex gap-2">
            {config.steps.map((_step, index) => {
              const completed = completedSteps.find(
                (s) => s.stepIndex === index
              );
              const isCurrent = currentStep?.stepIndex === index;

              return (
                <motion.div
                  key={index}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    isCurrent
                      ? "border-white scale-125"
                      : completed
                      ? "border-transparent"
                      : "border-gray-600"
                  }`}
                  style={{
                    backgroundColor: completed
                      ? getGradeColor(completed.grade)
                      : isCurrent
                      ? "#374151"
                      : "#1f2937",
                  }}
                  animate={isCurrent ? { scale: [1.25, 1.35, 1.25] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  {completed ? (
                    completed.grade === "PERFECT" ? (
                      "★"
                    ) : completed.grade === "HIT" ? (
                      "✓"
                    ) : (
                      "✗"
                    )
                  ) : (
                    <span className="text-gray-400">{index + 1}</span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Step atual - Barra do QTE */}
          {currentStep && !chainBroken && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3 mt-4"
            >
              {/* Nome do alvo */}
              <div className="text-white text-lg font-medium">
                Alvo: {currentStep.targetName}
              </div>

              {/* Barra do QTE */}
              <div
                className="relative w-72 h-10 bg-gray-800 rounded-full overflow-hidden border-2"
                style={{
                  borderColor: config.trajectoryLine?.color ?? "#fbbf24",
                }}
              >
                {/* Zona de acerto */}
                <div
                  className="absolute top-0 bottom-0 bg-green-500/40"
                  style={{
                    left: `${hitZoneStart}%`,
                    width: `${currentStep.hitZoneSize}%`,
                  }}
                />

                {/* Zona perfeita */}
                <div
                  className="absolute top-0 bottom-0 bg-yellow-400/60"
                  style={{
                    left: `${perfectZoneStart}%`,
                    width: `${currentStep.perfectZoneSize}%`,
                  }}
                />

                {/* Indicador */}
                <motion.div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                  style={{
                    left: `${indicatorPosition}%`,
                    boxShadow: "0 0 10px white, 0 0 20px white",
                  }}
                  animate={hasResponded ? {} : { opacity: [1, 0.7, 1] }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                />

                {/* Marcador central */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500" />
              </div>

              {/* Instrução */}
              <p className="text-gray-400 text-sm">
                Pressione <kbd className="px-2 py-1 bg-gray-700 rounded">E</kbd>{" "}
                na zona verde!
              </p>
            </motion.div>
          )}

          {/* Chain quebrado */}
          {chainBroken && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-red-500 text-3xl font-bold mt-4"
            >
              CORRENTE QUEBRADA!
            </motion.div>
          )}

          {/* Stats */}
          <div className="flex gap-6 mt-4 text-white">
            {/* Combo */}
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                x{currentCombo.toFixed(1)}
              </div>
              <div className="text-xs text-gray-400">COMBO</div>
            </div>

            {/* Hits */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {completedSteps.filter((s) => s.grade !== "FAIL").length}/
                {totalSteps}
              </div>
              <div className="text-xs text-gray-400">HITS</div>
            </div>

            {/* Dano */}
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {accumulatedDamage}
              </div>
              <div className="text-xs text-gray-400">DANO</div>
            </div>
          </div>

          {/* Último resultado */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 20 }}
                animate={{ scale: 1.2, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -20 }}
                className="text-4xl font-bold mt-2"
                style={{ color: getGradeColor(lastResult) }}
              >
                {lastResult === "PERFECT"
                  ? "PERFEITO!"
                  : lastResult === "HIT"
                  ? "ACERTOU!"
                  : "ERROU!"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChainQTEOverlay;
