import React, { createContext, useContext, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  endereco?: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  cpf?: string;
  endereco?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lê o usuário salvo no localStorage de forma síncrona (antes do 1º render).
// Evita o flash de redirect para /login ao dar refresh com sessão válida.
function readStoredUser(): User | null {
  try {
    const stored = localStorage.getItem("evolver_user");
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Inicialização lazy: o estado já nasce hidratado a partir do localStorage,
  // então o ProtectedRoute não redireciona indevidamente no refresh.
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => readStoredUser() !== null);

  const persist = (u: User) => {
    setUser(u);
    setIsAuthenticated(true);
    localStorage.setItem("evolver_user", JSON.stringify(u));
  };

  // Login real contra POST /api/auth/login — retorna o usuário com id real (UUID)
  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Falha ao fazer login." }));
      throw new Error(error || "Falha ao fazer login.");
    }
    const realUser: User = await res.json();
    persist(realUser);
  };

  // Cadastro real contra POST /api/auth/register
  // cpf/endereco ficam apenas no client por enquanto (não há colunas no schema)
  const register = async (data: RegisterData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Falha ao cadastrar." }));
      throw new Error(error || "Falha ao cadastrar.");
    }
    const realUser: User = await res.json();
    persist({ ...realUser, cpf: data.cpf, endereco: data.endereco });
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("evolver_user");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
