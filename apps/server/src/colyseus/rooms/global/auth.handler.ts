// server/src/colyseus/rooms/global/auth.handler.ts
// Handlers de autenticação: login, register, logout, validate

import { Client } from "@colyseus/core";
import { prisma } from "../../../lib/prisma";
import { verifyToken, generateToken } from "../../../lib/auth";
import bcrypt from "bcryptjs";
import type { HandlerContext, AuthenticatedClient } from "./types";

/**
 * Valida token e autentica cliente
 */
export async function handleValidateToken(
  client: Client,
  token: string,
  ctx: HandlerContext
): Promise<void> {
  try {
    console.log("[Auth] Validando token para sessionId:", client.sessionId);

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      client.send("auth:error", { message: "Token inválido" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      client.send("auth:error", { message: "Usuário não encontrado" });
      return;
    }

    client.userData = {
      userId: user.id,
      username: user.username,
      authenticated: true,
    };

    console.log("[Auth] Validação bem sucedida! userData:", client.userData);

    ctx.authenticatedClients.set(
      client.sessionId,
      client as AuthenticatedClient
    );

    client.send("auth:validated", {
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    console.error("[Auth] Erro na validação:", error);
    client.send("auth:error", { message: "Falha na autenticação" });
  }
}

/**
 * Handler de login
 */
export async function handleLogin(
  client: Client,
  username: string,
  password: string,
  ctx: HandlerContext
): Promise<void> {
  try {
    // Buscar por username ou email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
      },
    });

    if (!user) {
      client.send("auth:error", { message: "Usuário não encontrado" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      client.send("auth:error", { message: "Senha incorreta" });
      return;
    }

    const token = generateToken(user.id, user.username);

    client.userData = {
      userId: user.id,
      username: user.username,
      authenticated: true,
    };

    console.log(
      "[Auth] Login bem sucedido - userData setado:",
      client.userData
    );
    console.log("[Auth] Login - sessionId:", client.sessionId);

    ctx.authenticatedClients.set(
      client.sessionId,
      client as AuthenticatedClient
    );

    client.send("auth:success", {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Auth] Erro no login:", error);
    client.send("auth:error", { message: "Erro no login" });
  }
}

/**
 * Handler de registro
 */
export async function handleRegister(
  client: Client,
  username: string,
  email: string,
  password: string,
  ctx: HandlerContext
): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      client.send("auth:error", {
        message:
          existing.email === email
            ? "Email já cadastrado"
            : "Username já em uso",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    const token = generateToken(user.id, user.username);

    client.userData = {
      userId: user.id,
      username: user.username,
      authenticated: true,
    };

    ctx.authenticatedClients.set(
      client.sessionId,
      client as AuthenticatedClient
    );

    client.send("auth:success", {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Auth] Erro no registro:", error);
    client.send("auth:error", { message: "Erro no registro" });
  }
}

/**
 * Handler de logout
 */
export function handleLogout(client: Client, ctx: HandlerContext): void {
  client.userData = {
    userId: "",
    username: "",
    authenticated: false,
  };
  ctx.authenticatedClients.delete(client.sessionId);
  client.send("auth:logged_out", {});
}
