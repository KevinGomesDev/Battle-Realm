// client/src/features/battle/components/canvas/components/BattleUnitSprite.tsx
// Componente React para renderizar unidades no mapa de batalha usando SVG animado
// Alternativa ao sistema de sprites PNG para unidades com personagens customizados

import React, { useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import type {
  CharacterConfig,
  CharacterDirection,
} from "@boundless/shared/types/character.types";
import type { CombatAnimationState } from "../sprite.config";
import { AnimatedPixelCharacter } from "../../../../character-creator/components/AnimatedPixelCharacter";

// =============================================================================
// TIPOS
// =============================================================================

interface BattleUnitSpriteProps {
  /** Configuração visual do personagem */
  characterConfig: CharacterConfig;
  /** Tamanho do sprite (padrão: tamanho da célula) */
  size?: number;
  /** Direção que a unidade está olhando */
  direction?: CharacterDirection;
  /** Estado de animação de combate */
  combatState?: CombatAnimationState;
  /** Se a unidade está selecionada */
  isSelected?: boolean;
  /** Se a unidade pertence ao jogador local */
  isOwned?: boolean;
  /** HP atual (0-1 normalizado) */
  hpPercent?: number;
  /** Se a unidade está em cooldown de ação */
  isExhausted?: boolean;
  /** Callback ao clicar na unidade */
  onClick?: () => void;
  /** Callback ao passar o mouse */
  onHover?: () => void;
  /** Classes CSS extras */
  className?: string;
}

// =============================================================================
// MAPEAMENTO DE ESTADOS
// =============================================================================

/** Mapeia estado de combate para pose do personagem */
const COMBAT_STATE_TO_POSE: Record<CombatAnimationState, string> = {
  idle: "idle",
  walking: "walk_1",
  attacking: "attack",
  damaged: "hurt",
  dead: "dead",
};

// =============================================================================
// ANIMAÇÕES
// =============================================================================

// Animação de hover (escala leve)
const HOVER_VARIANTS: Variants = {
  idle: { scale: 1 },
  hover: {
    scale: 1.08,
    transition: { duration: 0.15, ease: "easeOut" },
  },
};

// Animação de seleção (brilho pulsante)
const SELECTION_VARIANTS: Variants = {
  unselected: {
    boxShadow: "0 0 0 rgba(239, 68, 68, 0)",
    borderColor: "transparent",
  },
  selected: {
    boxShadow: [
      "0 0 8px rgba(239, 68, 68, 0.4)",
      "0 0 16px rgba(239, 68, 68, 0.6)",
      "0 0 8px rgba(239, 68, 68, 0.4)",
    ],
    borderColor: "#ef4444",
    transition: {
      boxShadow: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  },
};

// Animação de ataque (avança + escala)
const ATTACK_VARIANTS: Variants = {
  idle: {
    x: 0,
    scale: 1,
  },
  attacking: {
    x: [0, 8, -2, 0],
    scale: [1, 1.15, 1.05, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.3, 0.7, 1],
      ease: "easeOut",
    },
  },
};

// Animação de dano (shake + flash vermelho)
const DAMAGE_VARIANTS: Variants = {
  idle: {
    x: 0,
    filter: "brightness(1) saturate(1)",
  },
  damaged: {
    x: [-4, 4, -3, 3, -2, 2, 0],
    filter: [
      "brightness(1) saturate(1)",
      "brightness(1.8) saturate(0.5) sepia(0.5)",
      "brightness(1) saturate(1)",
      "brightness(1.5) saturate(0.7) sepia(0.3)",
      "brightness(1) saturate(1)",
    ],
    transition: {
      duration: 0.5,
      times: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
};

// Animação de morte (fade + queda)
const DEATH_VARIANTS: Variants = {
  alive: {
    opacity: 1,
    rotate: 0,
    y: 0,
    filter: "grayscale(0)",
  },
  dead: {
    opacity: 0.4,
    rotate: 90,
    y: 10,
    filter: "grayscale(100%)",
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

// Animação de exaustão (dessaturar)
const EXHAUSTED_FILTER = "grayscale(60%) brightness(0.7)";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calcula o filtro visual baseado no HP
 * - HP alto: normal
 * - HP médio: leve dessaturação + vermelhidão
 * - HP baixo: mais vermelho, mais escuro, pulsa
 */
const getHealthFilter = (hpPercent: number, isExhausted: boolean): string => {
  if (isExhausted) return EXHAUSTED_FILTER;

  if (hpPercent > 0.7) {
    // Saudável - sem modificação
    return "none";
  } else if (hpPercent > 0.4) {
    // Ferido leve - leve vermelhidão
    const intensity = 1 - (hpPercent - 0.4) / 0.3; // 0 a 1
    return `saturate(${1 - intensity * 0.2}) sepia(${
      intensity * 0.15
    }) hue-rotate(-${intensity * 10}deg)`;
  } else if (hpPercent > 0.15) {
    // Ferido grave - vermelho e escurecido
    const intensity = 1 - (hpPercent - 0.15) / 0.25; // 0 a 1
    return `saturate(${0.8 - intensity * 0.3}) sepia(${
      0.15 + intensity * 0.2
    }) hue-rotate(-${10 + intensity * 15}deg) brightness(${
      1 - intensity * 0.15
    })`;
  } else {
    // Crítico - muito vermelho e escuro
    return "saturate(0.4) sepia(0.4) hue-rotate(-25deg) brightness(0.75)";
  }
};

/**
 * Calcula a intensidade do sombreamento baseado no HP
 */
const getShadeIntensity = (hpPercent: number, isExhausted: boolean): number => {
  if (isExhausted) return 0.45;
  if (hpPercent > 0.7) return 0.25;
  if (hpPercent > 0.4) return 0.3;
  if (hpPercent > 0.15) return 0.35;
  return 0.4;
};

// =============================================================================
// COMPONENTE
// =============================================================================

export const BattleUnitSprite: React.FC<BattleUnitSpriteProps> = ({
  characterConfig,
  size = 64,
  direction = "s",
  combatState = "idle",
  isSelected = false,
  isOwned = false,
  hpPercent = 1,
  isExhausted = false,
  onClick,
  onHover,
  className = "",
}) => {
  // Mapeia estado de combate para pose
  const pose = useMemo(() => {
    return COMBAT_STATE_TO_POSE[combatState] || "idle";
  }, [combatState]);

  // Determina se deve animar (não anima se morto ou exausto)
  const shouldAnimate = combatState !== "dead" && !isExhausted;

  // Calcula filtro visual baseado no HP
  const healthFilter = useMemo(() => {
    return getHealthFilter(hpPercent, isExhausted);
  }, [hpPercent, isExhausted]);

  // Calcula intensidade do sombreamento baseado no HP
  const shadeIntensity = useMemo(() => {
    return getShadeIntensity(hpPercent, isExhausted);
  }, [hpPercent, isExhausted]);

  // Cor de borda baseada em ownership
  const ownerBorderColor = isOwned ? "#3b82f6" : "#ef4444"; // Azul vs Vermelho

  // Determina o estado de animação atual
  const getAnimationState = () => {
    if (combatState === "attacking") return "attacking";
    if (combatState === "damaged") return "damaged";
    return "idle";
  };

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      onMouseEnter={onHover}
      variants={HOVER_VARIANTS}
      initial="idle"
      whileHover="hover"
    >
      {/* Container com borda de seleção */}
      <motion.div
        className="absolute inset-0 rounded-lg border-2"
        variants={SELECTION_VARIANTS}
        animate={isSelected ? "selected" : "unselected"}
        style={{ borderColor: isSelected ? "#ef4444" : "transparent" }}
      />

      {/* Container de animação de ataque */}
      <motion.div
        variants={ATTACK_VARIANTS}
        animate={combatState === "attacking" ? "attacking" : "idle"}
      >
        {/* Container de animação de dano */}
        <motion.div variants={DAMAGE_VARIANTS} animate={getAnimationState()}>
          {/* Container de morte */}
          <motion.div
            variants={DEATH_VARIANTS}
            animate={combatState === "dead" ? "dead" : "alive"}
            style={{
              transformOrigin: "bottom center",
            }}
          >
            {/* Container de filtro de HP */}
            <motion.div
              animate={{
                filter: healthFilter,
              }}
              transition={{ duration: 0.5 }}
            >
              {/* Efeito de pulso crítico quando HP muito baixo */}
              <motion.div
                animate={
                  hpPercent <= 0.15 && combatState !== "dead"
                    ? {
                        opacity: [1, 0.7, 1],
                      }
                    : { opacity: 1 }
                }
                transition={
                  hpPercent <= 0.15
                    ? {
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                    : {}
                }
              >
                {/* Personagem SVG Animado */}
                <AnimatedPixelCharacter
                  config={characterConfig}
                  size={size}
                  direction={direction}
                  pose={
                    pose as
                      | "idle"
                      | "walk_1"
                      | "walk_2"
                      | "attack"
                      | "hurt"
                      | "dead"
                  }
                  animated={shouldAnimate}
                  showShadow={combatState !== "dead"}
                  shadeIntensity={shadeIntensity}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Indicador de ownership (pequeno círculo no canto) */}
      <div
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-black/30"
        style={{ backgroundColor: ownerBorderColor }}
      />

      {/* Indicador visual de HP crítico (borda vermelha pulsante) */}
      {hpPercent <= 0.25 && hpPercent > 0 && combatState !== "dead" && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 pointer-events-none"
          style={{ borderColor: "rgba(220, 38, 38, 0.6)" }}
          animate={{
            borderColor: [
              "rgba(220, 38, 38, 0.3)",
              "rgba(220, 38, 38, 0.7)",
              "rgba(220, 38, 38, 0.3)",
            ],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Indicador de Seleção (anel externo) */}
      {isSelected && (
        <motion.div
          className="absolute -inset-1 rounded-xl border-2 border-dashed pointer-events-none"
          style={{ borderColor: "#fbbf24" }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            rotate: {
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            },
          }}
        />
      )}
    </motion.div>
  );
};

export default BattleUnitSprite;
