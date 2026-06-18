import React, { createContext, useContext, useState, useEffect } from "react";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // Hidrata o estado a partir do localStorage no primeiro carregamento
  useEffect(() => {
    const storedUser = localStorage.getItem("evolver_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

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
