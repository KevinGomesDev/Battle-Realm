import React from "react";
import { getConditionInfo } from "../../constants";

interface ConditionBadgeProps {
  condition: string;
  duration?: number;
  showDuration?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "text-xs px-1 py-0.5",
  md: "text-sm px-2 py-1",
  lg: "text-base px-3 py-1.5",
};

/**
 * Badge para exibir condições (buffs/debuffs)
 */
export const ConditionBadge: React.FC<ConditionBadgeProps> = ({
  condition,
  duration,
  showDuration = true,
  size = "sm",
  className = "",
}) => {
  const info = getConditionInfo(condition);

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeStyles[size]} ${className}`}
      style={{
        backgroundColor: `${info.color}20`,
        color: info.color,
        border: `1px solid ${info.color}40`,
      }}
      title={info.description}
    >
      <span>{info.icon}</span>
      {showDuration && duration !== undefined && duration > 0 && (
        <span className="text-xs opacity-80">{duration}</span>
      )}
    </div>
  );
};
