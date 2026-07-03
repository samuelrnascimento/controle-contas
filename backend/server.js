const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || 'troque-esta-chave-em-producao';
const adminName = process.env.ADMIN_NAME || 'Proprietario';
const adminEmail = process.env.ADMIN_EMAIL || 'owner@finansam.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'Troque123!';
const adminTenantName = process.env.ADMIN_TENANT_NAME || 'Empresa Principal';
const adminTenantSlug = process.env.ADMIN_TENANT_SLUG || 'empresa-principal';
const platformAdminName = process.env.PLATFORM_ADMIN_NAME || adminName;
const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || adminEmail;
const platformAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD || adminPassword;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());

const runtimeCapabilities = {
  hasTenantsTable: false,
  hasUsersTenantId: false,
  hasComprasTenantId: false,
  hasContasTenantId: false,
  hasLazerTenantId: false,
  hasManutencoesTenantId: false,
  hasEstoqueTenantId: false,
  hasInvestimentosTenantId: false,
  hasCategoriasTenantId: false
};

const allowedTenantPlans = ['Starter', 'Smart', 'Premium'];
const allowedTenantStatuses = ['active', 'inactive'];
const allowedCategoryScopes = ['contas', 'investimentos'];

const normalizeTenantPlan = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'starter') {
    return 'Starter';
  }

  if (normalized === 'smart') {
    return 'Smart';
  }

  if (normalized === 'premium') {
    return 'Premium';
  }

  return null;
};

const normalizeTenantStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'active' || normalized === 'ativo') {
    return 'active';
  }

  if (normalized === 'inactive' || normalized === 'inativo') {
    return 'inactive';
  }

  return null;
};

const applyTenantUserStatus = async (db, tenantId, status) => {
  if (!runtimeCapabilities.hasUsersTenantId) {
    return;
  }

  if (status === 'inactive') {
    await db.query('UPDATE users SET active = false WHERE tenant_id = $1', [tenantId]);
    return;
  }

  if (status === 'active') {
    await db.query(
      `UPDATE users
       SET active = true
       WHERE tenant_id = $1 AND role IN ('admin', 'owner')`,
      [tenantId]
    );
  }
};

const normalizeRole = (role) => (role === 'owner' ? 'admin' : role);
const isUserActive = (user) => user.active === undefined || user.active === null || user.active === true;

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: normalizeRole(user.role),
  active: isUserActive(user),
  scope: 'tenant',
  tenantId: user.tenant_id || null,
  createdAt: user.created_at
});

const sanitizePlatformUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: 'super_admin',
  active: isUserActive(user),
  scope: 'platform',
  createdAt: user.created_at
});

const createTenantToken = (user) => jwt.sign(
  { sub: String(user.id), role: normalizeRole(user.role), scope: 'tenant', email: user.email },
  jwtSecret,
  { expiresIn: '12h' }
);

const createPlatformToken = (user) => jwt.sign(
  { sub: String(user.id), role: 'super_admin', scope: 'platform', email: user.email },
  jwtSecret,
  { expiresIn: '12h' }
);

const parseAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const normalizeCategoryScope = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return allowedCategoryScopes.includes(normalized) ? normalized : null;
};

const normalizeTenantSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-+|-+$/g, '');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Autenticação obrigatória' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);

    if (payload.scope === 'platform') {
      const result = await pool.query(
        'SELECT id, name, email, role, active, created_at FROM platform_users WHERE id::text = $1',
        [payload.sub]
      );

      if (result.rows.length === 0 || !isUserActive(result.rows[0])) {
        return res.status(401).json({ error: 'Usuário de plataforma inválido ou inativo' });
      }

      req.authScope = 'platform';
      req.user = result.rows[0];
      return next();
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE id::text = $1',
      [payload.sub]
    );

    if (result.rows.length === 0 || !isUserActive(result.rows[0])) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    req.authScope = 'tenant';
    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireTenantScope = (req, res, next) => {
  if (req.authScope !== 'tenant') {
    return res.status(403).json({ error: 'Ação disponível apenas para usuários de empresa' });
  }

  next();
};

const requirePlatformAdmin = (req, res, next) => {
  if (req.authScope !== 'platform') {
    return res.status(403).json({ error: 'Permissão de plataforma obrigatória' });
  }

  next();
};

const requireRole = (...roles) => (req, res, next) => {
  const userRole = normalizeRole(req.user?.role);
  if (!req.user || !roles.includes(userRole)) {
    return res.status(403).json({ error: 'Permissão insuficiente' });
  }

  next();
};

const ensureSchema = async () => {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS citext;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email CITEXT NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_admin ON users (role) WHERE role = 'admin';
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS compras (
      id SERIAL PRIMARY KEY,
      item VARCHAR(255) NOT NULL,
      quantidade DECIMAL(10, 2) NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contas (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(100) NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lazer (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE lazer ADD COLUMN IF NOT EXISTS tenant_id TEXT;
    ALTER TABLE lazer ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;

    CREATE TABLE IF NOT EXISTS manutencoes (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      data DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS investimentos (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      mes VARCHAR(7) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE investimentos ADD COLUMN IF NOT EXISTS tenant_id TEXT;
    ALTER TABLE investimentos ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
    ALTER TABLE investimentos ADD COLUMN IF NOT EXISTS nota TEXT;

    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      scope VARCHAR(30) NOT NULL,
      name VARCHAR(120) NOT NULL,
      tenant_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_categorias_scope ON categorias(scope);
    CREATE INDEX IF NOT EXISTS idx_categorias_tenant_scope ON categorias(tenant_id, scope);

    CREATE TABLE IF NOT EXISTS estoque (
      id SERIAL PRIMARY KEY,
      item VARCHAR(255) NOT NULL UNIQUE,
      quantidade DECIMAL(10, 2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_compras_mes ON compras(mes);
    CREATE INDEX IF NOT EXISTS idx_contas_mes ON contas(mes);
    CREATE INDEX IF NOT EXISTS idx_lazer_mes ON lazer(mes);
    CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data);
    CREATE INDEX IF NOT EXISTS idx_investimentos_mes ON investimentos(mes);
    CREATE INDEX IF NOT EXISTS idx_estoque_item ON estoque(item);

    CREATE TABLE IF NOT EXISTS platform_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email CITEXT NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);
  `);
};

const discoverCapabilities = async () => {
  const tableResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenants'
    ) AS has_tenants`
  );

  const usersTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tenant_id'
    ) AS has_users_tenant_id`
  );

  runtimeCapabilities.hasTenantsTable = tableResult.rows[0]?.has_tenants === true;
  runtimeCapabilities.hasUsersTenantId = usersTenantResult.rows[0]?.has_users_tenant_id === true;

  const comprasTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'tenant_id'
    ) AS has_compras_tenant_id`
  );

  const contasTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contas' AND column_name = 'tenant_id'
    ) AS has_contas_tenant_id`
  );

  const manutencoesTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'manutencoes' AND column_name = 'tenant_id'
    ) AS has_manutencoes_tenant_id`
  );

  const lazerTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lazer' AND column_name = 'tenant_id'
    ) AS has_lazer_tenant_id`
  );

  const estoqueTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'estoque' AND column_name = 'tenant_id'
    ) AS has_estoque_tenant_id`
  );

  const investimentosTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'investimentos' AND column_name = 'tenant_id'
    ) AS has_investimentos_tenant_id`
  );

  const categoriasTenantResult = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'tenant_id'
    ) AS has_categorias_tenant_id`
  );

  runtimeCapabilities.hasComprasTenantId = comprasTenantResult.rows[0]?.has_compras_tenant_id === true;
  runtimeCapabilities.hasContasTenantId = contasTenantResult.rows[0]?.has_contas_tenant_id === true;
  runtimeCapabilities.hasLazerTenantId = runtimeCapabilities.hasUsersTenantId
    && lazerTenantResult.rows[0]?.has_lazer_tenant_id === true;
  runtimeCapabilities.hasManutencoesTenantId = manutencoesTenantResult.rows[0]?.has_manutencoes_tenant_id === true;
  runtimeCapabilities.hasEstoqueTenantId = estoqueTenantResult.rows[0]?.has_estoque_tenant_id === true;
  runtimeCapabilities.hasInvestimentosTenantId = runtimeCapabilities.hasUsersTenantId
    && investimentosTenantResult.rows[0]?.has_investimentos_tenant_id === true;
  runtimeCapabilities.hasCategoriasTenantId = runtimeCapabilities.hasUsersTenantId
    && categoriasTenantResult.rows[0]?.has_categorias_tenant_id === true;
};

const hasPasswordChanged = async (plainPassword, passwordHash) => {
  if (!passwordHash) {
    return true;
  }

  const passwordMatches = await bcrypt.compare(plainPassword, passwordHash);
  return !passwordMatches;
};

const ensureAdminUser = async () => {
  if (runtimeCapabilities.hasUsersTenantId) {
    if (!runtimeCapabilities.hasTenantsTable) {
      throw new Error('users.tenant_id existe, mas a tabela tenants não está disponível');
    }

    const tenantResult = await pool.query(
      `INSERT INTO tenants (name, slug, plan, subscription_status)
       VALUES ($1, $2, 'Starter', 'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [adminTenantName, adminTenantSlug]
    );

    const tenantId = tenantResult.rows[0].id;

    const existingAdmin = await pool.query(
      'SELECT id, name, email, password_hash, active FROM users WHERE tenant_id = $1 AND role IN ($2, $3) LIMIT 1',
      [tenantId, 'admin', 'owner']
    );

    if (existingAdmin.rows.length > 0) {
      const adminUser = existingAdmin.rows[0];
      const passwordNeedsUpdate = await hasPasswordChanged(adminPassword, adminUser.password_hash);

      if (
        adminUser.name !== adminName
        || adminUser.email !== adminEmail
        || adminUser.active !== true
        || passwordNeedsUpdate
      ) {
        const nextPasswordHash = passwordNeedsUpdate
          ? await bcrypt.hash(adminPassword, 10)
          : adminUser.password_hash;

        await pool.query(
          `UPDATE users
           SET name = $1,
               email = $2,
               password_hash = $3,
               active = true
           WHERE id = $4`,
          [adminName, adminEmail, nextPasswordHash, adminUser.id]
        );

        console.log(`Administrador do tenant sincronizado: ${adminEmail}`);
      }

      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, 'owner', true)`,
      [tenantId, adminName, adminEmail, passwordHash]
    );

    console.log(`Administrador do tenant criado: ${adminEmail}`);
    return;
  }

  const existingAdmin = await pool.query(
    'SELECT id, name, email, password_hash, active FROM users WHERE role IN ($1, $2) LIMIT 1',
    ['admin', 'owner']
  );

  if (existingAdmin.rows.length > 0) {
    const adminUser = existingAdmin.rows[0];
    const passwordNeedsUpdate = await hasPasswordChanged(adminPassword, adminUser.password_hash);

    if (
      adminUser.name !== adminName
      || adminUser.email !== adminEmail
      || adminUser.active !== true
      || passwordNeedsUpdate
    ) {
      const nextPasswordHash = passwordNeedsUpdate
        ? await bcrypt.hash(adminPassword, 10)
        : adminUser.password_hash;

      await pool.query(
        `UPDATE users
         SET name = $1,
             email = $2,
             password_hash = $3,
             active = true
         WHERE id = $4`,
        [adminName, adminEmail, nextPasswordHash, adminUser.id]
      );

      console.log(`Administrador sincronizado: ${adminEmail}`);
    }

    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    'INSERT INTO users (name, email, password_hash, role, active) VALUES ($1, $2, $3, $4, $5)',
    [adminName, adminEmail, passwordHash, 'admin', true]
  );

  console.log(`Administrador criado: ${adminEmail}`);
};

const ensurePlatformAdminUser = async () => {
  const existingPlatformAdmin = await pool.query(
    'SELECT id, name, email, password_hash, active FROM platform_users LIMIT 1'
  );

  if (existingPlatformAdmin.rows.length > 0) {
    const platformUser = existingPlatformAdmin.rows[0];
    const passwordNeedsUpdate = await hasPasswordChanged(platformAdminPassword, platformUser.password_hash);

    if (
      platformUser.name !== platformAdminName
      || platformUser.email !== platformAdminEmail
      || platformUser.active !== true
      || passwordNeedsUpdate
    ) {
      const nextPasswordHash = passwordNeedsUpdate
        ? await bcrypt.hash(platformAdminPassword, 10)
        : platformUser.password_hash;

      await pool.query(
        `UPDATE platform_users
         SET name = $1,
             email = $2,
             password_hash = $3,
             active = true
         WHERE id = $4`,
        [platformAdminName, platformAdminEmail, nextPasswordHash, platformUser.id]
      );

      console.log(`Super admin da plataforma sincronizado: ${platformAdminEmail}`);
    }

    return;
  }

  const passwordHash = await bcrypt.hash(platformAdminPassword, 10);

  await pool.query(
    `INSERT INTO platform_users (name, email, password_hash, role, active)
     VALUES ($1, $2, $3, 'super_admin', true)`,
    [platformAdminName, platformAdminEmail, passwordHash]
  );

  console.log(`Super admin da plataforma criado: ${platformAdminEmail}`);
};

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    const platformResult = await pool.query(
      'SELECT * FROM platform_users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (platformResult.rows.length > 0) {
      const platformUser = platformResult.rows[0];
      const passwordMatches = await bcrypt.compare(password, platformUser.password_hash);

      if (!passwordMatches || !isUserActive(platformUser)) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      return res.json({ token: createPlatformToken(platformUser), user: sanitizePlatformUser(platformUser) });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches || !isUserActive(user)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    res.json({ token: createTenantToken(user), user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  if (req.authScope === 'platform') {
    return res.json({ user: sanitizePlatformUser(req.user) });
  }

  return res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/users', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    const result = runtimeCapabilities.hasUsersTenantId
      ? await pool.query(
        'SELECT * FROM users WHERE tenant_id = $1 ORDER BY role ASC, name ASC',
        [req.user.tenant_id]
      )
      : await pool.query('SELECT * FROM users ORDER BY role ASC, name ASC');

    res.json(result.rows.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  }

  if (role && role !== 'user') {
    return res.status(400).json({ error: 'A aplicação suporta apenas um administrador proprietário' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = runtimeCapabilities.hasUsersTenantId
      ? await pool.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, active)
         VALUES ($1, $2, $3, $4, 'user', true)
         RETURNING *`,
        [req.user.tenant_id, name, email, passwordHash]
      )
      : await pool.query(
        `INSERT INTO users (name, email, password_hash, role, active)
         VALUES ($1, $2, $3, 'user', true)
         RETURNING *`,
        [name, email, passwordHash]
      );

    res.status(201).json(sanitizeUser(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe um usuário com este e-mail' });
    }

    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/users/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  const { name, password, active } = req.body;
  const userId = String(req.params.id || '').trim();

  if (!userId) {
    return res.status(400).json({ error: 'Identificador de usuário inválido' });
  }

  try {
    const existing = runtimeCapabilities.hasUsersTenantId
      ? await pool.query('SELECT * FROM users WHERE id::text = $1 AND tenant_id = $2', [userId, req.user.tenant_id])
      : await pool.query('SELECT * FROM users WHERE id::text = $1', [userId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = existing.rows[0];

    if (normalizeRole(user.role) === 'admin' && active === false) {
      return res.status(400).json({ error: 'O administrador proprietário não pode ser desativado' });
    }

    if (typeof password === 'string' && password.trim() === '') {
      return res.status(400).json({ error: 'A nova senha não pode estar vazia' });
    }

    const nextName = name || user.name;
    const nextActive = typeof active === 'boolean' ? active : user.active;
    const nextPasswordHash = password ? await bcrypt.hash(password, 10) : user.password_hash;

    const result = runtimeCapabilities.hasUsersTenantId
      ? await pool.query(
        `UPDATE users
         SET name = $1, password_hash = $2, active = $3
         WHERE id::text = $4 AND tenant_id = $5
         RETURNING *`,
        [nextName, nextPasswordHash, nextActive, userId, req.user.tenant_id]
      )
      : await pool.query(
        `UPDATE users
         SET name = $1, password_hash = $2, active = $3
         WHERE id::text = $4
         RETURNING *`,
        [nextName, nextPasswordHash, nextActive, userId]
      );

    res.json(sanitizeUser(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasComprasTenantId
      ? await pool.query('SELECT * FROM compras WHERE tenant_id = $1 ORDER BY mes DESC, id DESC', [req.user.tenant_id])
      : await pool.query('SELECT * FROM compras ORDER BY mes DESC, id DESC');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compras', authenticateToken, requireTenantScope, async (req, res) => {
  const { item, quantidade, valor, mes } = req.body;
  const quantidadeNumerica = parseAmount(quantidade);
  const valorNumerico = parseAmount(valor);

  if (!item || !mes || quantidadeNumerica === null || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de compra inválidos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = runtimeCapabilities.hasComprasTenantId
      ? await client.query(
        'INSERT INTO compras (tenant_id, item, quantidade, valor, mes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.tenant_id, item, quantidadeNumerica, valorNumerico, mes]
      )
      : await client.query(
        'INSERT INTO compras (item, quantidade, valor, mes) VALUES ($1, $2, $3, $4) RETURNING *',
        [item, quantidadeNumerica, valorNumerico, mes]
      );

    const estoqueExistente = runtimeCapabilities.hasEstoqueTenantId
      ? await client.query(
        'SELECT * FROM estoque WHERE tenant_id = $1 AND LOWER(item) = LOWER($2)',
        [req.user.tenant_id, item]
      )
      : await client.query(
        'SELECT * FROM estoque WHERE LOWER(item) = LOWER($1)',
        [item]
      );

    if (estoqueExistente.rows.length > 0) {
      if (runtimeCapabilities.hasEstoqueTenantId) {
        await client.query(
          'UPDATE estoque SET quantidade = quantidade + $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND LOWER(item) = LOWER($3)',
          [quantidadeNumerica, req.user.tenant_id, item]
        );
      } else {
        await client.query(
          'UPDATE estoque SET quantidade = quantidade + $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(item) = LOWER($2)',
          [quantidadeNumerica, item]
        );
      }
    } else {
      if (runtimeCapabilities.hasEstoqueTenantId) {
        await client.query(
          'INSERT INTO estoque (tenant_id, item, quantidade) VALUES ($1, $2, $3)',
          [req.user.tenant_id, item, quantidadeNumerica]
        );
      } else {
        await client.query(
          'INSERT INTO estoque (item, quantidade) VALUES ($1, $2)',
          [item, quantidadeNumerica]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/compras/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    if (runtimeCapabilities.hasComprasTenantId) {
      await pool.query('DELETE FROM compras WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
    } else {
      await pool.query('DELETE FROM compras WHERE id::text = $1', [req.params.id]);
    }

    res.json({ message: 'Compra excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const normalizedScope = req.query.scope !== undefined
      ? normalizeCategoryScope(req.query.scope)
      : null;

    if (req.query.scope !== undefined && !normalizedScope) {
      return res.status(400).json({ error: `Escopo inválido. Use apenas: ${allowedCategoryScopes.join(', ')}` });
    }

    const params = [];
    const where = [];

    if (runtimeCapabilities.hasCategoriasTenantId) {
      params.push(req.user.tenant_id);
      where.push(`tenant_id = $${params.length}`);
    }

    if (normalizedScope) {
      params.push(normalizedScope);
      where.push(`scope = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, scope, name, tenant_id, created_at
       FROM categorias
       ${whereSql}
       ORDER BY scope ASC, name ASC, id ASC`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  const scope = normalizeCategoryScope(req.body?.scope);
  const name = String(req.body?.name || '').trim();

  if (!scope) {
    return res.status(400).json({ error: `Escopo inválido. Use apenas: ${allowedCategoryScopes.join(', ')}` });
  }

  if (!name) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
  }

  const duplicate = runtimeCapabilities.hasCategoriasTenantId
    ? await pool.query(
      `SELECT id
       FROM categorias
       WHERE tenant_id = $1 AND scope = $2 AND LOWER(name) = LOWER($3)
       LIMIT 1`,
      [req.user.tenant_id, scope, name]
    )
    : await pool.query(
      `SELECT id
       FROM categorias
       WHERE scope = $1 AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [scope, name]
    );

  if (duplicate.rows.length > 0) {
    return res.status(409).json({ error: 'Esta categoria já existe neste escopo' });
  }

  try {
    const result = runtimeCapabilities.hasCategoriasTenantId
      ? await pool.query(
        `INSERT INTO categorias (tenant_id, scope, name)
         VALUES ($1, $2, $3)
         RETURNING id, scope, name, tenant_id, created_at`,
        [req.user.tenant_id, scope, name]
      )
      : await pool.query(
        `INSERT INTO categorias (scope, name)
         VALUES ($1, $2)
         RETURNING id, scope, name, tenant_id, created_at`,
        [scope, name]
      );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    const result = runtimeCapabilities.hasCategoriasTenantId
      ? await pool.query(
        'DELETE FROM categorias WHERE id::text = $1 AND tenant_id = $2 RETURNING id',
        [req.params.id, req.user.tenant_id]
      )
      : await pool.query(
        'DELETE FROM categorias WHERE id::text = $1 RETURNING id',
        [req.params.id]
      );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    return res.json({ message: 'Categoria excluída com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/contas', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasContasTenantId
      ? await pool.query('SELECT * FROM contas WHERE tenant_id = $1 ORDER BY mes DESC, id DESC', [req.user.tenant_id])
      : await pool.query('SELECT * FROM contas ORDER BY mes DESC, id DESC');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contas', authenticateToken, requireTenantScope, async (req, res) => {
  const { tipo, valor, mes } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!tipo || !mes || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de conta inválidos' });
  }

  try {
    const result = runtimeCapabilities.hasContasTenantId
      ? await pool.query(
        'INSERT INTO contas (tenant_id, tipo, valor, mes) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.tenant_id, tipo, valorNumerico, mes]
      )
      : await pool.query(
        'INSERT INTO contas (tipo, valor, mes) VALUES ($1, $2, $3) RETURNING *',
        [tipo, valorNumerico, mes]
      );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contas/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    if (runtimeCapabilities.hasContasTenantId) {
      await pool.query('DELETE FROM contas WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
    } else {
      await pool.query('DELETE FROM contas WHERE id::text = $1', [req.params.id]);
    }

    res.json({ message: 'Conta excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lazer', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasLazerTenantId
      ? await pool.query('SELECT * FROM lazer WHERE tenant_id = $1 ORDER BY mes DESC, id DESC', [req.user.tenant_id])
      : await pool.query('SELECT * FROM lazer ORDER BY mes DESC, id DESC');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lazer', authenticateToken, requireTenantScope, async (req, res) => {
  const { descricao, valor, mes } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!descricao || !mes || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de despesa de lazer inválidos' });
  }

  try {
    const result = runtimeCapabilities.hasLazerTenantId
      ? await pool.query(
        'INSERT INTO lazer (tenant_id, descricao, valor, mes) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.tenant_id, descricao, valorNumerico, mes]
      )
      : await pool.query(
        'INSERT INTO lazer (descricao, valor, mes) VALUES ($1, $2, $3) RETURNING *',
        [descricao, valorNumerico, mes]
      );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lazer/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    if (runtimeCapabilities.hasLazerTenantId) {
      await pool.query('DELETE FROM lazer WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
    } else {
      await pool.query('DELETE FROM lazer WHERE id::text = $1', [req.params.id]);
    }

    res.json({ message: 'Despesa de lazer excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/manutencoes', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasManutencoesTenantId
      ? await pool.query('SELECT * FROM manutencoes WHERE tenant_id = $1 ORDER BY data DESC, id DESC', [req.user.tenant_id])
      : await pool.query('SELECT * FROM manutencoes ORDER BY data DESC, id DESC');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/manutencoes', authenticateToken, requireTenantScope, async (req, res) => {
  const { descricao, valor, data } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!descricao || !data || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de manutenção inválidos' });
  }

  try {
    const result = runtimeCapabilities.hasManutencoesTenantId
      ? await pool.query(
        'INSERT INTO manutencoes (tenant_id, descricao, valor, data) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.tenant_id, descricao, valorNumerico, data]
      )
      : await pool.query(
        'INSERT INTO manutencoes (descricao, valor, data) VALUES ($1, $2, $3) RETURNING *',
        [descricao, valorNumerico, data]
      );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/manutencoes/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    if (runtimeCapabilities.hasManutencoesTenantId) {
      await pool.query('DELETE FROM manutencoes WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
    } else {
      await pool.query('DELETE FROM manutencoes WHERE id::text = $1', [req.params.id]);
    }

    res.json({ message: 'Manutenção excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/investimentos', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasInvestimentosTenantId
      ? await pool.query('SELECT * FROM investimentos WHERE tenant_id = $1 ORDER BY mes DESC, id DESC', [req.user.tenant_id])
      : await pool.query('SELECT * FROM investimentos ORDER BY mes DESC, id DESC');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/investimentos', authenticateToken, requireTenantScope, async (req, res) => {
  const { descricao, valor, mes, nota } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!descricao || !mes || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de investimento inválidos' });
  }

  try {
    const result = runtimeCapabilities.hasInvestimentosTenantId
      ? await pool.query(
        'INSERT INTO investimentos (tenant_id, descricao, valor, mes, nota) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.tenant_id, descricao, valorNumerico, mes, nota || null]
      )
      : await pool.query(
        'INSERT INTO investimentos (descricao, valor, mes, nota) VALUES ($1, $2, $3, $4) RETURNING *',
        [descricao, valorNumerico, mes, nota || null]
      );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/investimentos/:id', authenticateToken, requireTenantScope, requireRole('admin'), async (req, res) => {
  try {
    if (runtimeCapabilities.hasInvestimentosTenantId) {
      await pool.query('DELETE FROM investimentos WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
    } else {
      await pool.query('DELETE FROM investimentos WHERE id::text = $1', [req.params.id]);
    }

    res.json({ message: 'Investimento excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/estoque', authenticateToken, requireTenantScope, async (req, res) => {
  try {
    const result = runtimeCapabilities.hasEstoqueTenantId
      ? await pool.query('SELECT * FROM estoque WHERE tenant_id = $1 AND quantidade > 0 ORDER BY item', [req.user.tenant_id])
      : await pool.query('SELECT * FROM estoque WHERE quantidade > 0 ORDER BY item');

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/estoque/:id/baixa', authenticateToken, requireTenantScope, async (req, res) => {
  const quantidadeNumerica = parseAmount(req.body.quantidade);

  if (quantidadeNumerica === null || quantidadeNumerica <= 0) {
    return res.status(400).json({ error: 'Quantidade inválida' });
  }

  try {
    const item = runtimeCapabilities.hasEstoqueTenantId
      ? await pool.query('SELECT * FROM estoque WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id])
      : await pool.query('SELECT * FROM estoque WHERE id::text = $1', [req.params.id]);

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    if (Number(item.rows[0].quantidade) < quantidadeNumerica) {
      return res.status(400).json({ error: 'Quantidade insuficiente em estoque' });
    }

    const novaQuantidade = Number(item.rows[0].quantidade) - quantidadeNumerica;

    if (novaQuantidade === 0) {
      if (runtimeCapabilities.hasEstoqueTenantId) {
        await pool.query('DELETE FROM estoque WHERE id::text = $1 AND tenant_id = $2', [req.params.id, req.user.tenant_id]);
      } else {
        await pool.query('DELETE FROM estoque WHERE id::text = $1', [req.params.id]);
      }
    } else {
      if (runtimeCapabilities.hasEstoqueTenantId) {
        await pool.query(
          'UPDATE estoque SET quantidade = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2 AND tenant_id = $3',
          [novaQuantidade, req.params.id, req.user.tenant_id]
        );
      } else {
        await pool.query(
          'UPDATE estoque SET quantidade = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2',
          [novaQuantidade, req.params.id]
        );
      }
    }

    res.json({ message: 'Baixa realizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/platform/tenants', authenticateToken, requirePlatformAdmin, async (req, res) => {
  if (!runtimeCapabilities.hasTenantsTable) {
    return res.status(400).json({ error: 'Tabela tenants não está disponível neste ambiente' });
  }

  try {
    const usersCountSql = runtimeCapabilities.hasUsersTenantId
      ? `COALESCE((SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id), 0) AS users_count`
      : '0::int AS users_count';

    const result = await pool.query(
      `SELECT t.id, t.name, t.slug, t.plan, t.subscription_status, t.created_at, ${usersCountSql},
              (t.slug = $1) AS is_protected
       FROM tenants t
       ORDER BY t.created_at DESC, t.name ASC`,
      [adminTenantSlug]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/platform/tenants', authenticateToken, requirePlatformAdmin, async (req, res) => {
  if (!runtimeCapabilities.hasTenantsTable) {
    return res.status(400).json({ error: 'Tabela tenants não está disponível neste ambiente' });
  }

  const name = String(req.body?.name || '').trim();
  const slug = normalizeTenantSlug(req.body?.slug);
  const plan = normalizeTenantPlan(req.body?.plan || 'Starter');
  const subscriptionStatus = normalizeTenantStatus(req.body?.subscriptionStatus || 'active');
  const createAdminUser = req.body?.createAdminUser === true;
  const ownerName = String(req.body?.ownerName || '').trim();
  const adminName = String(req.body?.adminName || ownerName || name || 'Administrador').trim();
  const adminEmail = String(req.body?.adminEmail || req.body?.contactEmail || '').trim().toLowerCase();
  const adminPassword = String(req.body?.adminPassword || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Nome do tenant é obrigatório' });
  }

  if (!slug) {
    return res.status(400).json({ error: 'Slug do tenant é obrigatório' });
  }

  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido. Use de 3 a 80 caracteres com letras minúsculas, números e hífen.' });
  }

  if (!plan) {
    return res.status(400).json({ error: `Plano inválido. Use apenas: ${allowedTenantPlans.join(', ')}` });
  }

  if (!subscriptionStatus) {
    return res.status(400).json({ error: `Status inválido. Use apenas: ${allowedTenantStatuses.join(', ')}` });
  }

  if (createAdminUser && !runtimeCapabilities.hasUsersTenantId) {
    return res.status(400).json({ error: 'Não é possível criar admin automaticamente neste ambiente sem users.tenant_id' });
  }

  if (createAdminUser && !adminEmail) {
    return res.status(400).json({ error: 'E-mail do usuário admin é obrigatório quando a criação automática estiver ativa' });
  }

  if (createAdminUser && !adminPassword) {
    return res.status(400).json({ error: 'Senha do usuário admin é obrigatória quando a criação automática estiver ativa' });
  }

  if (createAdminUser && adminPassword.length < 6) {
    return res.status(400).json({ error: 'A senha do usuário admin deve ter ao menos 6 caracteres' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO tenants (name, slug, plan, subscription_status)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, plan, subscription_status, created_at`,
      [name, slug, plan, subscriptionStatus]
    );

    const tenant = result.rows[0];

    if (createAdminUser) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role, active)
         VALUES ($1, $2, $3, $4, 'admin', $5)`,
        [tenant.id, adminName, adminEmail, passwordHash, subscriptionStatus === 'active']
      );
    }

    await applyTenantUserStatus(client, tenant.id, subscriptionStatus);
    await client.query('COMMIT');

    return res.status(201).json(tenant);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      if (String(error.constraint || '').includes('users')) {
        return res.status(409).json({ error: 'Já existe usuário com este e-mail' });
      }

      return res.status(409).json({ error: 'Já existe tenant com este slug' });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.patch('/api/platform/tenants/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  if (!runtimeCapabilities.hasTenantsTable) {
    return res.status(400).json({ error: 'Tabela tenants não está disponível neste ambiente' });
  }

  const targetId = String(req.params.id || '').trim();

  if (!targetId) {
    return res.status(400).json({ error: 'Identificador de tenant inválido' });
  }

  const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : null;
  const nextSlug = req.body?.slug !== undefined ? normalizeTenantSlug(req.body.slug) : null;
  const nextPlan = req.body?.plan !== undefined ? normalizeTenantPlan(req.body.plan) : null;
  const nextStatus = req.body?.subscriptionStatus !== undefined ? normalizeTenantStatus(req.body.subscriptionStatus) : null;
  const createAdminUser = req.body?.createAdminUser === true;
  const ownerName = String(req.body?.ownerName || '').trim();
  const adminName = String(req.body?.adminName || ownerName || nextName || '').trim();
  const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase();
  const adminPassword = String(req.body?.adminPassword || '').trim();

  if (nextName !== null && !nextName) {
    return res.status(400).json({ error: 'Nome do tenant não pode ficar vazio' });
  }

  if (nextSlug !== null && !nextSlug) {
    return res.status(400).json({ error: 'Slug do tenant não pode ficar vazio' });
  }

  if (nextSlug !== null && !/^[a-z0-9-]{3,80}$/.test(nextSlug)) {
    return res.status(400).json({ error: 'Slug inválido. Use de 3 a 80 caracteres com letras minúsculas, números e hífen.' });
  }

  if (req.body?.plan !== undefined && !nextPlan) {
    return res.status(400).json({ error: `Plano inválido. Use apenas: ${allowedTenantPlans.join(', ')}` });
  }

  if (req.body?.subscriptionStatus !== undefined && !nextStatus) {
    return res.status(400).json({ error: `Status inválido. Use apenas: ${allowedTenantStatuses.join(', ')}` });
  }

  if (createAdminUser && !runtimeCapabilities.hasUsersTenantId) {
    return res.status(400).json({ error: 'Não é possível criar/resetar admin automaticamente neste ambiente sem users.tenant_id' });
  }

  if (createAdminUser && !adminEmail) {
    return res.status(400).json({ error: 'E-mail do usuário admin é obrigatório quando a criação/reset estiver ativa' });
  }

  if (createAdminUser && !adminPassword) {
    return res.status(400).json({ error: 'Senha do usuário admin é obrigatória quando a criação/reset estiver ativa' });
  }

  if (createAdminUser && adminPassword.length < 6) {
    return res.status(400).json({ error: 'A senha do usuário admin deve ter ao menos 6 caracteres' });
  }

  if (nextName === null && nextSlug === null && nextPlan === null && nextStatus === null && !createAdminUser) {
    return res.status(400).json({ error: 'Informe ao menos um campo para atualização' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      'SELECT id, slug FROM tenants WHERE id::text = $1 LIMIT 1',
      [targetId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    const currentTenant = currentResult.rows[0];

    if (currentTenant.slug === adminTenantSlug && nextSlug && nextSlug !== currentTenant.slug) {
      return res.status(400).json({ error: 'O tenant padrão inicial tem slug protegido e não pode ser alterado' });
    }

    const result = await client.query(
      `UPDATE tenants
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           plan = COALESCE($3, plan),
           subscription_status = COALESCE($4, subscription_status)
       WHERE id::text = $5
       RETURNING id, name, slug, plan, subscription_status, created_at`,
      [nextName, nextSlug, nextPlan, nextStatus, targetId]
    );

    const tenant = result.rows[0];

    if (createAdminUser) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const existingAdmin = await client.query(
        `SELECT id
         FROM users
         WHERE tenant_id = $1 AND role IN ('admin', 'owner')
         ORDER BY created_at ASC, id ASC
         LIMIT 1`,
        [tenant.id]
      );

      if (existingAdmin.rows.length > 0) {
        await client.query(
          `UPDATE users
           SET name = $1,
               email = $2,
               password_hash = $3,
               active = $4
           WHERE id = $5`,
          [adminName || tenant.name, adminEmail, passwordHash, tenant.subscription_status === 'active', existingAdmin.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO users (tenant_id, name, email, password_hash, role, active)
           VALUES ($1, $2, $3, $4, 'admin', $5)`,
          [tenant.id, adminName || tenant.name, adminEmail, passwordHash, tenant.subscription_status === 'active']
        );
      }
    }

    await applyTenantUserStatus(client, tenant.id, tenant.subscription_status);
    await client.query('COMMIT');

    return res.json(tenant);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      if (String(error.constraint || '').includes('users')) {
        return res.status(409).json({ error: 'Já existe usuário com este e-mail' });
      }

      return res.status(409).json({ error: 'Já existe tenant com este slug' });
    }

    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/platform/users', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    if (runtimeCapabilities.hasTenantsTable && runtimeCapabilities.hasUsersTenantId) {
      const params = [];
      let where = '';

      if (typeof req.query.tenantId === 'string' && req.query.tenantId.trim()) {
        params.push(req.query.tenantId.trim());
        where = 'WHERE u.tenant_id::text = $1';
      }

      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, u.tenant_id,
                t.name AS tenant_name, t.slug AS tenant_slug
         FROM users u
         LEFT JOIN tenants t ON t.id = u.tenant_id
         ${where}
         ORDER BY u.created_at DESC, u.name ASC`,
        params
      );

      return res.json(result.rows.map((row) => ({
        ...sanitizeUser(row),
        tenantName: row.tenant_name || null,
        tenantSlug: row.tenant_slug || null
      })));
    }

    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC, name ASC');
    return res.json(result.rows.map((row) => ({ ...sanitizeUser(row), tenantName: null, tenantSlug: null })));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/platform/admins', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, active, created_at FROM platform_users ORDER BY created_at ASC, id ASC'
    );

    return res.json(result.rows.map(sanitizePlatformUser));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/platform/admins/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    const confirmEmail = String(req.body?.confirmEmail || '').trim().toLowerCase();

    if (!targetId) {
      return res.status(400).json({ error: 'Identificador de administrador inválido' });
    }

    if (!confirmEmail) {
      return res.status(400).json({ error: 'Confirmação do e-mail do administrador é obrigatória' });
    }

    const targetAdmin = await pool.query(
      'SELECT id, email FROM platform_users WHERE id::text = $1 LIMIT 1',
      [targetId]
    );

    if (targetAdmin.rows.length === 0) {
      return res.status(404).json({ error: 'Administrador de plataforma não encontrado' });
    }

    if (String(req.user.id) === targetId) {
      return res.status(400).json({ error: 'Você não pode excluir o próprio super admin logado' });
    }

    if (String(targetAdmin.rows[0].email).trim().toLowerCase() !== confirmEmail) {
      return res.status(400).json({ error: 'Confirmação inválida. Informe exatamente o e-mail do administrador.' });
    }

    const result = await pool.query('DELETE FROM platform_users WHERE id::text = $1 RETURNING id', [targetId]);

    return res.json({ message: 'Administrador de plataforma removido com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/platform/users/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  try {
    const targetId = String(req.params.id || '').trim();

    if (!targetId) {
      return res.status(400).json({ error: 'Identificador de usuário inválido' });
    }

    const result = await pool.query('DELETE FROM users WHERE id::text = $1 RETURNING id', [targetId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/platform/tenants/:id', authenticateToken, requirePlatformAdmin, async (req, res) => {
  if (!runtimeCapabilities.hasTenantsTable) {
    return res.status(400).json({ error: 'Tabela tenants não está disponível neste ambiente' });
  }

  try {
    const targetId = String(req.params.id || '').trim();
    const confirmSlug = String(req.body?.confirmSlug || '').trim().toLowerCase();

    if (!targetId) {
      return res.status(400).json({ error: 'Identificador de tenant inválido' });
    }

    if (!confirmSlug) {
      return res.status(400).json({ error: 'Confirmação do slug do tenant é obrigatória' });
    }

    const targetTenant = await pool.query(
      'SELECT id, slug FROM tenants WHERE id::text = $1 LIMIT 1',
      [targetId]
    );

    if (targetTenant.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    if (targetTenant.rows[0].slug === adminTenantSlug) {
      return res.status(400).json({ error: 'O tenant padrão inicial está protegido contra exclusão' });
    }

    if (String(targetTenant.rows[0].slug).trim().toLowerCase() !== confirmSlug) {
      return res.status(400).json({ error: 'Confirmação inválida. Informe exatamente o slug do tenant.' });
    }

    const result = await pool.query('DELETE FROM tenants WHERE id::text = $1 RETURNING id', [targetId]);

    return res.json({ message: 'Tenant removido com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  try {
    await ensureSchema();
    await discoverCapabilities();
    await ensureAdminUser();
    await ensurePlatformAdminUser();

    app.listen(port, () => {
      console.log(`Backend rodando na porta ${port}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar backend:', error);
    process.exit(1);
  }
};

startServer();
