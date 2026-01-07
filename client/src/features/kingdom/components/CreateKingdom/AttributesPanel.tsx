import React from "react";
import {
  ATTRIBUTE_NAMES,
  type AttributeKey,
} from "../../../../../../shared/config/global.config";

type AttributeInfo = {
  name: string;
  description: string;
  icon: string;
};

// Usa as definições do global.config para garantir consistência
export const ATTRIBUTE_INFO: Record<AttributeKey, AttributeInfo> = {
  combat: {
    name: ATTRIBUTE_NAMES.combat.name,
    description: ATTRIBUTE_NAMES.combat.description,
    icon: ATTRIBUTE_NAMES.combat.icon,
  },
  speed: {
    name: ATTRIBUTE_NAMES.speed.name,
    description: ATTRIBUTE_NAMES.speed.description,
    icon: ATTRIBUTE_NAMES.speed.icon,
  },
  focus: {
    name: ATTRIBUTE_NAMES.focus.name,
    description: ATTRIBUTE_NAMES.focus.description,
    icon: ATTRIBUTE_NAMES.focus.icon,
  },
  resistance: {
    name: ATTRIBUTE_NAMES.resistance.name,
    description: ATTRIBUTE_NAMES.resistance.description,
    icon: ATTRIBUTE_NAMES.resistance.icon,
  },
  will: {
    name: ATTRIBUTE_NAMES.will.name,
    description: ATTRIBUTE_NAMES.will.description,
    icon: ATTRIBUTE_NAMES.will.icon,
  },
  vitality: {
    name: ATTRIBUTE_NAMES.vitality.name,
    description: ATTRIBUTE_NAMES.vitality.description,
    icon: ATTRIBUTE_NAMES.vitality.icon,
  },
};

interface AttributesPanelProps {
  title?: string;
  attributes: Record<AttributeKey, number>;
  totalPoints: number;
  maxPoints: number;
  onChange: (key: AttributeKey, value: number) => void;
}

export const AttributesPanel: React.FC<AttributesPanelProps> = ({
  title = "Atributos",
  attributes,
  totalPoints,
  maxPoints,
  onChange,
}) => {
  const pointsColor =
    totalPoints === maxPoints
      ? "text-green-400"
      : totalPoints > maxPoints
      ? "text-red-400"
      : "text-amber-400";

  const clamp = (value: number) => Math.max(0, Math.min(maxPoints, value));

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className={`text-sm font-bold ${pointsColor}`}>
          {totalPoints} / {maxPoints} pontos
        </span>
      </div>

      <div className="space-y-2.5">
        {(
          [
            "combat",
            "speed",
            "focus",
            "resistance",
            "will",
            "vitality",
          ] as AttributeKey[]
        ).map((key) => {
          const info = ATTRIBUTE_INFO[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-lg w-7 text-center">{info.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">
                    {info.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onChange(key, clamp(attributes[key] - 1))}
                      disabled={attributes[key] <= 0}
                      className="w-7 h-7 rounded bg-slate-700/60 hover:bg-slate-600/60 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-white font-bold">
                      {attributes[key]}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange(key, clamp(attributes[key] + 1))}
                      disabled={totalPoints >= maxPoints}
                      className="w-7 h-7 rounded bg-slate-700/60 hover:bg-slate-600/60 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{info.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
