-- Status e Tipos
CREATE TYPE device_status AS ENUM ('active', 'warning', 'offline', 'idle');
CREATE TYPE alert_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE experiment_status AS ENUM ('running', 'paused', 'completed', 'error');
CREATE TYPE sensor_type AS ENUM ('temperature', 'od', 'agitation');

-- Tabela de Usuários (Pesquisadores)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Experimentos (Cada experimento é associado a um único pesquisador)
CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    researcher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status experiment_status DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Dispositivos Master (Raspberry Master)
CREATE TABLE masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname VARCHAR(255) NOT NULL UNIQUE,
    ip VARCHAR(45) NOT NULL,
    status device_status DEFAULT 'offline',
    online_since TIMESTAMP WITH TIME ZONE,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Dispositivos Slave (Raspberry Slaves)
CREATE TABLE slaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_id UUID REFERENCES masters(id) ON DELETE SET NULL,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    hostname VARCHAR(255) NOT NULL UNIQUE,
    ip VARCHAR(45) NOT NULL,
    status device_status DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações e Limites dos Sensores por Slave Node
CREATE TABLE slave_sensor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slave_id UUID REFERENCES slaves(id) ON DELETE CASCADE,
    sensor sensor_type NOT NULL,
    target_value NUMERIC(10, 4), -- O valor desejado que queremos setar no atuador (ex: 230 RPM ou 37°C)
    min_limit NUMERIC(10, 4),    -- Limite inferior para disparo de alertas (ex: 35°C)
    max_limit NUMERIC(10, 4),    -- Limite superior para disparo de alertas (ex: 40°C)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_slave_sensor UNIQUE (slave_id, sensor)
);

-- Tabela de Alertas (Alertas são eventos relacionais de auditoria e monitoramento em tempo real)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slave_id UUID REFERENCES slaves(id) ON DELETE CASCADE,
    experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
    sensor sensor_type NOT NULL,
    severity alert_severity NOT NULL,
    message TEXT NOT NULL,
    value NUMERIC(10, 4),
    threshold NUMERIC(10, 4),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices importantes para performance
CREATE INDEX idx_alerts_resolved ON alerts(resolved, timestamp DESC);
CREATE INDEX idx_experiments_researcher ON experiments(researcher_id);
CREATE INDEX idx_slaves_experiment ON slaves(experiment_id);
CREATE INDEX idx_slave_configs_lookup ON slave_sensor_configs(slave_id, sensor);

-- Trigger reutilizável para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_slave_sensor_configs_updated_at
  BEFORE UPDATE ON slave_sensor_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
