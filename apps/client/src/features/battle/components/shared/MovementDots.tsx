import React from "react";

interface MovementDotsProps {
  current: number;
  max: number;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

/**
 * Componente de pontos de movimento
 * Exibe o número de movimentos restantes como círculos
 */
export const MovementDots: React.FC<MovementDotsProps> = ({
  current,
  max,
  size = 8,
  activeColor = "#22c55e",
  inactiveColor = "#374151",
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-colors duration-200"
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
