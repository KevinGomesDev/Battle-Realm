import React from "react";
import { ATTRIBUTE_TOOLTIPS } from "../../constants";

interface AttributeTooltipProps {
  attribute: string;
  value: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Tooltip para exibir informações de atributos
 */
export const AttributeTooltip: React.FC<AttributeTooltipProps> = ({
  attribute,
  value,
  children,
  className = "",
}) => {
  const tooltip = ATTRIBUTE_TOOLTIPS[attribute] || "";

  return (
    <div
      className={`relative group ${className}`}
      title={
        tooltip
          ? `${attribute}: ${value}\n${tooltip}`
          : `${attribute}: ${value}`
      }
    >
      {children}
      {tooltip && (
        <div className="absolute z-50 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap pointer-events-none">
          <div className="font-medium capitalize">
            {attribute}: {value}
          </div>
          <div className="text-gray-300">{tooltip}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};
