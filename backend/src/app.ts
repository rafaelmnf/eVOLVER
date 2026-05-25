import express from "express";
import path from "path";
import { config } from "./config/env";

export function createApp() {
  const app = express();

  // Basic request middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve compiled static files
  app.use(express.static(config.staticPath));

  // Fallback for HTML5 client-side routing
  app.get("*", (_req, res) => {
    res.sendFile(path.join(config.staticPath, "index.html"));
  });

  return app;
}
