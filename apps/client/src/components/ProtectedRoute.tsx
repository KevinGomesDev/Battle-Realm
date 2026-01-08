import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas, redirecionando para HomePage se não autenticado
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirecionar para home, salvando a rota atual para depois
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
