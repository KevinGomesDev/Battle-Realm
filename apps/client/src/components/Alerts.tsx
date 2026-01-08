import React from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large";
  message?: string;
  className?: string;
}

/**
 * Componente de spinner de carregamento
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "medium",
  message,
  className = "",
}) => {
  const sizeClasses = {
    small: "w-5 h-5",
    medium: "w-10 h-10",
    large: "w-16 h-16",
  };

  return (
    <div className={`flex flex-col items-center gap-4 p-5 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-4 border-medieval-red-700/40 border-t-medieval-red-600 rounded-full animate-spin`}
      ></div>
      {message && <p className="text-gray-300 text-sm m-0">{message}</p>}
    </div>
  );
};

interface ErrorAlertProps {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Componente de alerta de erro
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onDismiss,
  className = "",
}) => {
  if (!error) return null;

  return (
    <div className={`group relative ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-medieval-red-800/20 to-medieval-blood/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative flex items-center gap-3 p-4 bg-medieval-red-950/80 backdrop-blur border-2 border-medieval-blood/50 rounded-lg mb-4 overflow-hidden hover:border-medieval-blood transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-medieval-blood to-transparent"></div>
        <span className="text-2xl flex-shrink-0 animate-pulse">⚔️</span>
        <span className="flex-1 text-red-200 font-semibold">{error}</span>
        {onDismiss && (
          <button
            className="bg-transparent border-none text-red-400 cursor-pointer text-xl p-1 flex-shrink-0 hover:text-red-200 hover:scale-110 transition-all duration-200"
            onClick={onDismiss}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

interface SuccessAlertProps {
  message: string;
  onDismiss?: () => void;
  autoDismiss?: number; // milliseconds
  className?: string;
}

/**
 * Componente de alerta de sucesso
 */
export const SuccessAlert: React.FC<SuccessAlertProps> = ({
  message,
  onDismiss,
  autoDismiss = 3000,
  className = "",
}) => {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoDismiss);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);

  if (!visible) return null;

  return (
    <div className={`group relative ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative flex items-center gap-3 p-4 bg-green-950/80 backdrop-blur border-2 border-green-500/50 rounded-lg mb-4 overflow-hidden hover:border-green-500 transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-500 to-transparent"></div>
        <span className="text-2xl flex-shrink-0">✨</span>
        <span className="flex-1 text-green-200 font-semibold">{message}</span>
        {onDismiss && (
          <button
            className="bg-transparent border-none text-green-400 cursor-pointer text-xl p-1 flex-shrink-0 hover:text-green-200 hover:scale-110 transition-all duration-200"
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
