import React from "react";

interface SectionCardProps {
  title: string;
  icon: string;
  accentColor?: "bronze" | "crimson" | "mystic" | "gold";
  badge?: string;
  compact?: boolean;
  /** Ação no header (botão) */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const accentStyles = {
  bronze: {
    iconBg: "bg-gradient-to-br from-stellar-amber to-stellar-dark",
    glow: "shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    border: "border-stellar-amber/30",
    headerBg: "from-stellar-amber/10 to-transparent",
    badgeBg: "bg-stellar-amber/10",
    badgeText: "text-stellar-amber",
  },
  crimson: {
    iconBg: "bg-gradient-to-br from-red-500 to-red-700",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.1)]",
    border: "border-red-500/30",
    headerBg: "from-red-500/10 to-transparent",
    badgeBg: "bg-red-500/10",
    badgeText: "text-red-400",
  },
  mystic: {
    iconBg: "bg-gradient-to-br from-mystic-blue to-mystic-deep",
    glow: "shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    border: "border-mystic-blue/30",
    headerBg: "from-mystic-blue/10 to-transparent",
    badgeBg: "bg-mystic-blue/10",
    badgeText: "text-mystic-glow",
  },
  gold: {
    iconBg: "bg-gradient-to-br from-stellar-gold to-stellar-deep",
    glow: "shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    border: "border-stellar-gold/30",
    headerBg: "from-stellar-gold/10 to-transparent",
    badgeBg: "bg-stellar-gold/10",
    badgeText: "text-stellar-light",
  },
};

/**
 * SectionCard - Card compacto e elegante para Dashboard - Boundless Theme
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
        relative bg-surface-900/95 backdrop-blur-sm
        border border-surface-500/30 rounded-lg overflow-hidden
        ${styles.glow} hover:${styles.border}
        transition-all duration-300
      `}
    >
      {/* Header compacto */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2
          bg-gradient-to-r ${styles.headerBg}
          border-b border-surface-500/20
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
          className="text-xs font-bold text-astral-chrome tracking-wider uppercase flex-1"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {title}
        </h3>

        {/* Badge opcional */}
        {badge && (
          <span
            className={`
              text-[10px] px-1.5 py-0.5 rounded
              ${styles.badgeBg} ${styles.badgeText}
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
