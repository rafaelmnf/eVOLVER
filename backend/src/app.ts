import express from "express";
import path from "path";
import { config } from "./config/env";

// O site é SPA, então o servidor é express envia o arquivo index.html apenas 1 vez. A partir daí o react controla o navegador
// No proeto usa-se o wouter para gerenciamento dessas rotas
// 
export function createApp() {
  const app = express();

  // Middleware básicos para entender JSON
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve compiled static files
  app.use(express.static(config.staticPath));

  // Fallback for HTML5 client-side routing
  // Rota curinga para redirecionamento do site
  // EX: Ao digitar localhost:3000/dashboard o Express manda o index.html e o React carrega, olha para a URL (/dashboard) e desenha os componentes do Dashboard na tela
  app.get("*", (_req, res) => {
    res.sendFile(path.join(config.staticPath, "index.html"));
  });

  return app;
}
