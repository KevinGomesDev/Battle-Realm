import React from "react";
import { useSessionGuard } from "../core/hooks/useSessionGuard";
import { useAuth } from "../features/auth";
import { FullScreenLoading } from "./FullScreenLoading";

interface SessionGuardProps {
  children: React.ReactNode;
}

/**
 * SessionGuard - Verifica se há sessão ativa e aguarda restauração
 *
 * Usa o hook useSessionGuard para gerenciar o fluxo de verificação:
 * 1. idle - Aguardando usuário autenticar
 * 2. checking - Verificando se há sessão ativa no servidor
 * 3. restoring - Aguardando restauração de batalha (lobby/batalha)
 * 4. ready - Pronto para renderizar o conteúdo
 * 5. error - Erro ou timeout (continua renderizando)
 */
export const SessionGuard: React.FC<SessionGuardProps> = ({ children }) => {
  const { state: authState } = useAuth();
  const { isReady, isLoading, loadingMessage } = useSessionGuard();

  // Mostrar loading enquanto verifica ou aguarda restauração
  if (authState.user && isLoading) {
    return (
      <FullScreenLoading message={loadingMessage || "Verificando sessão..."} />
    );
  }

  // Pronto para renderizar (ou erro - não bloqueia o usuário)
  if (isReady || !authState.user) {
    return <>{children}</>;
  }

  return <>{children}</>;
};
