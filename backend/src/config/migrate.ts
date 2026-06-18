// migrate.ts — garante alterações de schema em bancos JÁ existentes.
//
// O init.sql só roda via docker-entrypoint-initdb.d em volume novo. Bancos que
// já existem não recebem as novas colunas/valores de enum automaticamente.
// Estas migrações são idempotentes (IF NOT EXISTS) e seguras para rodar em todo boot.
import { query } from "../services/db";

// Cada statement roda isolado em try/catch para não derrubar o arranque do servidor.
// Obs.: ALTER TYPE ... ADD VALUE não pode rodar dentro de um bloco de transação;
// como query() usa o pool sem BEGIN, cada chamada roda em autocommit — ok.
async function safeRun(label: string, sql: string) {
  try {
    await query(sql);
  } catch (err) {
    console.error(`❌ [Migrate] Falha em "${label}":`, err);
  }
}

export async function runMigrations() {
  console.log("🛠️  [Migrate] Aplicando migrações de schema...");

  // 1) Novos valores no enum experiment_status (idempotente)
  await safeRun(
    "enum experiment_status += draft",
    `ALTER TYPE experiment_status ADD VALUE IF NOT EXISTS 'draft'`
  );
  await safeRun(
    "enum experiment_status += stopped",
    `ALTER TYPE experiment_status ADD VALUE IF NOT EXISTS 'stopped'`
  );

  // 2) Default do status passa a ser 'draft' (alinhado ao novo fluxo de rascunho)
  await safeRun(
    "experiments.status default = draft",
    `ALTER TABLE experiments ALTER COLUMN status SET DEFAULT 'draft'`
  );

  // 3) Novas colunas de tempo de bomba em slave_sensor_configs
  await safeRun(
    "slave_sensor_configs.feed_pump_time",
    `ALTER TABLE slave_sensor_configs ADD COLUMN IF NOT EXISTS feed_pump_time NUMERIC(10, 2)`
  );
  await safeRun(
    "slave_sensor_configs.waste_pump_time",
    `ALTER TABLE slave_sensor_configs ADD COLUMN IF NOT EXISTS waste_pump_time NUMERIC(10, 2)`
  );

  console.log("✅ [Migrate] Migrações de schema concluídas.");
}
