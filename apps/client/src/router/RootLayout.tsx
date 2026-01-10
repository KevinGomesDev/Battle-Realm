import { useEffect, useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useColyseusStore } from "../stores";
import { useAuth } from "../features/auth";
import { ReconnectingOverlay } from "../components/ReconnectingOverlay";

/**
 * RootLayout - Layout raiz que inicializa a conexão e gerencia estado global
 */
export function RootLayout() {
  const connect = useColyseusStore((s) => s.connect);
  const isConnected = useColyseusStore((s) => s.isConnected);
  const isReconnecting = useColyseusStore((s) => s.isReconnecting);
  const { user, isLoading: isAuthLoading, restoreSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRestoring, setIsRestoring] = useState(true);
  const hasInitialized = useRef(false);

  // Desabilitar menu de contexto em toda a aplicação
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Inicializa conexão e restaura sessão (apenas uma vez)
  useEffect(() => {
    // Prevenir múltiplas inicializações (StrictMode)
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initApp = async () => {
      try {
        // 1. Conecta ao servidor
        await connect();

        // 2. Aguarda um pouco para garantir que socket está pronto
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 3. Tenta restaurar sessão do localStorage
        await restoreSession();
      } catch (error) {
        console.error("[App] ❌ Erro ao inicializar:", error);
      } finally {
        setIsRestoring(false);
      }
    };

    initApp();
  }, [connect, restoreSession]);

  // Redirecionar baseado no estado de autenticação
  useEffect(() => {
    // Não redirecionar durante restauração, loading, ou reconexão
    if (isRestoring || isAuthLoading || isReconnecting) return;

    if (user && location.pathname === "/") {
      // Usuário logado na home -> vai para dashboard
      navigate("/dashboard", { replace: true });
    } else if (!user && location.pathname !== "/") {
      // Usuário deslogado em rota protegida -> vai para home
      navigate("/", { replace: true });
    }
  }, [
    user,
    isRestoring,
    isAuthLoading,
    isReconnecting,
    location.pathname,
    navigate,
  ]);

  // Mostra loading enquanto inicializa
  const isInitializing = isRestoring || isAuthLoading || !isConnected;

  if (isInitializing && isRestoring) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando...</p>
          <p className="text-slate-500 text-sm mt-2">
            {!isConnected
              ? "Conectando ao servidor..."
              : "Restaurando sua sessão..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ReconnectingOverlay />
      <Outlet />
    </>
  );
}
