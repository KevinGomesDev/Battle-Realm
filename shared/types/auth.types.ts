// shared/types/auth.types.ts
// Tipos de Autenticação compartilhados entre Frontend e Backend

/**
 * Representa um usuário do sistema
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  token?: string;
}

/**
 * Dados para registro de novo usuário
 */
export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

/**
 * Dados para login
 */
export interface LoginData {
  username: string;
  password: string;
}

/**
 * Resposta de autenticação do servidor
 */
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

/**
 * Dados de formulário de autenticação (login ou registro)
 */
export interface AuthFormData {
  username: string;
  email?: string;
  password: string;
}
