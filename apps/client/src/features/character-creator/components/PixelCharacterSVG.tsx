// client/src/features/character-creator/components/PixelCharacterSVG.tsx
// Componente SVG que renderiza o personagem pixel art

import React, { useMemo } from "react";
import type {
  CharacterConfig,
  PixelPosition,
} from "@boundless/shared/types/character.types";
import { CHARACTER_GRID } from "@boundless/shared/types/character.types";
import {
  HEAD_SHAPE,
  EYES_POSITIONS,
  MOUTH_POSITIONS,
  BODY_SHAPE,
  ARMS_SHAPE,
  HANDS_SHAPE,
  SHADOW_SHAPE,
  HAIR_STYLES,
  FACIAL_HAIR_STYLES,
  SHIRT_STYLES,
  PANTS_STYLES,
  SHOES_STYLES,
  ACCESSORY_STYLES,
  SKIN_SHADOW_MAP,
} from "@boundless/shared/data/character-creator";

interface PixelCharacterSVGProps {
  config: CharacterConfig;
  size?: number;
  className?: string;
  showShadow?: boolean;
}

interface PixelData {
  positions: PixelPosition[];
  color: string;
  zIndex: number;
}

export const PixelCharacterSVG: React.FC<PixelCharacterSVGProps> = ({
  config,
  size = 192,
  className = "",
  showShadow = true,
}) => {
  const pixelSize = size / CHARACTER_GRID.height;

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

    // 1. Corpo base (pele)
    layers.push({
      positions: [...HEAD_SHAPE, ...BODY_SHAPE, ...ARMS_SHAPE, ...HANDS_SHAPE],
      color: config.skinColor,
      zIndex: 1,
    });

    // 2. Sombra da pele (laterais do rosto)
    const faceShadowPositions: PixelPosition[] = [
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 10, y: 4 },
      { x: 10, y: 5 },
      { x: 10, y: 6 },
    ];
    layers.push({
      positions: faceShadowPositions,
      color: skinShadow,
      zIndex: 2,
    });

    // 3. Olhos
    layers.push({
      positions: EYES_POSITIONS,
      color: "#ffffff",
      zIndex: 3,
    });

    // 4. Pupilas
    const pupilPositions: PixelPosition[] = [
      { x: 6, y: 4 },
      { x: 9, y: 4 },
    ];
    layers.push({
      positions: pupilPositions,
      color: config.eyeColor,
      zIndex: 4,
    });

    // 5. Boca
    layers.push({
      positions: MOUTH_POSITIONS,
      color: "#c9785c",
      zIndex: 5,
    });

    // 6. Calça
    const pantsStyle = PANTS_STYLES.find((s) => s.id === config.pantsStyle);
    if (pantsStyle && pantsStyle.shape.length > 0) {
      layers.push({
        positions: pantsStyle.shape,
        color: config.pantsColor,
        zIndex: 6,
      });
    }

    // 7. Sapatos
    const shoesStyle = SHOES_STYLES.find((s) => s.id === config.shoesStyle);
    if (shoesStyle && shoesStyle.shape.length > 0) {
      // Se descalço, usa cor de pele
      const shoeColor =
        config.shoesStyle === "barefoot" ? config.skinColor : config.shoesColor;
      layers.push({
        positions: shoesStyle.shape,
        color: shoeColor,
        zIndex: 7,
      });
    }

    // 8. Camisa
    const shirtStyle = SHIRT_STYLES.find((s) => s.id === config.shirtStyle);
    if (shirtStyle) {
      // Se multicolor, filtra posições secundárias
      if (shirtStyle.multiColor && shirtStyle.secondaryPositions) {
        const primaryPositions = shirtStyle.shape.filter(
          (pos) =>
            !shirtStyle.secondaryPositions?.some(
              (sp) => sp.x === pos.x && sp.y === pos.y
            )
        );
        layers.push({
          positions: primaryPositions,
          color: config.shirtColor,
          zIndex: 8,
        });
        layers.push({
          positions: shirtStyle.secondaryPositions,
          color: config.shirtSecondaryColor || config.shirtColor,
          zIndex: 9,
        });
      } else {
        layers.push({
          positions: shirtStyle.shape,
          color: config.shirtColor,
          zIndex: 8,
        });
      }
    }

    // 9. Cabelo
    const hairStyle = HAIR_STYLES.find((s) => s.id === config.hairStyle);
    if (hairStyle && hairStyle.shape.length > 0) {
      layers.push({
        positions: hairStyle.shape,
        color: config.hairColor,
        zIndex: 10,
      });
    }

    // 10. Barba/Facial Hair
    if (config.facialHairStyle && config.facialHairStyle !== "none") {
      const facialStyle = FACIAL_HAIR_STYLES.find(
        (s) => s.id === config.facialHairStyle
      );
      if (facialStyle && facialStyle.shape.length > 0) {
        layers.push({
          positions: facialStyle.shape,
          color: config.facialHairColor || config.hairColor,
          zIndex: 11,
        });
      }
    }

    // 11. Acessórios
    if (config.accessoryStyle && config.accessoryStyle !== "none") {
      const accessoryStyle = ACCESSORY_STYLES.find(
        (s) => s.id === config.accessoryStyle
      );
      if (accessoryStyle && accessoryStyle.shape.length > 0) {
        layers.push({
          positions: accessoryStyle.shape,
          color: config.accessoryColor || accessoryStyle.defaultColor,
          zIndex: 12,
        });
      }
    }

    return layers;
  }, [config, showShadow]);

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

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      {sortedLayers.map((layer, layerIndex) =>
        layer.positions.map((pos, posIndex) =>
          renderPixel(pos, layer.color, `${layerIndex}-${posIndex}`)
        )
      )}
    </svg>
  );
};
