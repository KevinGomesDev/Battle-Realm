// client/src/features/character-creator/components/CharacterCreatorModal.tsx
// Modal principal do criador de personagem

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type CharacterConfig,
  type CharacterDirection,
  type WeaponPosition,
  type BodyType,
  type CharacterPose,
  DEFAULT_CHARACTER_CONFIG,
  rotateDirectionCW,
  rotateDirectionCCW,
  DIRECTION_ARROWS,
  DIRECTION_LABELS,
} from "@boundless/shared/types/character.types";
import {
  SKIN_PALETTES,
  HAIR_PALETTES,
  EYE_PALETTES,
  CLOTHING_PALETTES,
  SHOE_PALETTES,
  HAIR_STYLES,
  FACIAL_HAIR_STYLES,
  SHIRT_STYLES,
  PANTS_STYLES,
  SHOES_STYLES,
  ACCESSORY_STYLES,
  WEAPON_STYLES,
  WEAPON_PALETTES,
  WEAPON_SECONDARY_PALETTES,
  BODY_TYPES,
  POSES,
} from "@boundless/shared/data/character-creator";
import { serializeSVG } from "./PixelCharacterSVG";
import { AnimatedPixelCharacter } from "./AnimatedPixelCharacter";
import { ColorPicker } from "./ColorPicker";
import { StylePicker } from "./StylePicker";
import { Button } from "../../../components/Button";

// =============================================================================
// TIPOS
// =============================================================================

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: CharacterConfig, svgString: string) => void;
  initialConfig?: CharacterConfig;
}

type TabType = "body" | "hair" | "clothing" | "accessories" | "weapon";

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "body", label: "Corpo", icon: "👤" },
  { id: "hair", label: "Cabelo", icon: "💇" },
  { id: "clothing", label: "Roupas", icon: "👕" },
  { id: "accessories", label: "Acessórios", icon: "👑" },
  { id: "weapon", label: "Arma", icon: "⚔️" },
];

const WEAPON_POSITIONS: { id: WeaponPosition; label: string; icon: string }[] =
  [
    { id: "hand", label: "Mão", icon: "✊" },
    { id: "back", label: "Costas", icon: "🎒" },
    { id: "waist", label: "Cintura", icon: "🩳" },
  ];

const BODY_TYPE_OPTIONS: { id: BodyType; label: string }[] = [
  { id: "slim", label: "Magro" },
  { id: "normal", label: "Normal" },
  { id: "athletic", label: "Atlético" },
  { id: "heavy", label: "Robusto" },
];

const POSE_OPTIONS: { id: CharacterPose; label: string; icon: string }[] = [
  { id: "idle", label: "Parado", icon: "🧍" },
  { id: "walk_1", label: "Andando", icon: "🚶" },
  { id: "attack", label: "Atacando", icon: "⚔️" },
  { id: "hurt", label: "Ferido", icon: "💢" },
];

// =============================================================================
// COMPONENTE
// =============================================================================

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}) => {
  const [config, setConfig] = useState<CharacterConfig>(
    initialConfig || DEFAULT_CHARACTER_CONFIG
  );
  const [activeTab, setActiveTab] = useState<TabType>("body");
  const [previewDirection, setPreviewDirection] =
    useState<CharacterDirection>("s");
  const [previewPose, setPreviewPose] = useState<CharacterPose>("idle");
  const [isAnimated, setIsAnimated] = useState(true);

  const SVG_ID = "character-creator-preview-svg";

  // Atualiza uma propriedade do config
  const updateConfig = useCallback(
    <K extends keyof CharacterConfig>(key: K, value: CharacterConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Randomiza o personagem
  const randomize = useCallback(() => {
    const randomItem = <T extends string | { id: string }>(
      arr: readonly T[]
    ): T => arr[Math.floor(Math.random() * arr.length)];

    const randomWeapon = randomItem(WEAPON_STYLES);
    const randomPosition = randomItem(WEAPON_POSITIONS);

    setConfig({
      // Aparência
      bodyType: randomItem(BODY_TYPE_OPTIONS).id,
      skinColor: randomItem(SKIN_PALETTES.colors),
      eyeColor: randomItem(EYE_PALETTES.colors),
      hairStyle: randomItem(HAIR_STYLES).id,
      hairColor: randomItem(HAIR_PALETTES.colors),
      facialHairStyle: randomItem(FACIAL_HAIR_STYLES).id,
      facialHairColor: randomItem(HAIR_PALETTES.colors),
      // Equipamento
      shirtStyle: randomItem(SHIRT_STYLES).id,
      shirtColor: randomItem(CLOTHING_PALETTES.colors),
      shirtSecondaryColor: randomItem(CLOTHING_PALETTES.colors),
      pantsStyle: randomItem(PANTS_STYLES).id,
      pantsColor: randomItem(CLOTHING_PALETTES.colors),
      shoesStyle: randomItem(SHOES_STYLES).id,
      shoesColor: randomItem(SHOE_PALETTES.colors),
      accessoryStyle: randomItem(ACCESSORY_STYLES).id,
      accessoryColor: randomItem(CLOTHING_PALETTES.colors),
      // Arma
      weaponStyle: randomWeapon.id,
      weaponColor: randomItem(WEAPON_PALETTES.colors),
      weaponSecondaryColor: randomItem(WEAPON_SECONDARY_PALETTES.colors),
      weaponPosition: randomPosition.id,
    });
  }, []);

  // Reseta para o padrão
  const reset = useCallback(() => {
    setConfig(DEFAULT_CHARACTER_CONFIG);
  }, []);

  // Salva o personagem
  const handleSave = useCallback(() => {
    const svgString = serializeSVG(SVG_ID);
    onSave?.(config, svgString);
    onClose();
  }, [config, onSave, onClose]);

  // Rotaciona a direção do preview
  const rotateLeft = useCallback(() => {
    setPreviewDirection((prev) => rotateDirectionCCW(prev));
  }, []);

  const rotateRight = useCallback(() => {
    setPreviewDirection((prev) => rotateDirectionCW(prev));
  }, []);

  // Renderiza conteúdo da tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "body":
        return (
          <div className="space-y-4">
            {/* Tipo de Corpo */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-surface-300 font-medium">
                Tipo de Corpo
              </span>
              <div className="flex flex-wrap gap-1">
                {BODY_TYPE_OPTIONS.map((bt) => (
                  <button
                    key={bt.id}
                    onClick={() => updateConfig("bodyType", bt.id)}
                    className={`
                      px-2 py-1 text-xs rounded transition-all
                      ${
                        config.bodyType === bt.id
                          ? "bg-stellar-amber text-cosmos-void font-semibold"
                          : "bg-surface-700 text-surface-200 hover:bg-surface-600"
                      }
                    `}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            </div>
            <ColorPicker
              label="Tom de Pele"
              colors={SKIN_PALETTES.colors}
              selectedColor={config.skinColor}
              onSelect={(color) => updateConfig("skinColor", color)}
            />
            <ColorPicker
              label="Cor dos Olhos"
              colors={EYE_PALETTES.colors}
              selectedColor={config.eyeColor}
              onSelect={(color) => updateConfig("eyeColor", color)}
            />
          </div>
        );

      case "hair":
        return (
          <div className="space-y-4">
            <StylePicker
              label="Estilo do Cabelo"
              styles={HAIR_STYLES}
              selectedId={config.hairStyle}
              onSelect={(id) => updateConfig("hairStyle", id)}
            />
            <ColorPicker
              label="Cor do Cabelo"
              colors={HAIR_PALETTES.colors}
              selectedColor={config.hairColor}
              onSelect={(color) => updateConfig("hairColor", color)}
            />
            <StylePicker
              label="Barba/Bigode"
              styles={FACIAL_HAIR_STYLES}
              selectedId={config.facialHairStyle || "none"}
              onSelect={(id) => updateConfig("facialHairStyle", id)}
            />
            {config.facialHairStyle && config.facialHairStyle !== "none" && (
              <ColorPicker
                label="Cor da Barba"
                colors={HAIR_PALETTES.colors}
                selectedColor={config.facialHairColor || config.hairColor}
                onSelect={(color) => updateConfig("facialHairColor", color)}
              />
            )}
          </div>
        );

      case "clothing":
        return (
          <div className="space-y-4">
            <StylePicker
              label="Camisa"
              styles={SHIRT_STYLES}
              selectedId={config.shirtStyle}
              onSelect={(id) => updateConfig("shirtStyle", id)}
            />
            <ColorPicker
              label="Cor da Camisa"
              colors={CLOTHING_PALETTES.colors}
              selectedColor={config.shirtColor}
              onSelect={(color) => updateConfig("shirtColor", color)}
            />
            <StylePicker
              label="Calça"
              styles={PANTS_STYLES}
              selectedId={config.pantsStyle}
              onSelect={(id) => updateConfig("pantsStyle", id)}
            />
            <ColorPicker
              label="Cor da Calça"
              colors={CLOTHING_PALETTES.colors}
              selectedColor={config.pantsColor}
              onSelect={(color) => updateConfig("pantsColor", color)}
            />
            <StylePicker
              label="Calçado"
              styles={SHOES_STYLES}
              selectedId={config.shoesStyle}
              onSelect={(id) => updateConfig("shoesStyle", id)}
            />
            {config.shoesStyle !== "barefoot" && (
              <ColorPicker
                label="Cor do Calçado"
                colors={SHOE_PALETTES.colors}
                selectedColor={config.shoesColor}
                onSelect={(color) => updateConfig("shoesColor", color)}
              />
            )}
          </div>
        );

      case "accessories":
        return (
          <div className="space-y-4">
            <StylePicker
              label="Acessório"
              styles={ACCESSORY_STYLES}
              selectedId={config.accessoryStyle || "none"}
              onSelect={(id) => updateConfig("accessoryStyle", id)}
            />
            {config.accessoryStyle && config.accessoryStyle !== "none" && (
              <ColorPicker
                label="Cor do Acessório"
                colors={CLOTHING_PALETTES.colors}
                selectedColor={
                  config.accessoryColor || CLOTHING_PALETTES.colors[0]
                }
                onSelect={(color) => updateConfig("accessoryColor", color)}
              />
            )}
          </div>
        );

      case "weapon":
        return (
          <div className="space-y-4">
            {/* Seletor de Arma */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-surface-300 font-medium">Arma</span>
              <div className="flex flex-wrap gap-1">
                {WEAPON_STYLES.map((weapon) => (
                  <button
                    key={weapon.id}
                    onClick={() => updateConfig("weaponStyle", weapon.id)}
                    className={`
                      px-2 py-1 text-xs rounded transition-all
                      ${
                        config.weaponStyle === weapon.id
                          ? "bg-stellar-amber text-cosmos-void font-semibold"
                          : "bg-surface-700 text-surface-200 hover:bg-surface-600"
                      }
                    `}
                    title={weapon.name}
                  >
                    {weapon.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Opções de arma apenas se tiver arma selecionada */}
            {config.weaponStyle && config.weaponStyle !== "none" && (
              <>
                {/* Posição da Arma */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-surface-300 font-medium">
                    Posição
                  </span>
                  <div className="flex gap-1">
                    {WEAPON_POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => updateConfig("weaponPosition", pos.id)}
                        className={`
                          flex-1 px-2 py-1 text-xs rounded transition-all flex items-center justify-center gap-1
                          ${
                            config.weaponPosition === pos.id
                              ? "bg-stellar-amber text-cosmos-void font-semibold"
                              : "bg-surface-700 text-surface-200 hover:bg-surface-600"
                          }
                        `}
                      >
                        <span>{pos.icon}</span>
                        <span>{pos.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor da Arma */}
                <ColorPicker
                  label="Cor da Arma"
                  colors={WEAPON_PALETTES.colors}
                  selectedColor={
                    config.weaponColor || WEAPON_PALETTES.colors[0]
                  }
                  onSelect={(color) => updateConfig("weaponColor", color)}
                />

                {/* Cor Secundária (Cabo/Detalhes) */}
                <ColorPicker
                  label="Cor do Cabo/Detalhes"
                  colors={WEAPON_SECONDARY_PALETTES.colors}
                  selectedColor={
                    config.weaponSecondaryColor ||
                    WEAPON_SECONDARY_PALETTES.colors[0]
                  }
                  onSelect={(color) =>
                    updateConfig("weaponSecondaryColor", color)
                  }
                />
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-cosmos-void/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-3xl mx-4 bg-gradient-to-b from-surface-800 to-surface-900 rounded-xl border border-surface-600 shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600 bg-surface-800/50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎨</span>
                <h2 className="text-xl font-bold text-astral-silver">
                  Criador de Personagem
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-700 text-surface-300 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col md:flex-row">
              {/* Preview */}
              <div className="flex-shrink-0 p-6 flex flex-col items-center justify-center bg-gradient-to-br from-surface-700/50 to-surface-800/50 border-b md:border-b-0 md:border-r border-surface-600">
                <div
                  className="bg-surface-900 rounded-xl p-4 border border-surface-600 relative overflow-hidden"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #0f0f1a 25%, transparent 25%), linear-gradient(-45deg, #0f0f1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0f0f1a 75%), linear-gradient(-45deg, transparent 75%, #0f0f1a 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                >
                  {/* Vinheta para efeito dramático */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
                    }}
                  />
                  <AnimatedPixelCharacter
                    config={config}
                    size={192}
                    direction={previewDirection}
                    pose={previewPose}
                    svgId={SVG_ID}
                    animated={isAnimated}
                    shadeIntensity={0.25}
                  />
                </div>

                {/* Pose Selector */}
                <div className="flex gap-1 mt-4">
                  {POSE_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreviewPose(p.id)}
                      title={p.label}
                      className={`
                        w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all
                        ${
                          previewPose === p.id
                            ? "bg-stellar-amber text-cosmos-void"
                            : "bg-surface-700 text-surface-300 hover:bg-surface-600"
                        }
                      `}
                    >
                      {p.icon}
                    </button>
                  ))}
                  <button
                    onClick={() => setIsAnimated(!isAnimated)}
                    title={isAnimated ? "Pausar animação" : "Ativar animação"}
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ml-2
                      ${
                        isAnimated
                          ? "bg-green-600/50 text-green-300"
                          : "bg-surface-700 text-surface-400"
                      }
                    `}
                  >
                    {isAnimated ? "▶" : "⏸"}
                  </button>
                </div>

                {/* Direction Controls */}
                <div className="flex items-center gap-1 mt-3">
                  <Button variant="ghost" size="sm" onClick={rotateLeft}>
                    ↶
                  </Button>
                  <span className="flex items-center justify-center w-20 text-sm text-surface-300">
                    {DIRECTION_ARROWS[previewDirection]}{" "}
                    {DIRECTION_LABELS[previewDirection]}
                  </span>
                  <Button variant="ghost" size="sm" onClick={rotateRight}>
                    ↷
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" size="sm" onClick={randomize}>
                    🎲 Aleatório
                  </Button>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    ↺ Resetar
                  </Button>
                </div>
              </div>

              {/* Customization Panel */}
              <div className="flex-1 p-6 min-h-[400px]">
                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-surface-800 rounded-lg overflow-x-auto">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex-1 px-2 py-2 text-xs rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap
                        ${
                          activeTab === tab.id
                            ? "bg-stellar-amber text-cosmos-void font-semibold"
                            : "text-surface-300 hover:bg-surface-700 hover:text-white"
                        }
                      `}
                    >
                      <span>{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {renderTabContent()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-600 bg-surface-800/50">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSave}>
                ✓ Salvar Personagem
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
