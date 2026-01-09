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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<FullScreenLoading message="Carregando página..." />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FullScreenLoading message="Carregando página..." />}>
              <DashboardPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "battle",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FullScreenLoading message="Carregando página..." />}>
              <BattleSessionPage />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: "match",
        element: (
          <ProtectedRoute>
            <Suspense fallback={<FullScreenLoading message="Carregando página..." />}>
              <MapPage />
            </Suspense>
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
