import React, { useState } from "react";
import { ErrorAlert, SuccessAlert } from "@/components/Alerts";
import { Button } from "@/components/Button";
import type { AuthFormData } from "@boundless/shared/types/auth.types";

// Re-export for backwards compatibility
export type { AuthFormData } from "@boundless/shared/types/auth.types";

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
      {/* Form Title - Estilo Stellar */}
      <div className="text-center mb-8">
        <h2
          className="text-3xl sm:text-4xl font-bold text-stellar-gradient drop-shadow-lg"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: "0.1em",
          }}
        >
          {title}
        </h2>
        <div className="h-px w-20 mx-auto bg-gradient-to-r from-transparent via-stellar-amber to-transparent mt-3 rounded-full"></div>
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
            className="block font-semibold text-astral-silver text-sm mb-2 uppercase tracking-widest"
          >
            ✦ Usuário
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Digite seu nome de viajante"
              autoComplete="username"
              className="w-full px-4 py-3 bg-surface-900 border border-surface-500/50 rounded-lg 
                         text-astral-chrome placeholder-surface-300/50 text-sm 
                         transition-all duration-300 
                         focus:outline-none focus:border-stellar-amber/50 focus:ring-2 focus:ring-stellar-amber/20 
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         hover:border-surface-400"
            />
          </div>
        </div>

        {/* Email Field */}
        {!isLogin && (
          <div className="group">
            <label
              htmlFor="email"
              className="block font-semibold text-astral-silver text-sm mb-2 uppercase tracking-widest"
            >
              ✧ Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="seu.email@cosmos.com"
                autoComplete="email"
                className="w-full px-4 py-3 bg-surface-900 border border-surface-500/50 rounded-lg 
                           text-astral-chrome placeholder-surface-300/50 text-sm 
                           transition-all duration-300 
                           focus:outline-none focus:border-stellar-amber/50 focus:ring-2 focus:ring-stellar-amber/20 
                           disabled:opacity-50 disabled:cursor-not-allowed 
                           hover:border-surface-400"
              />
            </div>
          </div>
        )}

        {/* Password Field */}
        <div className="group">
          <label
            htmlFor="password"
            className="block font-semibold text-astral-silver text-sm mb-2 uppercase tracking-widest"
          >
            ◈ Senha
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
              className="w-full px-4 py-3 bg-surface-900 border border-surface-500/50 rounded-lg 
                         text-astral-chrome placeholder-surface-300/50 text-sm 
                         transition-all duration-300 
                         focus:outline-none focus:border-stellar-amber/50 focus:ring-2 focus:ring-stellar-amber/20 
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         hover:border-surface-400"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isLoading}
            isLoading={isLoading}
            icon="✦"
          >
            {buttonText.toUpperCase()}
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={onCancel}
              disabled={isLoading}
              icon="←"
            >
              Voltar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
