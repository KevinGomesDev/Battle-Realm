import { useNavigate as useRouterNavigate } from "react-router-dom";
import { useCallback } from "react";

/**
 * Hook customizado de navegação que encapsula react-router-dom
 * Fornece métodos de navegação tipados para as rotas da aplicação
 */
export function useAppNavigate() {
  const navigate = useRouterNavigate();

  const goToHome = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const goToDashboard = useCallback(() => {
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const goToBattle = useCallback(() => {
    navigate("/battle", { replace: true });
  }, [navigate]);

  const goToMatch = useCallback(() => {
    navigate("/match", { replace: true });
  }, [navigate]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return {
    navigate,
    goToHome,
    goToDashboard,
    goToBattle,
    goToMatch,
    goBack,
  };
}

// Re-export do useNavigate padrão para casos que precisam
export { useNavigate } from "react-router-dom";
