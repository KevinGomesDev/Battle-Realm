import React, { useState } from "react";
import { ErrorAlert, SuccessAlert } from "@/components/Alerts";
import type { AuthFormData } from "../../../shared/types/auth.types";

// Re-export for backwards compatibility
export type { AuthFormData } from "../../../shared/types/auth.types";

interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (data: AuthFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Componente reutilizável para formulários de autenticação (Login/Registro)
 */
export const AuthForm: React.FC<AuthFormProps> = ({
  mode,
  onSubmit,
  onCancel,
  isLoading = false,
  error: externalError,
}) => {
  const [formData, setFormData] = useState<AuthFormData>({
    username: "",
    email: "",
    password: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isLogin = mode === "login";
  const title = isLogin ? "Entrar no Jogo" : "Criar Conta";
  const buttonText = isLogin ? "Entrar" : "Registrar";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação básica
    if (!formData.username || !formData.password) {
      setLocalError("Preencha todos os campos obrigatórios");
      return;
    }

    if (!isLogin && !formData.email) {
      setLocalError("Email é obrigatório para registro");
      return;
    }

    if (formData.password.length < 6) {
      setLocalError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    try {
      await onSubmit(formData);
      setShowSuccess(true);
      setFormData({ username: "", email: "", password: "" });

      // Auto-dismiss success message
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    } catch (error: any) {
      setLocalError(error.message || "Erro ao processar requisição");
    }
  };

  const displayError = externalError || localError;

  return (
    <div className="w-full space-y-6">
      {/* Form Title - Estilo Pergaminho Medieval */}
      <div className="text-center mb-8">
        <h2
          className="text-3xl sm:text-4xl font-bold text-parchment-light drop-shadow-lg"
          style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
        >
          {title}
        </h2>
        <div className="h-1 w-20 mx-auto bg-gradient-to-r from-transparent via-metal-gold to-transparent mt-3 rounded-full"></div>
      </div>

      {showSuccess && (
        <SuccessAlert
          message={
            isLogin
              ? "Login realizado com sucesso!"
              : "Conta criada com sucesso!"
          }
          onDismiss={() => setShowSuccess(false)}
          autoDismiss={2000}
        />
      )}

      <ErrorAlert
        error={displayError}
        onDismiss={() => {
          setLocalError(null);
        }}
      />

      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* Username Field */}
        <div className="group">
          <label
            htmlFor="username"
            className="block font-semibold text-parchment-aged text-sm mb-2 uppercase tracking-widest"
          >
            👤 Usuário
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Digite seu nome de guerreiro"
              autoComplete="username"
              className="w-full px-4 py-3 bg-citadel-slate border-2 border-metal-iron rounded-lg 
                         text-parchment-light placeholder-parchment-dark/50 text-sm 
                         transition-all duration-300 
                         focus:outline-none focus:border-metal-bronze focus:ring-2 focus:ring-metal-bronze/20 
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         hover:border-metal-steel shadow-stone-inset"
            />
          </div>
        </div>

        {/* Email Field */}
        {!isLogin && (
          <div className="group">
            <label
              htmlFor="email"
              className="block font-semibold text-parchment-aged text-sm mb-2 uppercase tracking-widest"
            >
              📧 Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="seu.email@realm.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-citadel-slate border-2 border-metal-iron rounded-lg 
                           text-parchment-light placeholder-parchment-dark/50 text-sm 
                           transition-all duration-300 
                           focus:outline-none focus:border-metal-bronze focus:ring-2 focus:ring-metal-bronze/20 
                           disabled:opacity-50 disabled:cursor-not-allowed 
                           hover:border-metal-steel shadow-stone-inset"
              />
            </div>
          </div>
        )}

        {/* Password Field */}
        <div className="group">
          <label
            htmlFor="password"
            className="block font-semibold text-parchment-aged text-sm mb-2 uppercase tracking-widest"
          >
            🔐 Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Mínimo 6 caracteres"
              autoComplete={isLogin ? "current-password" : "new-password"}
              className="w-full px-4 py-3 bg-citadel-slate border-2 border-metal-iron rounded-lg 
                         text-parchment-light placeholder-parchment-dark/50 text-sm 
                         transition-all duration-300 
                         focus:outline-none focus:border-metal-bronze focus:ring-2 focus:ring-metal-bronze/20 
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         hover:border-metal-steel shadow-stone-inset"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          {/* Submit Button - Estilo Forja */}
          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full px-6 py-4 bg-gradient-to-b from-war-crimson to-war-blood 
                       border-3 border-metal-iron rounded-lg shadow-forge-glow
                       hover:from-war-ember hover:to-war-crimson
                       disabled:from-citadel-granite disabled:to-citadel-carved disabled:shadow-none
                       active:animate-stone-press transition-all duration-200"
          >
            {/* Rebites */}
            <div className="absolute top-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
            <div className="absolute top-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-metal-iron rounded-full"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-metal-iron rounded-full"></div>

            <span
              className="relative flex items-center justify-center gap-2 text-parchment-light font-bold tracking-wider"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-parchment-light border-t-transparent rounded-full"></div>
                  Carregando...
                </>
              ) : (
                <>⚔️ {buttonText.toUpperCase()}</>
              )}
            </span>
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gradient-to-b from-citadel-granite to-citadel-carved 
                         border-2 border-metal-iron rounded-lg shadow-stone-raised
                         hover:from-citadel-weathered hover:to-citadel-granite
                         text-parchment-aged font-semibold transition-all duration-200"
            >
              ← Voltar
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
