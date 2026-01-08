import React from "react";

interface ScarMarksProps {
  marks: number;
  maxMarks: number;
  size?: number;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

/**
 * Componente de marcas de cicatriz (action marks)
 * Exibe o número de marcas de ação acumuladas
 */
export const ScarMarks: React.FC<ScarMarksProps> = ({
  marks,
  maxMarks,
  size = 6,
  activeColor = "#ef4444",
  inactiveColor = "#374151",
  className = "",
}) => {
  if (maxMarks <= 0) return null;

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: maxMarks }, (_, i) => (
        <div
          key={i}
          className="transition-colors duration-200"
          style={{
            width: size,
            height: size * 1.5,
            backgroundColor: i < marks ? activeColor : inactiveColor,
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
          }}
        />
      ))}
    </div>
  );
};
