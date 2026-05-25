import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  endereco?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
  register: (data: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // Check initial state from mock storage
  useEffect(() => {
    const storedUser = localStorage.getItem("evolver_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const login = (email: string) => {
    // Mock login logic
    const mockUser = {
      id: "usr_mock_1",
      name: "Pesquisador Mock",
      email: email,
    };
    setUser(mockUser);
    setIsAuthenticated(true);
    localStorage.setItem("evolver_user", JSON.stringify(mockUser));
  };

  const register = (data: any) => {
    // Mock register logic
    const newUser = {
      id: "usr_" + Math.random().toString(36).substring(7),
      name: data.name,
      email: data.email,
      cpf: data.cpf,
      endereco: data.endereco,
    };
    setUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem("evolver_user", JSON.stringify(newUser));
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
