-- Migração: adicionar chaves estrangeiras e índices para tenant_id
-- Não define NOT NULL para evitar quebrar usuários já existentes; revisar após backfill

BEGIN;

-- As constraints são criadas apenas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_tenant') THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_compras_tenant') THEN
    ALTER TABLE compras
      ADD CONSTRAINT fk_compras_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contas_tenant') THEN
    ALTER TABLE contas
      ADD CONSTRAINT fk_contas_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_entradas_tenant') THEN
    ALTER TABLE entradas
      ADD CONSTRAINT fk_entradas_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lazer_tenant') THEN
    ALTER TABLE lazer
      ADD CONSTRAINT fk_lazer_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_investimentos_tenant') THEN
    ALTER TABLE investimentos
      ADD CONSTRAINT fk_investimentos_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_manutencoes_tenant') THEN
    ALTER TABLE manutencoes
      ADD CONSTRAINT fk_manutencoes_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estoque_tenant') THEN
    ALTER TABLE estoque
      ADD CONSTRAINT fk_estoque_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categorias_tenant') THEN
    ALTER TABLE categorias
      ADD CONSTRAINT fk_categorias_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Índices para pesquisas por tenant
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compras_tenant_id ON compras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_tenant_id ON contas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entradas_tenant_id ON entradas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lazer_tenant_id ON lazer(tenant_id);
CREATE INDEX IF NOT EXISTS idx_investimentos_tenant_id ON investimentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_tenant_id ON manutencoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estoque_tenant_id ON estoque(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tenant_id ON categorias(tenant_id);

COMMIT;
