// client/src/features/character-creator/components/StylePicker.tsx
// Seletor de estilos (cabelo, roupa, etc) para o criador de personagem

import React from "react";
import type { StyleOption } from "@boundless/shared/types/character.types";

interface StylePickerProps {
  styles: StyleOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
}

export const StylePicker: React.FC<StylePickerProps> = ({
  styles,
  selectedId,
  onSelect,
  label,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-surface-300 font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {styles.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={`
              px-2 py-1 text-xs rounded transition-all
              ${
                selectedId === style.id
                  ? "bg-stellar-amber text-cosmos-void font-semibold"
                  : "bg-surface-700 text-surface-200 hover:bg-surface-600"
              }
            `}
            title={style.name}
          >
            {style.name}
          </button>
        ))}
      </div>
    </div>
  );
};
