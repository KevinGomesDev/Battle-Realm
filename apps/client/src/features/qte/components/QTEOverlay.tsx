// client/src/features/qte/components/QTEOverlay.tsx
// Componente de overlay para Quick Time Event
// UI do círculo fechando com feedback visual

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHotkeys } from "react-hotkeys-hook";
import type {
  QTEConfig,
  QTEInput,
  QTEResultGrade,
} from "@boundless/shared/qte";

// =============================================================================
// PROPS
// =============================================================================

interface QTEOverlayProps {
  /** Configuração do QTE atual */
  config: QTEConfig | null;

  /** Callback quando o jogador responde */
  onResponse: (input: QTEInput, hitPosition: number) => void;

  /** Se o jogador é quem deve responder */
  isResponder: boolean;

  /** Se o visual está ativo (após sync time) */
  isVisualActive?: boolean;

  /** Nome da unidade respondendo (para display) */
  responderName?: string;

  /** Nome do atacante (para contexto) */
  attackerName?: string;

  /** Resultado externo (do servidor, para observadores) */
  externalResult?: QTEResultGrade | null;
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const QTEOverlay: React.FC<QTEOverlayProps> = ({
  config,
  onResponse,
  isResponder,
  isVisualActive = true,
  responderName = "Unidade",
  attackerName = "Inimigo",
  externalResult = null,
}) => {
  // Estado do indicador (0-100%)
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [hasResponded, setHasResponded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultGrade, setResultGrade] = useState<QTEResultGrade | null>(null);

  // Refs para animação
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Calcular zonas
  const hitZoneStart = config ? 50 - config.hitZoneSize / 2 : 0;
  const hitZoneEnd = config ? 50 + config.hitZoneSize / 2 : 100;
  const perfectZoneStart = config ? 50 - config.perfectZoneSize / 2 : 0;
  const perfectZoneEnd = config ? 50 + config.perfectZoneSize / 2 : 100;

  // Resetar estado quando novo QTE chega
  useEffect(() => {
    if (config && isVisualActive) {
      setIndicatorPosition(0);
      setHasResponded(false);
      setShowResult(false);
      setResultGrade(null);
      startTimeRef.current = performance.now();
    }
  }, [config?.qteId, isVisualActive]);

  // Quando receber resultado externo (para observadores)
  useEffect(() => {
    if (externalResult && !isResponder) {
      setResultGrade(externalResult);
      setShowResult(true);
      setHasResponded(true);
      // Cancelar animação
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [externalResult, isResponder]);

  // Animação do indicador (roda para todos para visualização)
  useEffect(() => {
    // Observadores também veem a animação, mas não podem responder
    if (!config || !isVisualActive) return;
    // Se já respondeu, não continua animação (só para responder)
    if (hasResponded && isResponder) return;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / config.duration, 1);

      // Indicador vai de 0 a 100
      setIndicatorPosition(progress * 100);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else if (isResponder) {
        // Tempo esgotado - só responder envia NONE
        handleInput("NONE");
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [config?.qteId, hasResponded, isResponder, isVisualActive]);

  // Handler de input
  const handleInput = useCallback(
    (input: QTEInput) => {
      if (hasResponded || !config || !isResponder) return;

      setHasResponded(true);

      // Cancelar animação
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

      setResultGrade(grade);
      setShowResult(true);

      // Enviar resposta
      onResponse(input, indicatorPosition);

      // Esconder resultado após delay
      setTimeout(() => {
        setShowResult(false);
      }, 1000);
    },
    [
      hasResponded,
      config,
      isResponder,
      indicatorPosition,
      hitZoneStart,
      hitZoneEnd,
      perfectZoneStart,
      perfectZoneEnd,
      onResponse,
    ]
  );

  // Hotkeys
  useHotkeys(
    "e",
    () => handleInput("E"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "w",
    () => handleInput("W"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "a",
    () => handleInput("A"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "s",
    () => handleInput("S"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "d",
    () => handleInput("D"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );

  // Não renderizar se não há QTE ou visual não está ativo
  if (!config || !isVisualActive) return null;

  // Cores e estilos
  const isAttack = config.actionType === "ATTACK";
  const isDefense =
    config.actionType === "DODGE" || config.actionType === "BLOCK";

  const getResultColor = (grade: QTEResultGrade | null) => {
    switch (grade) {
      case "PERFECT":
        return "#eab308"; // Dourado
      case "HIT":
        return "#22c55e"; // Verde
      case "FAIL":
        return "#ef4444"; // Vermelho
      default:
        return "#6b7280"; // Cinza
    }
  };

  const getResultText = (grade: QTEResultGrade | null) => {
    if (isAttack) {
      switch (grade) {
        case "PERFECT":
          return "CRÍTICO!";
        case "HIT":
          return "ACERTOU!";
        case "FAIL":
          return "FRACO...";
        default:
          return "";
      }
    } else {
      switch (grade) {
        case "PERFECT":
          return "PERFEITO!";
        case "HIT":
          return "DEFENDEU!";
        case "FAIL":
          return "FALHOU!";
        default:
          return "";
      }
    }
  };

  // Shake style
  const shakeStyle =
    config.shakeIntensity > 0 && !hasResponded
      ? {
          animation: `shake ${100 / (config.shakeIntensity + 1)}ms infinite`,
        }
      : {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        {/* Overlay escurecido */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Container principal */}
        <div
          className="relative flex flex-col items-center gap-6"
          style={shakeStyle}
        >
          {/* Título do QTE */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center"
          >
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              {isAttack
                ? `${responderName} Ataca!`
                : `${attackerName} Ataca ${responderName}!`}
            </h2>
            {/* Indicação para observadores */}
            {!isResponder && (
              <p className="text-xs text-gray-400 mt-1 italic">
                👁️ Observando...
              </p>
            )}
            {isResponder && isDefense && (
              <p className="text-sm text-gray-300 mt-1">
                <kbd className="px-2 py-1 bg-gray-700 rounded">E</kbd> Bloquear
                | <kbd className="px-2 py-1 bg-gray-700 rounded">WASD</kbd>{" "}
                Esquivar
              </p>
            )}
            {isResponder && isAttack && (
              <p className="text-sm text-gray-300 mt-1">
                Pressione <kbd className="px-2 py-1 bg-gray-700 rounded">E</kbd>{" "}
                na zona verde!
              </p>
            )}
          </motion.div>

          {/* Barra do QTE */}
          <div className="relative w-80 h-12 bg-gray-800 rounded-full overflow-hidden border-2 border-gray-600">
            {/* Zona de acerto (verde) */}
            <div
              className="absolute top-0 bottom-0 bg-green-500/40"
              style={{
                left: `${hitZoneStart}%`,
                width: `${config.hitZoneSize}%`,
              }}
            />

            {/* Zona perfeita (dourada) */}
            <div
              className="absolute top-0 bottom-0 bg-yellow-400/60"
              style={{
                left: `${perfectZoneStart}%`,
                width: `${config.perfectZoneSize}%`,
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
              transition={{ duration: 0.2, repeat: Infinity }}
            />

            {/* Marcador central */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500" />
          </div>

          {/* Direção do ataque (para defesa) */}
          {isDefense && config.attackDirection && (
            <div className="flex gap-4 text-white">
              <DirectionIndicator
                direction="UP"
                isAttackDirection={config.attackDirection === "UP"}
                isBlocked={config.invalidInputs?.includes("W")}
              />
              <DirectionIndicator
                direction="LEFT"
                isAttackDirection={config.attackDirection === "LEFT"}
                isBlocked={config.invalidInputs?.includes("A")}
              />
              <DirectionIndicator
                direction="DOWN"
                isAttackDirection={config.attackDirection === "DOWN"}
                isBlocked={config.invalidInputs?.includes("S")}
              />
              <DirectionIndicator
                direction="RIGHT"
                isAttackDirection={config.attackDirection === "RIGHT"}
                isBlocked={config.invalidInputs?.includes("D")}
              />
            </div>
          )}

          {/* Resultado */}
          <AnimatePresence>
            {showResult && resultGrade && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="text-4xl font-bold"
                style={{ color: getResultColor(resultGrade) }}
              >
                {getResultText(resultGrade)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timer visual */}
          {!hasResponded && (
            <div className="w-60 h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{
                  duration: config.duration / 1000,
                  ease: "linear",
                }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// =============================================================================
// COMPONENTE DE INDICADOR DE DIREÇÃO
// =============================================================================

interface DirectionIndicatorProps {
  direction: "UP" | "DOWN" | "LEFT" | "RIGHT";
  isAttackDirection: boolean;
  isBlocked?: boolean;
}

const DirectionIndicator: React.FC<DirectionIndicatorProps> = ({
  direction,
  isAttackDirection,
  isBlocked,
}) => {
  const getArrow = () => {
    switch (direction) {
      case "UP":
        return "↑";
      case "DOWN":
        return "↓";
      case "LEFT":
        return "←";
      case "RIGHT":
        return "→";
    }
  };

  const getKey = () => {
    switch (direction) {
      case "UP":
        return "W";
      case "DOWN":
        return "S";
      case "LEFT":
        return "A";
      case "RIGHT":
        return "D";
    }
  };

  let bgColor = "bg-gray-600";
  let textColor = "text-white";

  if (isAttackDirection) {
    bgColor = "bg-red-600";
    textColor = "text-white";
  } else if (isBlocked) {
    bgColor = "bg-gray-800";
    textColor = "text-gray-500";
  } else {
    bgColor = "bg-green-600";
    textColor = "text-white";
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-12 h-12 ${bgColor} ${textColor} rounded-lg flex items-center justify-center text-2xl font-bold transition-colors`}
      >
        {getArrow()}
      </div>
      <span
        className={`text-xs ${isBlocked ? "text-gray-500" : "text-gray-300"}`}
      >
        {getKey()}
        {isAttackDirection && " ⚠️"}
        {isBlocked && !isAttackDirection && " 🚫"}
      </span>
    </div>
  );
};

export default QTEOverlay;
