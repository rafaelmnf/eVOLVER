import express from "express";
import { config } from "./config/env";

// O site é SPA, então o servidor é express envia o arquivo index.html apenas 1 vez. A partir daí o react controla o navegador
// No proeto usa-se o wouter para gerenciamento dessas rotas
// 
export function createApp() {
  const app = express();

  // Middleware básicos para entender JSON
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve compiled static files (sem o wildcard aqui — adicionado depois das rotas da API em server.ts)
  app.use(express.static(config.staticPath));

  return app;
}
