// client/src/features/character-creator/components/CharacterCreatorModal.tsx
// Modal principal do criador de personagem

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type CharacterConfig,
  DEFAULT_CHARACTER_CONFIG,
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
} from "@boundless/shared/data/character-creator";
import { PixelCharacterSVG } from "./PixelCharacterSVG";
import { ColorPicker } from "./ColorPicker";
import { StylePicker } from "./StylePicker";
import { Button } from "../../../components/Button";

interface CharacterCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: CharacterConfig, svgString: string) => void;
  initialConfig?: CharacterConfig;
}

type TabType = "body" | "hair" | "clothing" | "accessories";

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "body", label: "Corpo", icon: "👤" },
  { id: "hair", label: "Cabelo", icon: "💇" },
  { id: "clothing", label: "Roupas", icon: "👕" },
  { id: "accessories", label: "Acessórios", icon: "👑" },
];

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

  // Atualiza uma propriedade do config
  const updateConfig = useCallback(
    <K extends keyof CharacterConfig>(key: K, value: CharacterConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Randomiza o personagem
  const randomize = useCallback(() => {
    const randomItem = <T,>(arr: T[]): T =>
      arr[Math.floor(Math.random() * arr.length)];

    setConfig({
      skinColor: randomItem(SKIN_PALETTES.colors),
      eyeColor: randomItem(EYE_PALETTES.colors),
      hairStyle: randomItem(HAIR_STYLES).id,
      hairColor: randomItem(HAIR_PALETTES.colors),
      facialHairStyle: randomItem(FACIAL_HAIR_STYLES).id,
      facialHairColor: randomItem(HAIR_PALETTES.colors),
      shirtStyle: randomItem(SHIRT_STYLES).id,
      shirtColor: randomItem(CLOTHING_PALETTES.colors),
      shirtSecondaryColor: randomItem(CLOTHING_PALETTES.colors),
      pantsStyle: randomItem(PANTS_STYLES).id,
      pantsColor: randomItem(CLOTHING_PALETTES.colors),
      shoesStyle: randomItem(SHOES_STYLES).id,
      shoesColor: randomItem(SHOE_PALETTES.colors),
      accessoryStyle: randomItem(ACCESSORY_STYLES).id,
      accessoryColor: randomItem(CLOTHING_PALETTES.colors),
    });
  }, []);

  // Reseta para o padrão
  const reset = useCallback(() => {
    setConfig(DEFAULT_CHARACTER_CONFIG);
  }, []);

  // Gera SVG string para exportação
  const generateSVGString = useCallback(() => {
    const svgElement = document.getElementById("character-preview-svg");
    if (svgElement) {
      return new XMLSerializer().serializeToString(svgElement);
    }
    return "";
  }, []);

  // Salva o personagem
  const handleSave = useCallback(() => {
    const svgString = generateSVGString();
    onSave?.(config, svgString);
    onClose();
  }, [config, generateSVGString, onSave, onClose]);

  // Renderiza conteúdo da tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "body":
        return (
          <div className="space-y-4">
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
            className="relative z-10 w-full max-w-2xl mx-4 bg-gradient-to-b from-surface-800 to-surface-900 rounded-xl border border-surface-600 shadow-2xl overflow-hidden"
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
                  className="bg-surface-900 rounded-xl p-4 border border-surface-600"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #1a1a2e 25%, transparent 25%), linear-gradient(-45deg, #1a1a2e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a2e 75%), linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                >
                  <div id="character-preview-svg">
                    <PixelCharacterSVG config={config} size={192} />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-4">
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
                <div className="flex gap-1 mb-4 p-1 bg-surface-800 rounded-lg">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex-1 px-3 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-1
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
