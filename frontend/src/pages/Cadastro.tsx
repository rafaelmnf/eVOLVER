import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Activity } from "lucide-react";
import DarkVeil from "@/components/DarkVeil";

export default function Cadastro() {
  const [, setLocation] = useLocation();
  const { register } = useAuth();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem!");
      return;
    }
    if (!(email && password && name)) return;
    setError("");
    setLoading(true);
    try {
      await register({ name, email, password, cpf, endereco });
      setLocation("/experimentos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <DarkVeil
          hueShift={61}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={0.5}
          scanlineFrequency={0.5}
          warpAmount={0}
        />
      </div>

      <div className="w-full max-w-lg ev-card p-8 relative z-10 animate-fade-in-up">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-12 h-12 rounded-full ev-card-elevated flex items-center justify-center mb-4">
            <Activity className="text-[var(--ev-green-primary)]" size={24} />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: "var(--ev-text-primary)" }}>
            Criar Conta
          </h1>
          <p className="text-sm text-center" style={{ color: "var(--ev-text-muted)" }}>
            Acesso ao sistema eVOLVER
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="ev-label">Nome Completo</label>
            <input
              type="text"
              required
              className="w-full ev-input"
              placeholder="Ex: Dra. Maria Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="ev-label">Email</label>
              <input
                type="email"
                required
                className="w-full ev-input"
                placeholder="email@instituicao.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="ev-label">CPF</label>
              <input
                type="text"
                required
                className="w-full ev-input"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="ev-label">Endereço de Residência</label>
            <input
              type="text"
              required
              className="w-full ev-input"
              placeholder="Rua, Número, Bairro, Cidade - Estado"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="ev-label">Senha</label>
              <input
                type="password"
                required
                className="w-full ev-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="ev-label">Confirmar Senha</label>
              <input
                type="password"
                required
                className="w-full ev-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: "var(--ev-danger)" }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="w-full ev-btn-primary mt-6 py-2.5 disabled:opacity-50">
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        <div className="mt-6 pt-6 text-center border-t border-[var(--ev-border-subtle)]">
          <p className="text-sm" style={{ color: "var(--ev-text-muted)" }}>
            Já possui uma conta?{" "}
            <Link href="/login">
              <span className="text-[var(--ev-green-primary)] hover:underline cursor-pointer">
                Fazer login
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
