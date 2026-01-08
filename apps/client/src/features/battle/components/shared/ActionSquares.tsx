import React from "react";

interface ActionSquaresProps {
  current: number;
  max: number;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

/**
 * Componente de quadrados de ação
 * Exibe o número de ações restantes como quadrados
 */
export const ActionSquares: React.FC<ActionSquaresProps> = ({
  current,
  max,
  size = 10,
  activeColor = "#3b82f6",
  inactiveColor = "#374151",
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className="rounded-sm transition-colors duration-200"
          style={{
            width: size,
            height: size,
            backgroundColor: i < current ? activeColor : inactiveColor,
          }}
        />
      ))}
    </div>
  );
};
