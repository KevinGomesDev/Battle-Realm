import React from "react";

interface SectionCardProps {
  title: string;
  icon: string;
  accentColor?: "bronze" | "crimson" | "purple" | "gold";
  badge?: string;
  compact?: boolean;
  /** Ação no header (botão) */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const accentStyles = {
  bronze: {
    iconBg: "bg-gradient-to-br from-metal-bronze to-metal-copper",
    glow: "shadow-[0_0_15px_rgba(205,127,50,0.15)]",
    border: "border-metal-bronze/30",
    headerBg: "from-metal-bronze/10 to-transparent",
  },
  crimson: {
    iconBg: "bg-gradient-to-br from-war-crimson to-war-blood",
    glow: "shadow-[0_0_15px_rgba(220,38,38,0.15)]",
    border: "border-war-crimson/30",
    headerBg: "from-war-crimson/10 to-transparent",
  },
  purple: {
    iconBg: "bg-gradient-to-br from-purple-600 to-purple-800",
    glow: "shadow-[0_0_15px_rgba(147,51,234,0.15)]",
    border: "border-purple-500/30",
    headerBg: "from-purple-600/10 to-transparent",
  },
  gold: {
    iconBg: "bg-gradient-to-br from-yellow-500 to-yellow-700",
    glow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
    border: "border-yellow-500/30",
    headerBg: "from-yellow-500/10 to-transparent",
  },
};

/**
 * SectionCard - Card compacto e elegante para Dashboard
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  accentColor = "bronze",
  badge,
  compact = false,
  headerAction,
  children,
}) => {
  const styles = accentStyles[accentColor];

  return (
    <div
      className={`
        relative bg-citadel-granite/90 backdrop-blur-sm
        border border-metal-iron/50 rounded-lg overflow-hidden
        ${styles.glow} hover:${styles.border}
        transition-all duration-300
      `}
    >
      {/* Header compacto */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2
          bg-gradient-to-r ${styles.headerBg}
          border-b border-metal-iron/30
        `}
      >
        {/* Ícone pequeno */}
        <div
          className={`
            w-6 h-6 ${styles.iconBg}
            rounded flex items-center justify-center
            text-xs shadow-sm
          `}
        >
          {icon}
        </div>

        {/* Título */}
        <h3
          className="text-xs font-bold text-parchment-light tracking-wider uppercase flex-1"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {title}
        </h3>

        {/* Badge opcional */}
        {badge && (
          <span
            className={`
              text-[10px] px-1.5 py-0.5 rounded
              bg-${
                accentColor === "purple"
                  ? "purple"
                  : accentColor === "crimson"
                  ? "war-blood"
                  : accentColor === "gold"
                  ? "yellow-900"
                  : "metal-bronze"
              }/20
              text-${
                accentColor === "purple"
                  ? "purple-400"
                  : accentColor === "crimson"
                  ? "war-ember"
                  : accentColor === "gold"
                  ? "yellow-400"
                  : "metal-gold"
              }
              border border-current/30
            `}
          >
            {badge}
          </span>
        )}

        {/* Ação no header (botão) */}
        {headerAction}
      </div>

      {/* Conteúdo */}
      <div className={compact ? "p-2" : "p-3"}>{children}</div>
    </div>
  );
};
