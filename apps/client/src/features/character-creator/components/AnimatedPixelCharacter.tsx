// client/src/features/character-creator/components/AnimatedPixelCharacter.tsx
// Componente animado do personagem pixel art usando Framer Motion

import React, { useMemo, useId, useEffect } from "react";
import { motion, useAnimation, type Variants } from "framer-motion";
import type {
  CharacterConfig,
  PixelPosition,
  StyleOption,
  CharacterDirection,
  CharacterPose,
  WeaponStyleOption,
} from "@boundless/shared/types/character.types";
import { CHARACTER_GRID } from "@boundless/shared/types/character.types";
import {
  EYES_POSITIONS,
  MOUTH_POSITIONS,
  SHADOW_SHAPE,
  HAIR_STYLES,
  FACIAL_HAIR_STYLES,
  SHIRT_STYLES,
  PANTS_STYLES,
  SHOES_STYLES,
  ACCESSORY_STYLES,
  SKIN_SHADOW_MAP,
  WEAPON_STYLES,
  BODY_TYPES,
  POSES,
} from "@boundless/shared/data/character-creator";

// =============================================================================
// TIPOS
// =============================================================================

interface AnimatedPixelCharacterProps {
  /** Configuração do personagem */
  config: CharacterConfig;
  /** Tamanho do SVG em pixels */
  size?: number;
  /** Classes CSS adicionais */
  className?: string;
  /** Mostrar sombra no chão */
  showShadow?: boolean;
  /** Direção que o personagem está olhando */
  direction?: CharacterDirection;
  /** Pose atual (se não animado, usa esta) */
  pose?: CharacterPose;
  /** ID do elemento SVG (para exportação) */
  svgId?: string;
  /** Habilita animação de idle */
  animated?: boolean;
  /** Intensidade do sombreamento (0-1, padrão 0.3) */
  shadeIntensity?: number;
}

interface PixelData {
  positions: PixelPosition[];
  color: string;
  zIndex: number;
  layer: string; // identificador para animação
}

// =============================================================================
// CONSTANTES DE ANIMAÇÃO
// =============================================================================

// Animação de respiração/idle
const BREATHING_VARIANTS: Variants = {
  idle: {
    y: [0, -1, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Animação de balanço suave para braços
const ARM_SWAY_VARIANTS: Variants = {
  idle: {
    rotate: [0, 1, 0, -1, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Animação de piscar olhos
const BLINK_VARIANTS: Variants = {
  open: { scaleY: 1 },
  blink: {
    scaleY: [1, 0.1, 1],
    transition: {
      duration: 0.15,
      times: [0, 0.5, 1],
    },
  },
};

// Animação da sombra (pulsa com respiração)
const SHADOW_VARIANTS: Variants = {
  idle: {
    scaleX: [1, 1.05, 1],
    opacity: [0.3, 0.25, 0.3],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Configuração de transição para flip de direção
const DIRECTION_FLIP_TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
  duration: 0.3,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Retorna o scaleX baseado na direção
 * - Direções W, SW, NW: flip horizontal (-1)
 * - Outras direções: normal (1)
 */
const getDirectionScaleX = (direction: CharacterDirection): number => {
  const flipDirections: CharacterDirection[] = ["w", "sw", "nw"];
  return flipDirections.includes(direction) ? -1 : 1;
};

const getVisibilityForDirection = (
  direction: CharacterDirection
): {
  showFace: boolean;
  showBack: boolean;
  isProfile: boolean;
} => {
  switch (direction) {
    case "n":
      return { showFace: false, showBack: true, isProfile: false };
    case "ne":
    case "nw":
      return { showFace: false, showBack: true, isProfile: true };
    case "s":
      return { showFace: true, showBack: false, isProfile: false };
    case "se":
    case "sw":
    case "e":
    case "w":
      return { showFace: true, showBack: false, isProfile: true };
    default:
      return { showFace: true, showBack: false, isProfile: false };
  }
};

/**
 * Aplica sombreamento a uma cor (escurece)
 */
const shadeColor = (color: string, intensity: number): string => {
  // Se já é rgba, ajusta
  if (color.startsWith("rgba")) return color;
  if (color.startsWith("rgb")) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = Math.floor(parseInt(match[1]) * (1 - intensity));
      const g = Math.floor(parseInt(match[2]) * (1 - intensity));
      const b = Math.floor(parseInt(match[3]) * (1 - intensity));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  // Converte hex para rgb e escurece
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = Math.floor(parseInt(hex.substring(0, 2), 16) * (1 - intensity));
  const g = Math.floor(parseInt(hex.substring(2, 4), 16) * (1 - intensity));
  const b = Math.floor(parseInt(hex.substring(4, 6), 16) * (1 - intensity));
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Gera borda de sombreamento para uma forma
 */
const generateShadePixels = (
  positions: PixelPosition[],
  offsetX: number = 1,
  offsetY: number = 1
): PixelPosition[] => {
  const posSet = new Set(positions.map((p) => `${p.x},${p.y}`));
  const shadePixels: PixelPosition[] = [];

  positions.forEach((pos) => {
    // Adiciona sombra à direita/baixo
    const shadePos = { x: pos.x + offsetX, y: pos.y + offsetY };
    if (!posSet.has(`${shadePos.x},${shadePos.y}`)) {
      shadePixels.push(shadePos);
    }
  });

  // Remove duplicatas
  const uniqueShade: PixelPosition[] = [];
  const seen = new Set<string>();
  shadePixels.forEach((p) => {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueShade.push(p);
    }
  });

  return uniqueShade;
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export const AnimatedPixelCharacter: React.FC<AnimatedPixelCharacterProps> = ({
  config,
  size = 192,
  className = "",
  showShadow = true,
  direction = "s",
  pose = "idle",
  svgId,
  animated = true,
  shadeIntensity = 0.25,
}) => {
  const uniqueId = useId();
  const finalSvgId = svgId || `animated-character-${uniqueId}`;
  const pixelSize = size / CHARACTER_GRID.height;

  // Controle de animação para piscar olhos
  const eyeControls = useAnimation();

  // Timer para piscar aleatoriamente
  useEffect(() => {
    if (!animated) return;

    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6 segundos
      return setTimeout(async () => {
        await eyeControls.start("blink");
        scheduleBlink();
      }, delay);
    };

    const timerId = scheduleBlink();
    return () => clearTimeout(timerId);
  }, [animated, eyeControls]);

  // Visibilidade baseada na direção
  const visibility = useMemo(
    () => getVisibilityForDirection(direction),
    [direction]
  );

  // Tipo de corpo e pose
  const bodyType = useMemo(
    () =>
      BODY_TYPES.find((bt) => bt.id === config.bodyType) ||
      BODY_TYPES.find((bt) => bt.id === "normal")!,
    [config.bodyType]
  );

  const currentPose = useMemo(
    () => POSES.find((p) => p.id === pose) || POSES[0],
    [pose]
  );

  // Monta os pixels por camada
  const { bodyLayers, armLayers, shadowLayer, eyeLayers, otherLayers } =
    useMemo(() => {
      const body: PixelData[] = [];
      const arms: PixelData[] = [];
      const shadow: PixelData[] = [];
      const eyes: PixelData[] = [];
      const other: PixelData[] = [];

      const skinShadow = SKIN_SHADOW_MAP[config.skinColor] || config.skinColor;
      const bodyOffset = currentPose.bodyOffset || { x: 0, y: 0 };
      const offsetPositions = (positions: PixelPosition[]) =>
        positions.map((p) => ({
          x: p.x + bodyOffset.x,
          y: p.y + bodyOffset.y,
        }));

      // 0. Sombra no chão
      if (showShadow) {
        shadow.push({
          positions: SHADOW_SHAPE,
          color: "rgba(0,0,0,0.35)",
          zIndex: 0,
          layer: "shadow",
        });
      }

      // 1. Arma nas costas
      if (
        config.weaponStyle &&
        config.weaponStyle !== "none" &&
        config.weaponPosition === "back" &&
        !visibility.showBack
      ) {
        const weaponStyle = WEAPON_STYLES.find(
          (w: WeaponStyleOption) => w.id === config.weaponStyle
        );
        if (weaponStyle) {
          const weaponShape = weaponStyle.shapes.back;
          if (weaponShape.length > 0) {
            // Sombra da arma
            other.push({
              positions: generateShadePixels(weaponShape),
              color: "rgba(0,0,0,0.3)",
              zIndex: 0.5,
              layer: "weaponBackShade",
            });
            if (weaponStyle.secondaryPositions?.back) {
              other.push({
                positions: weaponStyle.secondaryPositions.back,
                color:
                  config.weaponSecondaryColor ||
                  weaponStyle.defaultSecondaryColor ||
                  "#78350f",
                zIndex: 1,
                layer: "weaponBack",
              });
            }
            const primaryPositions = weaponStyle.secondaryPositions?.back
              ? weaponShape.filter(
                  (pos) =>
                    !weaponStyle.secondaryPositions?.back.some(
                      (sp) => sp.x === pos.x && sp.y === pos.y
                    )
                )
              : weaponShape;
            other.push({
              positions: primaryPositions,
              color: config.weaponColor || weaponStyle.defaultColor,
              zIndex: 1,
              layer: "weaponBack",
            });
          }
        }
      }

      // 2. Corpo base (cabeça e torso) - sem braços
      const bodyShapeWithHead = [
        ...offsetPositions(bodyType.headShape),
        ...offsetPositions(bodyType.bodyShape),
      ];

      // Adiciona sombreamento ao corpo
      body.push({
        positions: generateShadePixels(bodyShapeWithHead, 1, 0),
        color: shadeColor(config.skinColor, shadeIntensity + 0.1),
        zIndex: 1.5,
        layer: "bodyShade",
      });

      body.push({
        positions: bodyShapeWithHead,
        color: config.skinColor,
        zIndex: 2,
        layer: "body",
      });

      // Mãos
      body.push({
        positions: currentPose.handsShape,
        color: config.skinColor,
        zIndex: 2,
        layer: "hands",
      });

      // 3. Braços (separados para animação)
      arms.push({
        positions: currentPose.armsShape,
        color: config.skinColor,
        zIndex: 2,
        layer: "arms",
      });

      // 4. Sombra da pele no rosto
      const faceShadowBase =
        config.bodyType === "heavy"
          ? [
              { x: 4, y: 4 },
              { x: 4, y: 5 },
              { x: 4, y: 6 },
              { x: 11, y: 4 },
              { x: 11, y: 5 },
              { x: 11, y: 6 },
            ]
          : [
              { x: 5, y: 4 },
              { x: 5, y: 5 },
              { x: 5, y: 6 },
              { x: 10, y: 4 },
              { x: 10, y: 5 },
              { x: 10, y: 6 },
            ];
      body.push({
        positions: offsetPositions(faceShadowBase),
        color: skinShadow,
        zIndex: 3,
        layer: "faceShadow",
      });

      // 5. Olhos e boca (apenas se visível)
      if (visibility.showFace) {
        eyes.push({
          positions: offsetPositions(EYES_POSITIONS),
          color: "#ffffff",
          zIndex: 4,
          layer: "eyes",
        });

        const pupilPositions: PixelPosition[] = [
          { x: 6, y: 4 },
          { x: 9, y: 4 },
        ];
        eyes.push({
          positions: offsetPositions(pupilPositions),
          color: config.eyeColor,
          zIndex: 5,
          layer: "pupils",
        });

        body.push({
          positions: offsetPositions(MOUTH_POSITIONS),
          color: "#c9785c",
          zIndex: 6,
          layer: "mouth",
        });
      }

      // 6. Pernas
      const legsOffset = currentPose.legsOffset || { x: 0, y: 0 };
      const offsetLegs = (positions: PixelPosition[]) =>
        positions.map((p) => ({
          x: p.x + legsOffset.x,
          y: p.y + legsOffset.y,
        }));

      // Sombra das pernas
      body.push({
        positions: generateShadePixels(offsetLegs(bodyType.legsShape), 1, 0),
        color: shadeColor(config.skinColor, shadeIntensity + 0.1),
        zIndex: 6.5,
        layer: "legsShade",
      });

      body.push({
        positions: offsetLegs(bodyType.legsShape),
        color: config.skinColor,
        zIndex: 7,
        layer: "legs",
      });

      // 7. Calça
      const pantsStyle = PANTS_STYLES.find(
        (s: StyleOption) => s.id === config.pantsStyle
      );
      if (pantsStyle && pantsStyle.shape.length > 0) {
        other.push({
          positions: generateShadePixels(pantsStyle.shape, 1, 0),
          color: shadeColor(config.pantsColor, shadeIntensity),
          zIndex: 7.5,
          layer: "pantsShade",
        });
        other.push({
          positions: pantsStyle.shape,
          color: config.pantsColor,
          zIndex: 8,
          layer: "pants",
        });
      }

      // 8. Sapatos
      const shoesStyle = SHOES_STYLES.find(
        (s: StyleOption) => s.id === config.shoesStyle
      );
      if (shoesStyle && shoesStyle.shape.length > 0) {
        const shoeColor =
          config.shoesStyle === "barefoot"
            ? config.skinColor
            : config.shoesColor;
        other.push({
          positions: generateShadePixels(shoesStyle.shape, 1, 0),
          color: shadeColor(shoeColor, shadeIntensity),
          zIndex: 8.5,
          layer: "shoesShade",
        });
        other.push({
          positions: shoesStyle.shape,
          color: shoeColor,
          zIndex: 9,
          layer: "shoes",
        });
      }

      // 9. Arma na cintura
      if (
        config.weaponStyle &&
        config.weaponStyle !== "none" &&
        config.weaponPosition === "waist"
      ) {
        const weaponStyle = WEAPON_STYLES.find(
          (w: WeaponStyleOption) => w.id === config.weaponStyle
        );
        if (weaponStyle) {
          const weaponShape = weaponStyle.shapes.waist;
          if (weaponShape.length > 0) {
            other.push({
              positions: generateShadePixels(weaponShape),
              color: "rgba(0,0,0,0.25)",
              zIndex: 9.5,
              layer: "weaponWaistShade",
            });
            if (weaponStyle.secondaryPositions?.waist) {
              other.push({
                positions: weaponStyle.secondaryPositions.waist,
                color:
                  config.weaponSecondaryColor ||
                  weaponStyle.defaultSecondaryColor ||
                  "#78350f",
                zIndex: 10,
                layer: "weaponWaist",
              });
            }
            const primaryPositions = weaponStyle.secondaryPositions?.waist
              ? weaponShape.filter(
                  (pos) =>
                    !weaponStyle.secondaryPositions?.waist.some(
                      (sp) => sp.x === pos.x && sp.y === pos.y
                    )
                )
              : weaponShape;
            other.push({
              positions: primaryPositions,
              color: config.weaponColor || weaponStyle.defaultColor,
              zIndex: 10,
              layer: "weaponWaist",
            });
          }
        }
      }

      // 10. Camisa
      const shirtStyle = SHIRT_STYLES.find(
        (s: StyleOption) => s.id === config.shirtStyle
      );
      if (shirtStyle) {
        // Sombra da camisa
        other.push({
          positions: generateShadePixels(shirtStyle.shape, 1, 0),
          color: shadeColor(config.shirtColor, shadeIntensity),
          zIndex: 10.5,
          layer: "shirtShade",
        });

        if (shirtStyle.multiColor && shirtStyle.secondaryPositions) {
          const primaryPositions = shirtStyle.shape.filter(
            (pos: PixelPosition) =>
              !shirtStyle.secondaryPositions?.some(
                (sp: PixelPosition) => sp.x === pos.x && sp.y === pos.y
              )
          );
          other.push({
            positions: primaryPositions,
            color: config.shirtColor,
            zIndex: 11,
            layer: "shirt",
          });
          other.push({
            positions: shirtStyle.secondaryPositions,
            color: config.shirtSecondaryColor || config.shirtColor,
            zIndex: 12,
            layer: "shirtSecondary",
          });
        } else {
          other.push({
            positions: shirtStyle.shape,
            color: config.shirtColor,
            zIndex: 11,
            layer: "shirt",
          });
        }
      }

      // 11. Cabelo
      const hairStyle = HAIR_STYLES.find(
        (s: StyleOption) => s.id === config.hairStyle
      );
      if (hairStyle && hairStyle.shape.length > 0) {
        // Sombra do cabelo
        other.push({
          positions: generateShadePixels(
            offsetPositions(hairStyle.shape),
            1,
            0
          ),
          color: shadeColor(config.hairColor, shadeIntensity + 0.15),
          zIndex: 12.5,
          layer: "hairShade",
        });
        other.push({
          positions: offsetPositions(hairStyle.shape),
          color: config.hairColor,
          zIndex: 13,
          layer: "hair",
        });
      }

      // 12. Barba/Facial Hair
      if (config.facialHairStyle && config.facialHairStyle !== "none") {
        const facialStyle = FACIAL_HAIR_STYLES.find(
          (s: StyleOption) => s.id === config.facialHairStyle
        );
        if (facialStyle && facialStyle.shape.length > 0) {
          other.push({
            positions: offsetPositions(facialStyle.shape),
            color: config.facialHairColor || config.hairColor,
            zIndex: 14,
            layer: "facialHair",
          });
        }
      }

      // 13. Acessórios
      if (config.accessoryStyle && config.accessoryStyle !== "none") {
        const accessoryStyle = ACCESSORY_STYLES.find(
          (s: StyleOption) => s.id === config.accessoryStyle
        );
        if (accessoryStyle && accessoryStyle.shape.length > 0) {
          other.push({
            positions: generateShadePixels(
              offsetPositions(accessoryStyle.shape),
              1,
              0
            ),
            color: shadeColor(
              config.accessoryColor || accessoryStyle.defaultColor,
              shadeIntensity
            ),
            zIndex: 14.5,
            layer: "accessoryShade",
          });
          other.push({
            positions: offsetPositions(accessoryStyle.shape),
            color: config.accessoryColor || accessoryStyle.defaultColor,
            zIndex: 15,
            layer: "accessory",
          });
        }
      }

      // 14. Arma na mão
      if (
        config.weaponStyle &&
        config.weaponStyle !== "none" &&
        config.weaponPosition === "hand"
      ) {
        const weaponStyle = WEAPON_STYLES.find(
          (w: WeaponStyleOption) => w.id === config.weaponStyle
        );
        if (weaponStyle) {
          const weaponShape = weaponStyle.shapes.hand;
          if (weaponShape.length > 0) {
            // Sombra da arma
            arms.push({
              positions: generateShadePixels(weaponShape),
              color: "rgba(0,0,0,0.3)",
              zIndex: 15.5,
              layer: "weaponHandShade",
            });
            if (weaponStyle.secondaryPositions?.hand) {
              arms.push({
                positions: weaponStyle.secondaryPositions.hand,
                color:
                  config.weaponSecondaryColor ||
                  weaponStyle.defaultSecondaryColor ||
                  "#78350f",
                zIndex: 16,
                layer: "weaponHand",
              });
            }
            const primaryPositions = weaponStyle.secondaryPositions?.hand
              ? weaponShape.filter(
                  (pos) =>
                    !weaponStyle.secondaryPositions?.hand.some(
                      (sp) => sp.x === pos.x && sp.y === pos.y
                    )
                )
              : weaponShape;
            arms.push({
              positions: primaryPositions,
              color: config.weaponColor || weaponStyle.defaultColor,
              zIndex: 17,
              layer: "weaponHand",
            });
          }
        }
      }

      return {
        bodyLayers: body,
        armLayers: arms,
        shadowLayer: shadow,
        eyeLayers: eyes,
        otherLayers: other,
      };
    }, [config, showShadow, bodyType, currentPose, visibility, shadeIntensity]);

  // Renderiza um pixel
  const renderPixel = (pos: PixelPosition, color: string, key: string) => (
    <rect
      key={key}
      x={pos.x * pixelSize}
      y={pos.y * pixelSize}
      width={pixelSize}
      height={pixelSize}
      fill={color}
    />
  );

  // Renderiza uma camada
  const renderLayer = (layers: PixelData[]) =>
    [...layers]
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((layer, layerIndex) =>
        layer.positions.map((pos, posIndex) =>
          renderPixel(
            pos,
            layer.color,
            `${layer.layer}-${layerIndex}-${posIndex}`
          )
        )
      );

  // Calcula o scaleX para animação suave de flip
  const directionScaleX = getDirectionScaleX(direction);

  return (
    <svg
      id={finalSvgId}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ imageRendering: "pixelated", overflow: "visible" }}
    >
      {/* Container principal com flip animado */}
      <motion.g
        animate={{ scaleX: directionScaleX }}
        transition={DIRECTION_FLIP_TRANSITION}
        style={{
          originX: 0.5,
          originY: 0.5,
          transformOrigin: `${size / 2}px ${size / 2}px`,
        }}
      >
        {/* Sombra no chão - animada */}
        <motion.g
          variants={animated ? SHADOW_VARIANTS : undefined}
          animate={animated ? "idle" : undefined}
          style={{ transformOrigin: `${size / 2}px ${size * 0.95}px` }}
        >
          {renderLayer(shadowLayer)}
        </motion.g>

        {/* Corpo principal - respira */}
        <motion.g
          variants={animated ? BREATHING_VARIANTS : undefined}
          animate={animated ? "idle" : undefined}
        >
          {/* Corpo, pernas, roupas */}
          {renderLayer(bodyLayers)}
          {renderLayer(otherLayers)}

          {/* Olhos - piscam */}
          <motion.g
            animate={eyeControls}
            initial="open"
            variants={BLINK_VARIANTS}
            style={{
              transformOrigin: `${size / 2}px ${
                4 * pixelSize + pixelSize / 2
              }px`,
            }}
          >
            {renderLayer(eyeLayers)}
          </motion.g>

          {/* Braços - balançam suavemente */}
          <motion.g
            variants={animated ? ARM_SWAY_VARIANTS : undefined}
            animate={animated ? "idle" : undefined}
            style={{ transformOrigin: `${size / 2}px ${10 * pixelSize}px` }}
          >
            {renderLayer(armLayers)}
          </motion.g>
        </motion.g>
      </motion.g>
    </svg>
  );
};

export default AnimatedPixelCharacter;
