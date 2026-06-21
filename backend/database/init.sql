-- Criar o banco de dados se não existir
SELECT 'CREATE DATABASE controle_contas'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'controle_contas')\gexec

-- Conectar ao banco
\c controle_contas

-- Extensoes utilitarias
CREATE EXTENSION IF NOT EXISTS citext;

-- Criação das tabelas do sistema de controle de contas

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_admin ON users (role) WHERE role = 'admin';

-- Tabela de compras
CREATE TABLE IF NOT EXISTS compras (
    id SERIAL PRIMARY KEY,
    item VARCHAR(255) NOT NULL,
    quantidade DECIMAL(10, 2) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    mes VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de contas fixas
CREATE TABLE IF NOT EXISTS contas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    mes VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de manutenções
CREATE TABLE IF NOT EXISTS manutencoes (
    id SERIAL PRIMARY KEY,
    descricao TEXT NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    data DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de estoque
CREATE TABLE IF NOT EXISTS estoque (
    id SERIAL PRIMARY KEY,
    item VARCHAR(255) NOT NULL UNIQUE,
    quantidade DECIMAL(10, 2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_compras_mes ON compras(mes);
CREATE INDEX IF NOT EXISTS idx_contas_mes ON contas(mes);
CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data);
CREATE INDEX IF NOT EXISTS idx_estoque_item ON estoque(item);

-- Inserir alguns dados de exemplo (opcional)
INSERT INTO compras (item, quantidade, valor, mes) VALUES
    ('Arroz', 5, 25.00, '2025-01'),
    ('Feijão', 3, 18.00, '2025-01'),
    ('Óleo', 2, 10.00, '2025-01')
ON CONFLICT DO NOTHING;

INSERT INTO contas (tipo, valor, mes) VALUES
    ('Luz', 150.00, '2025-01'),
    ('Água', 80.00, '2025-01'),
    ('Internet', 99.90, '2025-01')
ON CONFLICT DO NOTHING;

INSERT INTO estoque (item, quantidade) VALUES
    ('Arroz', 5),
    ('Feijão', 3),
    ('Óleo', 2)
ON CONFLICT (item) DO NOTHING;
