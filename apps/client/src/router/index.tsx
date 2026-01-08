import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { RootLayout } from "./RootLayout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { FullScreenLoading } from "../components/FullScreenLoading";

// Lazy load das páginas
const HomePage = lazy(() => import("../pages/HomePage"));
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const MapPage = lazy(() => import("../pages/MapPage"));

// Lazy load do BattleView
const BattleSessionPage = lazy(() =>
  import("../features/battle").then((mod) => ({
    default: mod.BattleView,
  }))
);

// Componente de loading para Suspense
const PageLoader = () => <FullScreenLoading message="Carregando página..." />;

// Wrapper para páginas com Suspense
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <DashboardPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: "battle",
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <BattleSessionPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: "match",
        element: (
          <ProtectedRoute>
            <SuspenseWrapper>
              <MapPage />
            </SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        // Fallback para rotas não encontradas
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
