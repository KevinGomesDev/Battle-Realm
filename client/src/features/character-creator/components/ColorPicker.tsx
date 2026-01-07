// client/src/features/character-creator/components/ColorPicker.tsx
// Seletor de cores compacto para o criador de personagem

import React from "react";

interface ColorPickerProps {
  colors: string[];
  selectedColor: string;
  onSelect: (color: string) => void;
  label: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  colors,
  selectedColor,
  onSelect,
  label,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-surface-300 font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onSelect(color)}
            className={`
              w-6 h-6 rounded border-2 transition-all
              ${
                selectedColor === color
                  ? "border-stellar-amber scale-110 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : "border-surface-600 hover:border-surface-400"
              }
            `}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};
