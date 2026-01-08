import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth";
import { AuthForm, type AuthFormData } from "@/components/AuthForm";
import { ServerStatus } from "@/components/ServerStatus";
import { Button } from "@/components/Button";

type ViewMode = "selection" | "login" | "register";

/**
 * Página inicial que permite escolher entre Login ou Registro
 * BOUNDLESS - Cosmic Theme
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("selection");
  const { login, register, isLoading, error, user } = useAuth();

  // Redirecionar para dashboard se já estiver logado
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLoginSubmit = async (data: AuthFormData) => {
    await login(data.username, data.password);
  };

  const handleRegisterSubmit = async (data: AuthFormData) => {
    if (!data.email) {
      throw new Error("Email é obrigatório");
    }
    await register(data.username, data.email, data.password);
  };

  const handleCancel = () => {
    setViewMode("selection");
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Server Status */}
      <ServerStatus />

      {/* === AMBIENTE: Portal Cósmico === */}
      <div className="absolute inset-0 bg-cosmos">
        {/* Nebulosa arcana no topo */}
        <div className="absolute inset-0 bg-cosmos-radial opacity-50"></div>

        {/* Brilhos estelares laterais */}
        <div className="absolute top-1/4 left-0 w-1/3 h-1/2 bg-gradient-to-r from-mystic-blue/10 to-transparent blur-3xl"></div>
        <div className="absolute top-1/4 right-0 w-1/3 h-1/2 bg-gradient-to-l from-mystic-blue/10 to-transparent blur-3xl"></div>

        {/* Partículas estelares */}
        <div className="absolute top-20 left-1/4 w-2 h-2 bg-stellar-amber/30 rounded-full animate-float blur-sm"></div>
        <div
          className="absolute top-40 right-1/3 w-1 h-1 bg-astral-chrome/25 rounded-full animate-float blur-sm"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-40 left-1/3 w-2 h-2 bg-mystic-glow/20 rounded-full animate-float blur-sm"
          style={{ animationDelay: "4s" }}
        ></div>
        <div
          className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-mystic-cyan/25 rounded-full animate-float blur-sm"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Brilho estelar central */}
      <div className="absolute inset-0 bg-stellar-glow opacity-20"></div>

      {/* === CONTEÚDO: Portal de Entrada === */}
      <div className="relative z-10 w-full max-w-2xl mx-auto px-4">
        {/* Card Container */}
        <div className="relative">
          {/* Glow exterior */}
          <div className="absolute -inset-2 bg-gradient-to-b from-stellar-amber/20 via-stellar-gold/10 to-stellar-amber/20 rounded-2xl blur-xl opacity-50"></div>

          {/* Card Principal */}
          <div
            className="relative bg-card-gradient 
                          border border-surface-500/50 rounded-2xl 
                          shadow-cosmic p-8 sm:p-12 md:p-16
                          overflow-hidden backdrop-blur-sm"
          >
            {/* Decoração nos cantos - estrelas */}
            <div className="absolute top-4 left-4 w-2 h-2 bg-stellar-amber rounded-full shadow-stellar opacity-60"></div>
            <div className="absolute top-4 right-4 w-2 h-2 bg-stellar-amber rounded-full shadow-stellar opacity-60"></div>
            <div className="absolute bottom-4 left-4 w-2 h-2 bg-stellar-amber rounded-full shadow-stellar opacity-60"></div>
            <div className="absolute bottom-4 right-4 w-2 h-2 bg-stellar-amber rounded-full shadow-stellar opacity-60"></div>

            {/* Linha decorativa superior */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-stellar-amber/50 to-transparent"></div>

            {/* === TÍTULO: BOUNDLESS === */}
            <div className="text-center mb-8 sm:mb-12">
              <h1
                className="text-4xl sm:text-5xl md:text-6xl font-bold text-stellar-gradient drop-shadow-2xl mb-4 animate-stellar-pulse"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  letterSpacing: "0.15em",
                }}
              >
                BOUNDLESS
              </h1>
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-stellar-amber"></div>
                <span className="text-stellar-amber text-2xl">✦</span>
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-stellar-amber"></div>
              </div>
              <p className="text-astral-silver text-sm sm:text-base tracking-[0.3em] uppercase">
                Infinite Realms Await
              </p>
            </div>

            {/* === CONTEÚDO DINÂMICO === */}
            {viewMode === "selection" && (
              <div className="space-y-8 sm:space-y-10">
                <p className="text-center text-astral-chrome text-base sm:text-lg leading-relaxed max-w-lg mx-auto">
                  As estrelas se alinham. Escolha seu destino, viajante.
                </p>

                <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setViewMode("login")}
                    className="rounded-xl py-5"
                    icon="✦"
                  >
                    ENTRAR
                  </Button>

                  <Button
                    variant="mystic"
                    size="lg"
                    onClick={() => setViewMode("register")}
                    className="rounded-xl py-5"
                    icon="✧"
                  >
                    CRIAR CONTA
                  </Button>
                </div>
              </div>
            )}

            {viewMode === "login" && (
              <AuthForm
                mode="login"
                onSubmit={handleLoginSubmit}
                onCancel={handleCancel}
                isLoading={isLoading}
                error={error}
              />
            )}

            {viewMode === "register" && (
              <AuthForm
                mode="register"
                onSubmit={handleRegisterSubmit}
                onCancel={handleCancel}
                isLoading={isLoading}
                error={error}
              />
            )}
          </div>
        </div>
      </div>

      {/* Elementos decorativos flutuantes - estrelas e formas */}
      <div className="absolute top-10 left-10 w-16 h-16 border border-mystic-blue/20 rotate-45 animate-float opacity-30"></div>
      <div
        className="absolute bottom-20 right-10 w-24 h-24 border border-stellar-amber/20 rotate-12 animate-float opacity-20"
        style={{ animationDelay: "3s" }}
      ></div>
      <div
        className="absolute top-1/3 right-20 w-8 h-8 border border-mystic-cyan/20 rotate-45 animate-float opacity-25"
        style={{ animationDelay: "1.5s" }}
      ></div>
    </div>
  );
};

export default HomePage;
