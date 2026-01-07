// client/src/components/Button.tsx
// Componente de botão padronizado - BOUNDLESS Theme

import React from "react";

// =============================================================================
// TIPOS
// =============================================================================

export type ButtonVariant =
  | "primary" // Dourado/Stellar - ação principal
  | "secondary" // Surface/Astral - ação secundária
  | "danger" // Vermelho - ações destrutivas
  | "success" // Verde - confirmação/pronto
  | "ghost" // Transparente - ações sutis
  | "mystic"; // Azul/Mystic - ações especiais

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
  fullWidth?: boolean;
}

// =============================================================================
// ESTILOS
// =============================================================================

const BASE_STYLES = `
  inline-flex items-center justify-center gap-2
  font-semibold rounded-lg
  border transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
  active:scale-[0.98]
`;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-b from-stellar-amber to-stellar-dark
    border-stellar-amber/50
    text-cosmos-void
    hover:from-stellar-gold hover:to-stellar-amber
    hover:border-stellar-light/60
    shadow-[0_2px_8px_rgba(251,191,36,0.25)]
    hover:shadow-[0_4px_12px_rgba(251,191,36,0.35)]
  `,
  secondary: `
    bg-gradient-to-b from-surface-700 to-surface-800
    border-surface-500/50
    text-astral-chrome
    hover:from-surface-600 hover:to-surface-700
    hover:border-surface-400/60
    hover:text-astral-silver
  `,
  danger: `
    bg-gradient-to-b from-red-600 to-red-800
    border-red-500/50
    text-white
    hover:from-red-500 hover:to-red-700
    hover:border-red-400/60
    shadow-[0_2px_8px_rgba(239,68,68,0.2)]
    hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)]
  `,
  success: `
    bg-gradient-to-b from-green-600 to-green-800
    border-green-500/50
    text-white
    hover:from-green-500 hover:to-green-700
    hover:border-green-400/60
    shadow-[0_2px_8px_rgba(34,197,94,0.2)]
    hover:shadow-[0_4px_12px_rgba(34,197,94,0.3)]
  `,
  ghost: `
    bg-transparent
    border-transparent
    text-astral-chrome
    hover:bg-surface-800/50
    hover:border-surface-500/30
    hover:text-astral-silver
  `,
  mystic: `
    bg-gradient-to-b from-mystic-blue to-mystic-deep
    border-mystic-blue/50
    text-white
    hover:from-mystic-glow hover:to-mystic-blue
    hover:border-mystic-glow/60
    shadow-[0_2px_8px_rgba(59,130,246,0.25)]
    hover:shadow-[0_4px_12px_rgba(59,130,246,0.35)]
  `,
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

// =============================================================================
// COMPONENTE
// =============================================================================

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  isLoading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  const combinedClassName = [
    BASE_STYLES,
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <button className={combinedClassName} disabled={isDisabled} {...props}>
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === "left" && <span>{icon}</span>}
          {children}
          {icon && iconPosition === "right" && <span>{icon}</span>}
        </>
      )}
    </button>
  );
};

// =============================================================================
// VARIANTES PRÉ-CONFIGURADAS (Atalhos)
// =============================================================================

/** Botão de ação principal */
export const PrimaryButton: React.FC<Omit<ButtonProps, "variant">> = (
  props
) => <Button variant="primary" {...props} />;

/** Botão de ação secundária */
export const SecondaryButton: React.FC<Omit<ButtonProps, "variant">> = (
  props
) => <Button variant="secondary" {...props} />;

/** Botão de ação perigosa/destrutiva */
export const DangerButton: React.FC<Omit<ButtonProps, "variant">> = (props) => (
  <Button variant="danger" {...props} />
);

/** Botão de confirmação/sucesso */
export const SuccessButton: React.FC<Omit<ButtonProps, "variant">> = (
  props
) => <Button variant="success" {...props} />;

/** Botão fantasma (transparente) */
export const GhostButton: React.FC<Omit<ButtonProps, "variant">> = (props) => (
  <Button variant="ghost" {...props} />
);

/** Botão místico (azul) */
export const MysticButton: React.FC<Omit<ButtonProps, "variant">> = (props) => (
  <Button variant="mystic" {...props} />
);
