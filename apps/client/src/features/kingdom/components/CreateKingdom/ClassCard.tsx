import React from "react";
import type { GameClass } from "./types";

interface ClassCardProps {
  gameClass: GameClass;
  isSelected: boolean;
  onSelect: () => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({
  gameClass,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
        isSelected
          ? "border-stellar-gold bg-stellar-gold/20 shadow-lg shadow-stellar-gold/20"
          : "border-surface-500 bg-slate-900/50 hover:border-slate-500"
      }`}
    >
      <h4 className="font-bold text-white mb-1">{gameClass.name}</h4>
      <p className="text-xs text-slate-400 mb-2">{gameClass.description}</p>
    </button>
  );
};
