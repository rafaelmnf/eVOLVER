/*
 * NotFound (404) — "Bioluminescence" Design
 * Página de rota inexistente no tema escuro científico.
 */
import { useLocation } from "wouter";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 ev-dot-grid"
      style={{ backgroundColor: "var(--ev-bg-primary)" }}
    >
      <div className="w-full max-w-md ev-card p-8 text-center animate-fade-in-up">
        <div className="flex justify-center mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--ev-green-dim)", border: "1px solid var(--ev-green-muted)" }}
          >
            <Compass className="animate-pulse" size={26} style={{ color: "var(--ev-green-primary)" }} />
          </div>
        </div>

        <h1
          className="text-5xl font-bold mb-2"
          style={{ fontFamily: "Space Grotesk, monospace", color: "var(--ev-green-primary)", letterSpacing: "-0.02em" }}
        >
          404
        </h1>

        <h2
          className="text-lg font-semibold mb-3"
          style={{ fontFamily: "Space Grotesk, monospace", color: "var(--ev-text-primary)" }}
        >
          Página não encontrada
        </h2>

        <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--ev-text-muted)" }}>
          A página que você procura não existe.
          <br />
          Ela pode ter sido movida ou removida.
        </p>

        <button
          onClick={() => setLocation("/")}
          className="ev-btn-primary inline-flex items-center justify-center gap-2 px-6 py-2.5"
        >
          <Home size={16} />
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
