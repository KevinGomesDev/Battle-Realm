// Core - Public API

// Colyseus Connection
export {
  ColyseusProvider,
  useColyseusConnection,
} from "./context/ColyseusContext";
export { useColyseus } from "./hooks/useColyseus";
// Note: useArena and useMatch hooks available via features/arena and features/match
// Low-level Colyseus hooks are in core/hooks/ but not exported to avoid conflicts

// Session Management
export { SessionProvider, SessionContext } from "./context/SessionContext";
export type { SessionContextType } from "./context/SessionContext";
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
} from "../../../shared/types/session.types";
