import React from "react";
import type { AttributeKey } from "../../../../shared/config/global.config";
import { ALL_ATTRIBUTE_KEYS } from "../../../../shared/config/global.config";
import { AttributeBar } from "./AttributeBar";
import type { AttributesDisplayProps } from "./types";

export const AttributesDisplay: React.FC<AttributesDisplayProps> = ({
  attributes,
  editable = false,
  onChange,
  min = 0,
  max = 99,
}) => {
  const handleChange = (key: AttributeKey, delta: number) => {
    if (!onChange) return;
    const newValue = attributes[key] + delta;
    if (newValue >= min && newValue <= max) {
      onChange(key, newValue);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {ALL_ATTRIBUTE_KEYS.map((key) => (
        <AttributeBar
          key={key}
          attributeKey={key}
          value={attributes[key]}
          editable={editable}
          onIncrement={() => handleChange(key, 1)}
          onDecrement={() => handleChange(key, -1)}
          canIncrement={attributes[key] < max}
          canDecrement={attributes[key] > min}
        />
      ))}
    </div>
  );
};
