// client/src/features/character-creator/components/PixelCharacterSVG.tsx
// Componente SVG que renderiza o personagem pixel art

import React, { useMemo, useId } from "react";
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

interface PixelCharacterSVGProps {
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
  /** Pose atual do personagem */
  pose?: CharacterPose;
  /** ID do elemento SVG (para exportação) */
  svgId?: string;
}

interface PixelData {
  positions: PixelPosition[];
  color: string;
  zIndex: number;
}

// =============================================================================
// HELPERS PARA DIREÇÃO
// =============================================================================

/**
 * Calcula a transformação SVG baseada na direção (8 direções)
 * - Direções E, SE, NE: sprite normal (olhando para direita)
 * - Direções W, SW, NW: sprite espelhado horizontalmente
 * - Direções N, S: sprite normal ou espelhado (usamos normal)
 */
const getDirectionTransform = (
  direction: CharacterDirection,
  size: number
): string | undefined => {
  // Direções que precisam de flip horizontal (olhando para esquerda)
  const flipDirections: CharacterDirection[] = ["w", "sw", "nw"];

  if (flipDirections.includes(direction)) {
    return `scale(-1, 1) translate(-${size}, 0)`;
  }

  return undefined;
};

/**
 * Retorna opacidade de elementos baseado na direção
 * - Olhando para trás (N, NE, NW): esconde rosto, mostra costas
 * - Olhando para frente (S, SE, SW): mostra rosto, esconde costas
 * - Olhando para lado (E, W): mostra perfil
 */
const getVisibilityForDirection = (
  direction: CharacterDirection
): {
  showFace: boolean;
  showBack: boolean;
  isProfile: boolean;
  faceShadowSide: "left" | "right" | "both" | "none";
} => {
  switch (direction) {
    case "n":
      return {
        showFace: false,
        showBack: true,
        isProfile: false,
        faceShadowSide: "none",
      };
    case "ne":
    case "nw":
      return {
        showFace: false,
        showBack: true,
        isProfile: true,
        faceShadowSide: "none",
      };
    case "s":
      return {
        showFace: true,
        showBack: false,
        isProfile: false,
        faceShadowSide: "both",
      };
    case "se":
      return {
        showFace: true,
        showBack: false,
        isProfile: true,
        faceShadowSide: "left",
      };
    case "sw":
      return {
        showFace: true,
        showBack: false,
        isProfile: true,
        faceShadowSide: "right",
      };
    case "e":
      return {
        showFace: true,
        showBack: false,
        isProfile: true,
        faceShadowSide: "left",
      };
    case "w":
      return {
        showFace: true,
        showBack: false,
        isProfile: true,
        faceShadowSide: "right",
      };
    default:
      return {
        showFace: true,
        showBack: false,
        isProfile: false,
        faceShadowSide: "both",
      };
  }
};

// =============================================================================
// COMPONENTE
// =============================================================================

export const PixelCharacterSVG: React.FC<PixelCharacterSVGProps> = ({
  config,
  size = 192,
  className = "",
  showShadow = true,
  direction = "s",
  pose = "idle",
  svgId,
}) => {
  const uniqueId = useId();
  const finalSvgId = svgId || `character-svg-${uniqueId}`;
  const pixelSize = size / CHARACTER_GRID.height;

  // Configurações de visibilidade baseadas na direção
  const visibility = useMemo(
    () => getVisibilityForDirection(direction),
    [direction]
  );

  // Busca o tipo de corpo
  const bodyType = useMemo(
    () =>
      BODY_TYPES.find((bt) => bt.id === config.bodyType) ||
      BODY_TYPES.find((bt) => bt.id === "normal")!,
    [config.bodyType]
  );

  // Busca a pose atual
  const currentPose = useMemo(
    () => POSES.find((p) => p.id === pose) || POSES[0],
    [pose]
  );

  // Monta os dados de pixels com base na configuração
  const pixels = useMemo(() => {
    const layers: PixelData[] = [];
    const skinShadow = SKIN_SHADOW_MAP[config.skinColor] || config.skinColor;

    // 0. Sombra (se habilitada)
    if (showShadow) {
      layers.push({
        positions: SHADOW_SHAPE,
        color: "rgba(0,0,0,0.3)",
        zIndex: 0,
      });
    }

    // 1. Arma nas costas (zIndex baixo, fica atrás do corpo)
    // Só mostra se estiver olhando para frente (S, SE, SW, E, W)
    if (
      config.weaponStyle &&
      config.weaponStyle !== "none" &&
      config.weaponPosition === "back" &&
      !visibility.showBack // Arma nas costas aparece quando vemos o personagem de frente
    ) {
      const weaponStyle = WEAPON_STYLES.find(
        (w: WeaponStyleOption) => w.id === config.weaponStyle
      );
      if (weaponStyle) {
        const weaponShape = weaponStyle.shapes.back;
        if (weaponShape.length > 0) {
          // Cor secundária primeiro (cabo)
          if (weaponStyle.secondaryPositions?.back) {
            layers.push({
              positions: weaponStyle.secondaryPositions.back,
              color:
                config.weaponSecondaryColor ||
                weaponStyle.defaultSecondaryColor ||
                "#78350f",
              zIndex: 1,
            });
          }
          // Cor primária (lâmina/corpo)
          const primaryPositions = weaponStyle.secondaryPositions?.back
            ? weaponShape.filter(
                (pos) =>
                  !weaponStyle.secondaryPositions?.back.some(
                    (sp) => sp.x === pos.x && sp.y === pos.y
                  )
              )
            : weaponShape;
          layers.push({
            positions: primaryPositions,
            color: config.weaponColor || weaponStyle.defaultColor,
            zIndex: 1,
          });
        }
      }
    }

    // 2. Corpo base (pele) - usando tipo de corpo
    const bodyOffset = currentPose.bodyOffset || { x: 0, y: 0 };
    const offsetPositions = (positions: PixelPosition[]) =>
      positions.map((p) => ({ x: p.x + bodyOffset.x, y: p.y + bodyOffset.y }));

    layers.push({
      positions: [
        ...offsetPositions(bodyType.headShape),
        ...offsetPositions(bodyType.bodyShape),
        ...currentPose.armsShape, // Braços vêm da pose
        ...currentPose.handsShape, // Mãos vêm da pose
      ],
      color: config.skinColor,
      zIndex: 2,
    });

    // 3. Sombra da pele (laterais do rosto) - ajustada para tipo de corpo
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
    layers.push({
      positions: offsetPositions(faceShadowBase),
      color: skinShadow,
      zIndex: 3,
    });

    // 4. Olhos (só mostra se vemos o rosto)
    if (visibility.showFace) {
      layers.push({
        positions: offsetPositions(EYES_POSITIONS),
        color: "#ffffff",
        zIndex: 4,
      });

      // 5. Pupilas
      const pupilPositions: PixelPosition[] = [
        { x: 6, y: 4 },
        { x: 9, y: 4 },
      ];
      layers.push({
        positions: offsetPositions(pupilPositions),
        color: config.eyeColor,
        zIndex: 5,
      });

      // 6. Boca
      layers.push({
        positions: offsetPositions(MOUTH_POSITIONS),
        color: "#c9785c",
        zIndex: 6,
      });
    }

    // 7. Pernas (usando tipo de corpo)
    const legsOffset = currentPose.legsOffset || { x: 0, y: 0 };
    const offsetLegs = (positions: PixelPosition[]) =>
      positions.map((p) => ({ x: p.x + legsOffset.x, y: p.y + legsOffset.y }));
    layers.push({
      positions: offsetLegs(bodyType.legsShape),
      color: config.skinColor,
      zIndex: 7,
    });

    // 8. Calça
    const pantsStyle = PANTS_STYLES.find(
      (s: StyleOption) => s.id === config.pantsStyle
    );
    if (pantsStyle && pantsStyle.shape.length > 0) {
      layers.push({
        positions: pantsStyle.shape,
        color: config.pantsColor,
        zIndex: 8,
      });
    }

    // 9. Sapatos
    const shoesStyle = SHOES_STYLES.find(
      (s: StyleOption) => s.id === config.shoesStyle
    );
    if (shoesStyle && shoesStyle.shape.length > 0) {
      const shoeColor =
        config.shoesStyle === "barefoot" ? config.skinColor : config.shoesColor;
      layers.push({
        positions: shoesStyle.shape,
        color: shoeColor,
        zIndex: 9,
      });
    }

    // 10. Arma na cintura
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
          if (weaponStyle.secondaryPositions?.waist) {
            layers.push({
              positions: weaponStyle.secondaryPositions.waist,
              color:
                config.weaponSecondaryColor ||
                weaponStyle.defaultSecondaryColor ||
                "#78350f",
              zIndex: 10,
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
          layers.push({
            positions: primaryPositions,
            color: config.weaponColor || weaponStyle.defaultColor,
            zIndex: 10,
          });
        }
      }
    }

    // 11. Camisa
    const shirtStyle = SHIRT_STYLES.find(
      (s: StyleOption) => s.id === config.shirtStyle
    );
    if (shirtStyle) {
      if (shirtStyle.multiColor && shirtStyle.secondaryPositions) {
        const primaryPositions = shirtStyle.shape.filter(
          (pos: PixelPosition) =>
            !shirtStyle.secondaryPositions?.some(
              (sp: PixelPosition) => sp.x === pos.x && sp.y === pos.y
            )
        );
        layers.push({
          positions: primaryPositions,
          color: config.shirtColor,
          zIndex: 11,
        });
        layers.push({
          positions: shirtStyle.secondaryPositions,
          color: config.shirtSecondaryColor || config.shirtColor,
          zIndex: 12,
        });
      } else {
        layers.push({
          positions: shirtStyle.shape,
          color: config.shirtColor,
          zIndex: 11,
        });
      }
    }

    // 12. Cabelo
    const hairStyle = HAIR_STYLES.find(
      (s: StyleOption) => s.id === config.hairStyle
    );
    if (hairStyle && hairStyle.shape.length > 0) {
      layers.push({
        positions: offsetPositions(hairStyle.shape),
        color: config.hairColor,
        zIndex: 13,
      });
    }

    // 13. Barba/Facial Hair
    if (config.facialHairStyle && config.facialHairStyle !== "none") {
      const facialStyle = FACIAL_HAIR_STYLES.find(
        (s: StyleOption) => s.id === config.facialHairStyle
      );
      if (facialStyle && facialStyle.shape.length > 0) {
        layers.push({
          positions: offsetPositions(facialStyle.shape),
          color: config.facialHairColor || config.hairColor,
          zIndex: 14,
        });
      }
    }

    // 14. Acessórios (cabeça)
    if (config.accessoryStyle && config.accessoryStyle !== "none") {
      const accessoryStyle = ACCESSORY_STYLES.find(
        (s: StyleOption) => s.id === config.accessoryStyle
      );
      if (accessoryStyle && accessoryStyle.shape.length > 0) {
        layers.push({
          positions: offsetPositions(accessoryStyle.shape),
          color: config.accessoryColor || accessoryStyle.defaultColor,
          zIndex: 15,
        });
      }
    }

    // 15. Arma na mão (maior zIndex, fica na frente)
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
          if (weaponStyle.secondaryPositions?.hand) {
            layers.push({
              positions: weaponStyle.secondaryPositions.hand,
              color:
                config.weaponSecondaryColor ||
                weaponStyle.defaultSecondaryColor ||
                "#78350f",
              zIndex: 16,
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
          layers.push({
            positions: primaryPositions,
            color: config.weaponColor || weaponStyle.defaultColor,
            zIndex: 17,
          });
        }
      }
    }

    return layers;
  }, [config, showShadow, bodyType, currentPose, visibility]);

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

  // Ordena layers por zIndex e renderiza
  const sortedLayers = [...pixels].sort((a, b) => a.zIndex - b.zIndex);

  // Calcula transform para flip horizontal baseado na direção
  const directionTransform = getDirectionTransform(direction, size);

  return (
    <svg
      id={finalSvgId}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      <g transform={directionTransform}>
        {sortedLayers.map((layer, layerIndex) =>
          layer.positions.map((pos, posIndex) =>
            renderPixel(pos, layer.color, `${layerIndex}-${posIndex}`)
          )
        )}
      </g>
    </svg>
  );
};

// =============================================================================
// UTILITÁRIOS DE EXPORTAÇÃO
// =============================================================================

/**
 * Gera uma string SVG a partir do elemento DOM
 * Útil para salvar no banco de dados
 */
export const serializeSVG = (svgId: string): string => {
  const svgElement = document.getElementById(svgId);
  if (svgElement) {
    return new XMLSerializer().serializeToString(svgElement);
  }
  return "";
};

/**
 * Gera uma Data URL do SVG para uso em <img> ou download
 */
export const svgToDataUrl = (svgString: string): string => {
  return `data:image/svg+xml,${encodeURIComponent(svgString)}`;
};

/**
 * Converte SVG para PNG usando canvas
 * @param svgString - String SVG
 * @param width - Largura do PNG
 * @param height - Altura do PNG
 * @returns Promise com Data URL do PNG
 */
export const svgToPng = async (
  svgString: string,
  width: number,
  height: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      // Disable anti-aliasing for pixel art
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG image"));
    };

    img.src = url;
  });
};
