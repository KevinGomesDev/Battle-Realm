// src/lib/auth/auth.handler.ts
import { Socket, Server } from "socket.io";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { generateToken, verifyToken } from "./jwt";
import { rateLimiter } from "./rate-limiter";
import {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  sanitizeString,
} from "./validators";
import { getSocketIdentifier } from "./middleware";
import type {
  RegisterData,
  LoginData,
} from "../../../../shared/types/auth.types";

async function findActiveMatchId(userId: string): Promise<string | null> {
  const activePlayerEntry = await prisma.matchPlayer.findFirst({
    where: {
      userId: userId,
      match: { status: "ACTIVE" },
    },
    select: { matchId: true },
  });
  return activePlayerEntry ? activePlayerEntry.matchId : null;
}

export const registerAuthHandlers = (io: Server, socket: Socket) => {
  // --- REGISTRO ---
  socket.on("auth:register", async (data: RegisterData) => {
    const identifier = getSocketIdentifier(socket);

    try {
      // Rate limiting
      const rateCheck = rateLimiter.check(identifier);
      if (!rateCheck.allowed) {
        return socket.emit("auth:error", {
          message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfter} segundos.`,
          code: "RATE_LIMITED",
          retryAfter: rateCheck.retryAfter,
        });
      }

      const username = sanitizeString(data.username);
      const email = sanitizeString(data.email);
      const password = data.password;

      // Validações
      if (!username || !email || !password) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Preencha todos os campos.",
          code: "MISSING_FIELDS",
        });
      }

      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: usernameValidation.error,
          code: "INVALID_USERNAME",
        });
      }

      if (!isValidEmail(email)) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Email inválido.",
          code: "INVALID_EMAIL",
        });
      }

      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: passwordValidation.error,
          code: "INVALID_PASSWORD",
        });
      }

      // Verifica duplicados separadamente para melhor feedback
      const existingByUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (existingByUsername) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Este nome de usuário já está em uso.",
          code: "USERNAME_TAKEN",
        });
      }

      const existingByEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingByEmail) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Este email já está cadastrado.",
          code: "EMAIL_TAKEN",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: { username, email, password: hashedPassword },
      });

      // Gera token JWT
      const token = generateToken(newUser.id, newUser.username);

      // Armazena o ID no socket para uso nos handlers
      socket.data.userId = newUser.id;

      // Reset rate limiter após sucesso
      rateLimiter.reset(identifier);

      console.log(`[AUTH] Novo usuário: ${newUser.username}`);
      socket.emit("auth:success", {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        token,
      });
    } catch (error) {
      console.error("[AUTH] Erro:", error);
      socket.emit("auth:error", {
        message: "Erro interno no servidor.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // --- LOGIN ---
  socket.on("auth:login", async (data: LoginData) => {
    const identifier = getSocketIdentifier(socket);

    try {
      // Rate limiting
      const rateCheck = rateLimiter.check(identifier);
      if (!rateCheck.allowed) {
        return socket.emit("auth:error", {
          message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfter} segundos.`,
          code: "RATE_LIMITED",
          retryAfter: rateCheck.retryAfter,
        });
      }

      const username = sanitizeString(data.username);
      const password = data.password;

      if (!username || !password) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Informe usuário e senha.",
          code: "MISSING_FIELDS",
        });
      }

      // Busca o usuário
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Credenciais inválidas.",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Compara a senha hash
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        rateLimiter.recordFailedAttempt(identifier);
        return socket.emit("auth:error", {
          message: "Credenciais inválidas.",
          code: "INVALID_CREDENTIALS",
        });
      }

      // Gera token JWT
      const token = generateToken(user.id, user.username);

      // Armazena o ID no socket
      socket.data.userId = user.id;

      // Reset rate limiter após sucesso
      rateLimiter.reset(identifier);

      console.log(`[AUTH] Login bem-sucedido: ${user.username}`);

      socket.emit("auth:success", {
        id: user.id,
        username: user.username,
        email: user.email,
        token,
      });
    } catch (error) {
      console.error("[AUTH] Erro Login:", error);
      socket.emit("auth:error", {
        message: "Erro interno ao logar.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // --- VERIFICAR SESSÃO ---
  socket.on("auth:check_session", async ({ userId }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        console.log(`[AUTH] Sessão inválida: usuário ${userId} não encontrado`);
        return socket.emit("auth:session_invalid");
      }

      const activeMatchId = await findActiveMatchId(userId);
      socket.emit("auth:session_checked", { activeMatchId });
    } catch (error) {
      console.error("[AUTH] Erro ao verificar sessão:", error);
      socket.emit("auth:session_invalid");
    }
  });

  // --- VERIFICAR TOKEN JWT ---
  socket.on("auth:verify", async ({ token }) => {
    try {
      if (!token) {
        return socket.emit("auth:error", {
          message: "Token não fornecido",
          code: "MISSING_TOKEN",
        });
      }

      // Verifica e decodifica o JWT
      const payload = verifyToken(token);

      if (!payload) {
        return socket.emit("auth:error", {
          message: "Token inválido ou expirado",
          code: "INVALID_TOKEN",
        });
      }

      // Verifica se o usuário ainda existe no banco
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, email: true },
      });

      if (!user) {
        return socket.emit("auth:error", {
          message: "Usuário não encontrado",
          code: "USER_NOT_FOUND",
        });
      }

      // Armazena o ID no socket
      socket.data.userId = user.id;

      console.log(`[AUTH] Token verificado para: ${user.username}`);

      // Gera um novo token (refresh automático)
      const newToken = generateToken(user.id, user.username);

      socket.emit("auth:verified", {
        success: true,
        id: user.id,
        userId: user.id,
        username: user.username,
        email: user.email,
        token: newToken,
      });
    } catch (error) {
      console.error("[AUTH] Erro ao verificar token:", error);
      socket.emit("auth:error", {
        message: "Erro ao verificar token",
        code: "VERIFICATION_ERROR",
      });
    }
  });

  // --- LOGOUT ---
  socket.on("auth:logout", async () => {
    try {
      const userId = socket.data.userId;

      if (userId) {
        console.log(`[AUTH] Logout: ${userId}`);
      }

      socket.data.userId = undefined;

      socket.emit("auth:logged_out", {
        success: true,
        message: "Logout realizado com sucesso",
      });
    } catch (error) {
      console.error("[AUTH] Erro ao fazer logout:", error);
      socket.emit("auth:error", {
        message: "Erro ao fazer logout",
        code: "LOGOUT_ERROR",
      });
    }
  });
};
