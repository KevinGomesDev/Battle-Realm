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
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded bg-stellar-gold/20 border border-stellar-gold/30 text-stellar-light">
          {gameClass.archetype}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300">
          {gameClass.resourceUsed}
        </span>
      </div>
    </button>
  );
};
