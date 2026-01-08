import React from "react";
import { Button, type ButtonVariant, type ButtonSize } from "./Button";

interface AsyncButtonProps {
  onClick: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Componente reutilizável para botões que disparam ações assíncronas
 * Gerencia loading, erro e sucesso automaticamente
 */
export const AsyncButton: React.FC<AsyncButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  error,
  children,
  className = "",
  type = "button",
  onSuccess,
  onError,
  variant = "danger",
  size = "md",
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setLocalError(null);

    try {
      await onClick();
      onSuccess?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro desconhecido";
      setLocalError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = disabled || isLoading || loading;
  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        type={type}
        isLoading={isLoading || loading}
        className={className}
      >
        {children}
      </Button>
      {displayError && (
        <p className="text-red-400 text-sm m-0">{displayError}</p>
      )}
    </div>
  );
};
