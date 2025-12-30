// src/handlers/auth.handler.ts
import { Socket, Server } from "socket.io";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma"; // Importamos nossa conexão
import { LoginData, RegisterData } from "../types";

async function findActiveMatchId(userId: string): Promise<string | null> {
  const activePlayerEntry = await prisma.matchPlayer.findFirst({
    where: {
      userId: userId,
      match: { status: "ACTIVE" }, // Apenas partidas em andamento
    },
    select: { matchId: true },
  });
  return activePlayerEntry ? activePlayerEntry.matchId : null;
}

export const registerAuthHandlers = (io: Server, socket: Socket) => {
  socket.on("auth:register", async (data: RegisterData) => {
    try {
      const { username, email, password } = data;

      if (!username || !email || !password) {
        return socket.emit("error", { message: "Preencha todos os campos." });
      }

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });

      if (existingUser) {
        return socket.emit("error", {
          message: "Usuário ou Email já existem.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: { username, email, password: hashedPassword },
      });

      // Armazena o ID no socket para uso nos handlers
      socket.data.userId = newUser.id;

      console.log(`[AUTH] Novo usuário: ${newUser.username}`);
      socket.emit("auth:success", {
        id: newUser.id,
        username: newUser.username,
        token: newUser.id, // Token é o userId
      });
    } catch (error) {
      console.error("[AUTH] Erro:", error);
      socket.emit("error", { message: "Erro interno no servidor." });
    }
  });

  socket.on("auth:login", async (data: LoginData) => {
    try {
      const { username, password } = data;

      if (!username || !password) {
        return socket.emit("error", { message: "Informe usuário e senha." });
      }

      // 1. Busca o usuário
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        // Por segurança, mensagem genérica
        return socket.emit("error", { message: "Credenciais inválidas." });
      }

      // 2. Compara a senha hash
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return socket.emit("error", { message: "Credenciais inválidas." });
      }

      // Armazena o ID no socket para uso nos handlers
      socket.data.userId = user.id;

      console.log(`[AUTH] Login bem-sucedido: ${user.username}`);

      // 3. Retorna sucesso
      socket.emit("auth:success", {
        id: user.id,
        username: user.username,
        token: user.id,
      });
    } catch (error) {
      console.error("[AUTH] Erro Login:", error);
      socket.emit("error", { message: "Erro interno ao logar." });
    }
  });

  socket.on("auth:check_session", async ({ userId }) => {
    try {
      // Primeiro, verifica se o usuário existe no banco
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        // Usuário não existe mais no banco - sessão inválida
        console.log(`[AUTH] Sessão inválida: usuário ${userId} não encontrado`);
        return socket.emit("auth:session_invalid");
      }

      // Usuário existe, procura por partida ativa
      const activeMatchId = await findActiveMatchId(userId);
      socket.emit("auth:session_checked", { activeMatchId });
    } catch (error) {
      console.error("[AUTH] Erro ao verificar sessão:", error);
      // Se der erro, invalida a sessão por segurança
      socket.emit("auth:session_invalid");
    }
  });

  // --- VERIFICAR TOKEN ---
  socket.on("auth:verify", async ({ userId, token }) => {
    try {
      // Aceita tanto userId quanto token (são a mesma coisa)
      const id = userId || token;

      // Valida se foi fornecido
      if (!id) {
        return socket.emit("error", {
          message: "Token inválido: userId não fornecido",
          code: "INVALID_TOKEN",
        });
      }

      // Busca o usuário no banco de dados
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, email: true },
      });

      if (!user) {
        return socket.emit("error", {
          message: "Token inválido: usuário não encontrado",
          code: "USER_NOT_FOUND",
        });
      }

      // Armazena o ID no socket para uso nos handlers posteriores
      socket.data.userId = user.id;

      console.log(`[AUTH] Token verificado para: ${user.username}`);

      // Emite resposta de token válido
      socket.emit("auth:verified", {
        success: true,
        userId: user.id,
        username: user.username,
        email: user.email,
        token: user.id, // Token é o userId
        message: "Token verificado com sucesso",
      });
    } catch (error) {
      console.error("[AUTH] Erro ao verificar token:", error);
      socket.emit("error", {
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

      // Limpa dados do socket
      socket.data.userId = undefined;

      // Emite confirmação
      socket.emit("auth:logged_out", {
        success: true,
        message: "Logout realizado com sucesso",
      });
    } catch (error) {
      console.error("[AUTH] Erro ao fazer logout:", error);
      socket.emit("error", {
        message: "Erro ao fazer logout",
        code: "LOGOUT_ERROR",
      });
    }
  });
};
