// client/src/features/qte/components/QTEOverlay.tsx
// Componente de overlay para Quick Time Event
// UI do círculo fechando com feedback visual
//
// MODOS DE EXIBIÇÃO:
// - "modal": Centralizado na tela com overlay escurecido (para treinamento)
// - "inline": Posicionado sobre uma unidade no campo de batalha
//
// EXEMPLO DE USO EM BATALHA (inline):
// <QTEOverlay
//   config={qteConfig}
//   onResponse={handleResponse}
//   isResponder={isMyUnit}
//   displayMode="inline"
//   position={{ x: unitScreenX, y: unitScreenY }}
//   size={80}
// />
//
// EXEMPLO DE USO EM TREINAMENTO (modal):
// <QTEOverlay
//   config={qteConfig}
//   onResponse={handleResponse}
//   isResponder={true}
//   isTrainingMode={true}
// />

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHotkeys } from "react-hotkeys-hook";
import type {
  QTEConfig,
  QTEInput,
  QTEResultGrade,
} from "@boundless/shared/qte";
import { audioService } from "../../../services/audio.service";

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

  /** Modo treinamento: exibe textos tutoriais */
  isTrainingMode?: boolean;

  /**
   * Modo de exibição:
   * - "modal": Centralizado na tela com overlay escurecido (padrão, para treinamento)
   * - "inline": Posicionado sobre uma unidade no campo de batalha
   */
  displayMode?: "modal" | "inline";

  /**
   * Posição na tela (em pixels) - usado apenas no modo "inline"
   * Representa o centro da unidade sobre a qual o QTE será exibido
   */
  position?: { x: number; y: number };

  /**
   * Tamanho do círculo em pixels - usado apenas no modo "inline"
   * Padrão: 80px para inline, 256px para modal
   */
  size?: number;
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
  isTrainingMode = false,
  displayMode = "modal",
  position,
  size,
}) => {
  // Determinar tamanho baseado no modo
  const circleSize = size ?? (displayMode === "inline" ? 80 : 256);
  const isInlineMode = displayMode === "inline";

  // Estado do indicador (0-100%)
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [hasResponded, setHasResponded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultGrade, setResultGrade] = useState<QTEResultGrade | null>(null);
  // Indica se o jogador está "hovering" no modo block (para preview visual)
  const [isBlockMode, setIsBlockMode] = useState(false);
  // Shake offset para tremor dinâmico
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  // Refs para animação
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const countdownPlayedRef = useRef<boolean>(false);
  const startSoundPlayedRef = useRef<string | null>(null);

  // Calcular zonas de ESQUIVA (Focus vs Focus)
  const dodgeHitZoneStart = config ? 50 - config.hitZoneSize / 2 : 0;
  const dodgeHitZoneEnd = config ? 50 + config.hitZoneSize / 2 : 100;
  const dodgePerfectZoneStart = config ? 50 - config.perfectZoneSize / 2 : 0;
  const dodgePerfectZoneEnd = config ? 50 + config.perfectZoneSize / 2 : 100;

  // Calcular zonas de BLOQUEIO (Resistance vs Combat)
  const blockHitZoneSize =
    config?.blockHitZoneSize ?? config?.hitZoneSize ?? 25;
  const blockPerfectZoneSize =
    config?.blockPerfectZoneSize ?? config?.perfectZoneSize ?? 7.5;
  const blockHitZoneStart = 50 - blockHitZoneSize / 2;
  const blockHitZoneEnd = 50 + blockHitZoneSize / 2;
  const blockPerfectZoneStart = 50 - blockPerfectZoneSize / 2;
  const blockPerfectZoneEnd = 50 + blockPerfectZoneSize / 2;

  // Usar zonas de BLOCK ou DODGE baseado no modo atual
  const isDefenseQTE =
    config?.actionType === "DODGE" || config?.actionType === "BLOCK";
  const hitZoneStart =
    isDefenseQTE && isBlockMode ? blockHitZoneStart : dodgeHitZoneStart;
  const hitZoneEnd =
    isDefenseQTE && isBlockMode ? blockHitZoneEnd : dodgeHitZoneEnd;
  const perfectZoneStart =
    isDefenseQTE && isBlockMode ? blockPerfectZoneStart : dodgePerfectZoneStart;
  const perfectZoneEnd =
    isDefenseQTE && isBlockMode ? blockPerfectZoneEnd : dodgePerfectZoneEnd;
  const currentHitZoneSize =
    isDefenseQTE && isBlockMode ? blockHitZoneSize : config?.hitZoneSize ?? 25;
  const currentPerfectZoneSize =
    isDefenseQTE && isBlockMode
      ? blockPerfectZoneSize
      : config?.perfectZoneSize ?? 7.5;

  // Resetar estado quando novo QTE chega
  useEffect(() => {
    if (config && isVisualActive) {
      setIndicatorPosition(0);
      setHasResponded(false);
      setShowResult(false);
      setResultGrade(null);
      setIsBlockMode(false);
      startTimeRef.current = performance.now();
      countdownPlayedRef.current = false;

      // Tocar som de início apenas uma vez por QTE
      if (startSoundPlayedRef.current !== config.qteId) {
        startSoundPlayedRef.current = config.qteId;
        audioService.play("START");
      }
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

      // Som de countdown nos últimos 30% do tempo
      if (progress >= 0.7 && !countdownPlayedRef.current) {
        countdownPlayedRef.current = true;
        audioService.play("COUNTDOWN");
      }

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
      // indicatorPosition vai de 0 a 100
      // hitZoneStart/End estão centrados em 50 (ex: 37.5 a 62.5 para hitZoneSize=25)
      const isInHitZone =
        indicatorPosition >= hitZoneStart && indicatorPosition <= hitZoneEnd;
      const isInPerfectZone =
        indicatorPosition >= perfectZoneStart &&
        indicatorPosition <= perfectZoneEnd;

      console.log("[QTE] Input detectado:", {
        input,
        indicatorPosition: indicatorPosition.toFixed(1),
        hitZone: `${hitZoneStart.toFixed(1)} - ${hitZoneEnd.toFixed(1)}`,
        perfectZone: `${perfectZoneStart.toFixed(1)} - ${perfectZoneEnd.toFixed(
          1
        )}`,
        isInHitZone,
        isInPerfectZone,
        circleSize: `${(100 - indicatorPosition).toFixed(1)}%`,
      });

      let grade: QTEResultGrade = "FAIL";
      if (input !== "NONE") {
        if (isInPerfectZone) {
          grade = "PERFECT";
        } else if (isInHitZone) {
          grade = "HIT";
        }
      }

      console.log("[QTE] Resultado:", grade);

      // Tocar som baseado no resultado
      if (grade === "PERFECT") {
        // Para bloqueio perfeito, usar som específico
        if (input === "E" && isDefenseQTE) {
          audioService.play("BLOCK");
        } else {
          audioService.play("PERFECT");
        }
      } else if (grade === "HIT") {
        audioService.play("HIT");
      } else {
        audioService.play("MISS");
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

  // Detectar quando o jogador está "hovering" sobre a tecla E para preview da zona de BLOCK
  useEffect(() => {
    if (!isResponder || hasResponded || !isVisualActive || !isDefenseQTE)
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e" && !e.repeat) {
        setIsBlockMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") {
        setIsBlockMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isResponder, hasResponded, isVisualActive, isDefenseQTE]);

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

  // Hotkeys - Setas (Arrow Keys)
  useHotkeys(
    "ArrowUp",
    () => handleInput("W"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "ArrowLeft",
    () => handleInput("A"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "ArrowDown",
    () => handleInput("S"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );
  useHotkeys(
    "ArrowRight",
    () => handleInput("D"),
    { enabled: isResponder && !hasResponded && isVisualActive },
    [handleInput, isResponder, hasResponded, isVisualActive]
  );

  // Cores e estilos - calculados mesmo quando config é null (usa valores default)
  const isAttack = config?.actionType === "ATTACK";
  const isDefense =
    config?.actionType === "DODGE" || config?.actionType === "BLOCK";

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

  // ==========================================================================
  // CORES DINÂMICAS BASEADAS NOS PARÂMETROS DO QTE
  // ==========================================================================

  // Calcular "dificuldade" geral (0-100) baseado nos parâmetros
  // Duração curta + shake alto + hitZone pequena = mais difícil
  const getDifficultyLevel = () => {
    if (!config) return 50;

    // Normalizar duração (100-2000ms típico) - invertido (menor = mais difícil)
    const durationScore = Math.max(
      0,
      Math.min(100, ((2000 - config.duration) / 1900) * 100)
    );

    // Shake já está em 0-100
    const shakeScore = config.shakeIntensity;

    // hitZoneSize (1-50% típico) - invertido (menor = mais difícil)
    const hitZoneScore = Math.max(
      0,
      Math.min(100, ((50 - config.hitZoneSize) / 49) * 100)
    );

    // Média ponderada
    return durationScore * 0.4 + shakeScore * 0.3 + hitZoneScore * 0.3;
  };

  const difficultyLevel = getDifficultyLevel();

  // Gerar cores baseadas na dificuldade
  // Fácil (0-33): Verde/Azul - Calmo
  // Médio (34-66): Amarelo/Laranja - Alerta
  // Difícil (67-100): Vermelho/Magenta - Perigo
  const getDynamicColors = () => {
    const d = difficultyLevel;

    if (d < 33) {
      // Fácil - tons de verde/ciano
      const t = d / 33; // 0-1 dentro da faixa
      return {
        indicatorColor: `rgb(${Math.round(100 + t * 50)}, ${Math.round(
          220 - t * 20
        )}, ${Math.round(200 - t * 50)})`,
        indicatorGlow: `rgba(100, 220, 200, ${0.4 + t * 0.2})`,
        hitZoneColor: `rgba(34, 197, 94, ${0.5 + t * 0.1})`,
        hitZoneGlow: `rgba(34, 197, 94, ${0.5 + t * 0.1})`,
        perfectColor: `rgba(250, 204, 21, 0.7)`,
        backgroundTint: `rgba(20, 60, 50, 0.3)`,
      };
    } else if (d < 66) {
      // Médio - tons de amarelo/laranja
      const t = (d - 33) / 33; // 0-1 dentro da faixa
      return {
        indicatorColor: `rgb(${Math.round(255)}, ${Math.round(
          200 - t * 80
        )}, ${Math.round(100 - t * 50)})`,
        indicatorGlow: `rgba(255, 180, 50, ${0.5 + t * 0.2})`,
        hitZoneColor: `rgba(${Math.round(200 + t * 55)}, ${Math.round(
          150 - t * 50
        )}, 50, 0.5)`,
        hitZoneGlow: `rgba(255, 150, 50, ${0.5 + t * 0.1})`,
        perfectColor: `rgba(250, 204, 21, 0.8)`,
        backgroundTint: `rgba(60, 40, 20, 0.3)`,
      };
    } else {
      // Difícil - tons de vermelho/magenta
      const t = (d - 66) / 34; // 0-1 dentro da faixa
      return {
        indicatorColor: `rgb(${Math.round(255)}, ${Math.round(
          100 - t * 60
        )}, ${Math.round(100 + t * 80)})`,
        indicatorGlow: `rgba(255, 80, 120, ${0.6 + t * 0.2})`,
        hitZoneColor: `rgba(239, 68, 68, ${0.5 + t * 0.2})`,
        hitZoneGlow: `rgba(239, 68, 68, ${0.5 + t * 0.2})`,
        perfectColor: `rgba(250, 150, 50, 0.9)`,
        backgroundTint: `rgba(60, 20, 30, 0.4)`,
      };
    }
  };

  const dynamicColors = getDynamicColors();

  // Animação de shake (tremor)
  useEffect(() => {
    if (!config || hasResponded || config.shakeIntensity <= 0) {
      setShakeOffset({ x: 0, y: 0 });
      return;
    }

    // Intensidade do shake: quanto maior, mais forte o tremor
    const intensity = config.shakeIntensity;
    // Intervalo entre shakes: quanto maior a intensidade, mais rápido
    const interval = Math.max(16, 80 - intensity);

    const shakeInterval = setInterval(() => {
      // Gerar offsets aleatórios baseados na intensidade
      const maxOffset = intensity * 0.3; // Até 30px para intensidade 100
      const x = (Math.random() - 0.5) * 2 * maxOffset;
      const y = (Math.random() - 0.5) * 2 * maxOffset;
      setShakeOffset({ x, y });
    }, interval);

    return () => clearInterval(shakeInterval);
  }, [config?.qteId, config?.shakeIntensity, hasResponded]);

  // Shake style aplicado ao container do círculo
  // No modo inline, reduzir intensidade do shake proporcionalmente ao tamanho
  const shakeScale = isInlineMode ? circleSize / 256 : 1;
  const shakeStyle = {
    transform: `translate(${shakeOffset.x * shakeScale}px, ${
      shakeOffset.y * shakeScale
    }px)`,
    transition: "transform 0.05s ease-out",
  };

  // ==========================================================================
  // EARLY RETURN - Não renderizar se não há QTE ou visual não está ativo
  // ==========================================================================
  if (!config || !isVisualActive) return null;

  // ==========================================================================
  // RENDER - Unified return (inline ou modal baseado no modo)
  // ==========================================================================

  // Posição para modo inline
  const posX = position?.x ?? 0;
  const posY = position?.y ?? 0;

  // Modo inline: renderizar sobre a unidade no campo de batalha
  if (isInlineMode) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed z-50 pointer-events-none"
          style={{
            left: posX,
            top: posY,
            transform: "translate(-50%, -100%)", // Posicionar acima da unidade
            marginTop: -10, // Pequeno offset para ficar acima
          }}
        >
          {/* Container do QTE inline */}
          <div
            className="relative flex flex-col items-center"
            style={shakeStyle}
          >
            {/* Círculo do QTE - tamanho dinâmico */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: circleSize, height: circleSize }}
            >
              {/* Fundo escuro do círculo */}
              <div
                className="absolute w-full h-full rounded-full"
                style={{ backgroundColor: dynamicColors.backgroundTint }}
              />

              {/* Zona de acerto usando SVG */}
              <svg className="absolute w-full h-full" viewBox="0 0 100 100">
                {/* Anel da zona de acerto */}
                <circle
                  cx="50"
                  cy="50"
                  r={(100 - hitZoneStart + (100 - hitZoneEnd)) / 4}
                  fill="none"
                  stroke={
                    isBlockMode
                      ? "rgba(59, 130, 246, 0.5)"
                      : dynamicColors.hitZoneColor
                  }
                  strokeWidth={(100 - hitZoneStart - (100 - hitZoneEnd)) / 2}
                  style={{
                    filter: isBlockMode
                      ? "drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))"
                      : `drop-shadow(0 0 4px ${dynamicColors.hitZoneGlow})`,
                  }}
                />
                {/* Anel da zona perfeita */}
                <circle
                  cx="50"
                  cy="50"
                  r={(100 - perfectZoneStart + (100 - perfectZoneEnd)) / 4}
                  fill="none"
                  stroke={dynamicColors.perfectColor}
                  strokeWidth={
                    (100 - perfectZoneStart - (100 - perfectZoneEnd)) / 2
                  }
                  style={{
                    filter: `drop-shadow(0 0 3px ${dynamicColors.perfectColor})`,
                  }}
                />
              </svg>

              {/* Círculo central (mira) - menor no modo inline */}
              <div
                className="absolute bg-white rounded-full z-10"
                style={{
                  width: Math.max(4, circleSize * 0.04),
                  height: Math.max(4, circleSize * 0.04),
                  boxShadow: "0 0 4px white, 0 0 8px rgba(255,255,255,0.5)",
                }}
              />

              {/* Círculo que diminui (indicador) */}
              <motion.div
                className="absolute rounded-full pointer-events-none z-20"
                style={{
                  border: `${Math.max(2, circleSize * 0.012)}px solid ${
                    dynamicColors.indicatorColor
                  }`,
                  boxShadow: hasResponded
                    ? "none"
                    : `0 0 6px ${dynamicColors.indicatorGlow}, 0 0 12px ${dynamicColors.indicatorGlow}`,
                }}
                initial={{ width: "100%", height: "100%", opacity: 1 }}
                animate={{
                  width: `${100 - indicatorPosition}%`,
                  height: `${100 - indicatorPosition}%`,
                  opacity: hasResponded ? 0.3 : 1,
                }}
                transition={{ duration: 0.016, ease: "linear" }}
              />
            </div>

            {/* Resultado inline - menor e mais discreto */}
            <AnimatePresence>
              {showResult && resultGrade && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute -bottom-6 text-sm font-bold whitespace-nowrap"
                  style={{ color: getResultColor(resultGrade) }}
                >
                  {getResultText(resultGrade)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ==========================================================================
  // RENDER - MODO MODAL (centralizado, para treinamento)
  // ==========================================================================
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
          {/* Título do QTE - SÓ APARECE NO TREINAMENTO */}
          {isTrainingMode && (
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
                  <kbd
                    className={`px-2 py-1 rounded ${
                      isBlockMode ? "bg-blue-600 text-white" : "bg-gray-700"
                    }`}
                  >
                    E
                  </kbd>{" "}
                  Bloquear |{" "}
                  <kbd
                    className={`px-2 py-1 rounded ${
                      !isBlockMode ? "bg-green-600 text-white" : "bg-gray-700"
                    }`}
                  >
                    WASD
                  </kbd>{" "}
                  Esquivar
                </p>
              )}
              {isResponder && isDefense && isBlockMode && (
                <p className="text-xs text-blue-400 mt-1">
                  🛡️ Modo Bloqueio (Resistance)
                </p>
              )}
              {isResponder && isAttack && (
                <p className="text-sm text-gray-300 mt-1">
                  Pressione{" "}
                  <kbd className="px-2 py-1 bg-gray-700 rounded">E</kbd> na zona
                  verde!
                </p>
              )}
            </motion.div>
          )}

          {/* Círculo do QTE - com shake */}
          <div
            className="relative w-64 h-64 flex items-center justify-center"
            style={shakeStyle}
          >
            {/* 
              Lógica: indicatorPosition vai de 0% a 100%
              O círculo diminui de 100% para 0% (tamanho = 100 - indicatorPosition)
              
              Zona de acerto: hitZoneStart a hitZoneEnd (centrado em 50%)
              Quando indicatorPosition = hitZoneStart, círculo está em (100-hitZoneStart)%
              Quando indicatorPosition = hitZoneEnd, círculo está em (100-hitZoneEnd)%
              
              SVG viewBox 100x100: raio 50 = 100% do container
              Para anel entre X% e Y%: raio = (X + Y) / 4, strokeWidth = (X - Y) / 2
            */}

            {/* Fundo escuro do círculo - com tint dinâmico */}
            <div
              className="absolute w-full h-full rounded-full bg-gray-900/80"
              style={{ backgroundColor: dynamicColors.backgroundTint }}
            />

            {/* Zona de acerto (anel verde/azul) - usando SVG para precisão */}
            <svg className="absolute w-full h-full" viewBox="0 0 100 100">
              {/* Anel da zona de acerto - cor dinâmica baseada na dificuldade */}
              <circle
                cx="50"
                cy="50"
                r={(100 - hitZoneStart + (100 - hitZoneEnd)) / 4}
                fill="none"
                stroke={
                  isBlockMode
                    ? "rgba(59, 130, 246, 0.5)"
                    : dynamicColors.hitZoneColor
                }
                strokeWidth={(100 - hitZoneStart - (100 - hitZoneEnd)) / 2}
                style={{
                  filter: isBlockMode
                    ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))"
                    : `drop-shadow(0 0 8px ${dynamicColors.hitZoneGlow})`,
                }}
              />
              {/* Anel da zona perfeita - cor dinâmica */}
              <circle
                cx="50"
                cy="50"
                r={(100 - perfectZoneStart + (100 - perfectZoneEnd)) / 4}
                fill="none"
                stroke={dynamicColors.perfectColor}
                strokeWidth={
                  (100 - perfectZoneStart - (100 - perfectZoneEnd)) / 2
                }
                style={{
                  filter: `drop-shadow(0 0 6px ${dynamicColors.perfectColor})`,
                }}
              />
            </svg>

            {/* Círculo central (mira) */}
            <div
              className="absolute w-3 h-3 bg-white rounded-full z-10"
              style={{
                boxShadow: "0 0 8px white, 0 0 16px rgba(255,255,255,0.5)",
              }}
            />

            {/* Círculo que diminui (indicador) - cor dinâmica */}
            <motion.div
              className="absolute rounded-full pointer-events-none z-20"
              style={{
                border: `3px solid ${dynamicColors.indicatorColor}`,
                boxShadow: hasResponded
                  ? "none"
                  : `0 0 10px ${dynamicColors.indicatorGlow}, 0 0 20px ${dynamicColors.indicatorGlow}`,
              }}
              initial={{ width: "100%", height: "100%", opacity: 1 }}
              animate={{
                width: `${100 - indicatorPosition}%`,
                height: `${100 - indicatorPosition}%`,
                opacity: hasResponded ? 0.3 : 1,
              }}
              transition={{ duration: 0.016, ease: "linear" }}
            />

            {/* Marcadores cardeais */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-gray-500/60 z-10" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-gray-500/60 z-10" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-gray-500/60 z-10" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-gray-500/60 z-10" />
          </div>

          {/* Direção do ataque (para defesa) - SÓ APARECE NO TREINAMENTO */}
          {isTrainingMode && isDefense && config.attackDirection && (
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

          {/* Timer visual - SÓ APARECE NO TREINAMENTO */}
          {isTrainingMode && !hasResponded && (
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
