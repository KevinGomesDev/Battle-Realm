// Core - Public API
// Migrado para Zustand - Contexts removidos

// Colyseus Connection (via Zustand store)
export { useColyseus, useColyseusConnection } from "./hooks/useColyseus";

// Session Management (via Zustand store)
export { useSession } from "./hooks/useSession";
export { useSessionGuard } from "./hooks/useSessionGuard";
export type { SessionGuardResult } from "./hooks/useSessionGuard";

// Re-export shared session types for convenience
export type {
  SessionState,
  SessionAction,
  SessionType,
  ActiveSessionFrontend,
  SessionGuardState,
} from "@boundless/shared/types/session.types";
