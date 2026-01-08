import type { AttributeKey } from "../../../../shared/config";

export interface AttributesDisplayProps {
  attributes: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
  };
  editable?: boolean;
  onChange?: (key: AttributeKey, value: number) => void;
  min?: number;
  max?: number;
}

export interface AttributeBarProps {
  attributeKey: AttributeKey;
  value: number;
  editable?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  canIncrement?: boolean;
  canDecrement?: boolean;
}
