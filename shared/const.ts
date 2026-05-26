// ============= SERVER PORTS =============
export const BACKEND_PORT = 3000;
export const FRONTEND_PORT = 5173;
export const MQTT_DEFAULT_PORT = 1883;

// ============= SERVER HOSTS =============
export const BACKEND_HOST = "localhost";

// ============= TIMEOUTS & DURATIONS =============
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Conversão de 1 ano em milissegundos; Usado como expiração de cookies/sessions

// ============= SESSION & AUTH =============
// Nome da sessão armazenada no navegador; Usado para identificar o usuário logado
export const COOKIE_NAME = "app_session_id";
