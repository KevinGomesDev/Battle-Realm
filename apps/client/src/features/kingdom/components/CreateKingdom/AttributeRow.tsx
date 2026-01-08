import React from "react";

interface AttributeRowProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export const AttributeRow: React.FC<AttributeRowProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-3">
      <label className="w-24 text-sm font-semibold text-slate-300">
        {label}
      </label>
      <input
        type="number"
        min="0"
        max="30"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="flex-1 px-3 py-2 bg-surface-800/50 border border-surface-500 rounded-lg text-white text-sm focus:border-stellar-gold focus:ring-1 focus:ring-stellar-gold transition-all"
      />
      <div className="w-12 text-right font-bold text-stellar-light">
        {value}
      </div>
    </div>
  );
};
