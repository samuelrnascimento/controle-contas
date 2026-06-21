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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  createdAt: user.created_at
});

const createToken = (user) => jwt.sign(
  { sub: user.id, role: user.role, email: user.email },
  jwtSecret,
  { expiresIn: '12h' }
);

const parseAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Autenticação obrigatória' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const result = await pool.query(
      'SELECT id, name, email, role, active, created_at FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0 || !result.rows[0].active) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
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

    CREATE TABLE IF NOT EXISTS manutencoes (
      id SERIAL PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor DECIMAL(10, 2) NOT NULL,
      data DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estoque (
      id SERIAL PRIMARY KEY,
      item VARCHAR(255) NOT NULL UNIQUE,
      quantidade DECIMAL(10, 2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_compras_mes ON compras(mes);
    CREATE INDEX IF NOT EXISTS idx_contas_mes ON contas(mes);
    CREATE INDEX IF NOT EXISTS idx_manutencoes_data ON manutencoes(data);
    CREATE INDEX IF NOT EXISTS idx_estoque_item ON estoque(item);
  `);
};

const ensureAdminUser = async () => {
  const existingAdmin = await pool.query(
    'SELECT id FROM users WHERE role = $1 LIMIT 1',
    ['admin']
  );

  if (existingAdmin.rows.length > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    'INSERT INTO users (name, email, password_hash, role, active) VALUES ($1, $2, $3, $4, $5)',
    [adminName, adminEmail, passwordHash, 'admin', true]
  );

  console.log(`Administrador criado: ${adminEmail}`);
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
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    res.json({ token: createToken(user), user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, active, created_at FROM users ORDER BY role ASC, name ASC'
    );
    res.json(result.rows.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  }

  if (role && role !== 'user') {
    return res.status(400).json({ error: 'A aplicação suporta apenas um administrador proprietário' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, active)
       VALUES ($1, $2, $3, 'user', true)
       RETURNING id, name, email, role, active, created_at`,
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

app.patch('/api/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, password, active } = req.body;
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId)) {
    return res.status(400).json({ error: 'Identificador de usuário inválido' });
  }

  try {
    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = existing.rows[0];

    if (user.role === 'admin' && active === false) {
      return res.status(400).json({ error: 'O administrador proprietário não pode ser desativado' });
    }

    if (typeof password === 'string' && password.trim() === '') {
      return res.status(400).json({ error: 'A nova senha não pode estar vazia' });
    }

    const nextName = name || user.name;
    const nextActive = typeof active === 'boolean' ? active : user.active;
    const nextPasswordHash = password ? await bcrypt.hash(password, 10) : user.password_hash;

    const result = await pool.query(
      `UPDATE users
       SET name = $1, password_hash = $2, active = $3
       WHERE id = $4
       RETURNING id, name, email, role, active, created_at`,
      [nextName, nextPasswordHash, nextActive, userId]
    );

    res.json(sanitizeUser(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compras ORDER BY mes DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compras', authenticateToken, async (req, res) => {
  const { item, quantidade, valor, mes } = req.body;
  const quantidadeNumerica = parseAmount(quantidade);
  const valorNumerico = parseAmount(valor);

  if (!item || !mes || quantidadeNumerica === null || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de compra inválidos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO compras (item, quantidade, valor, mes) VALUES ($1, $2, $3, $4) RETURNING *',
      [item, quantidadeNumerica, valorNumerico, mes]
    );

    const estoqueExistente = await client.query(
      'SELECT * FROM estoque WHERE LOWER(item) = LOWER($1)',
      [item]
    );

    if (estoqueExistente.rows.length > 0) {
      await client.query(
        'UPDATE estoque SET quantidade = quantidade + $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(item) = LOWER($2)',
        [quantidadeNumerica, item]
      );
    } else {
      await client.query(
        'INSERT INTO estoque (item, quantidade) VALUES ($1, $2)',
        [item, quantidadeNumerica]
      );
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

app.delete('/api/compras/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM compras WHERE id = $1', [req.params.id]);
    res.json({ message: 'Compra excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contas', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contas ORDER BY mes DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contas', authenticateToken, async (req, res) => {
  const { tipo, valor, mes } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!tipo || !mes || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de conta inválidos' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO contas (tipo, valor, mes) VALUES ($1, $2, $3) RETURNING *',
      [tipo, valorNumerico, mes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contas/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM contas WHERE id = $1', [req.params.id]);
    res.json({ message: 'Conta excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/manutencoes', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM manutencoes ORDER BY data DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/manutencoes', authenticateToken, async (req, res) => {
  const { descricao, valor, data } = req.body;
  const valorNumerico = parseAmount(valor);

  if (!descricao || !data || valorNumerico === null) {
    return res.status(400).json({ error: 'Dados de manutenção inválidos' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO manutencoes (descricao, valor, data) VALUES ($1, $2, $3) RETURNING *',
      [descricao, valorNumerico, data]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/manutencoes/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM manutencoes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Manutenção excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/estoque', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estoque WHERE quantidade > 0 ORDER BY item');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/estoque/:id/baixa', authenticateToken, async (req, res) => {
  const quantidadeNumerica = parseAmount(req.body.quantidade);

  if (quantidadeNumerica === null || quantidadeNumerica <= 0) {
    return res.status(400).json({ error: 'Quantidade inválida' });
  }

  try {
    const item = await pool.query('SELECT * FROM estoque WHERE id = $1', [req.params.id]);

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    if (Number(item.rows[0].quantidade) < quantidadeNumerica) {
      return res.status(400).json({ error: 'Quantidade insuficiente em estoque' });
    }

    const novaQuantidade = Number(item.rows[0].quantidade) - quantidadeNumerica;

    if (novaQuantidade === 0) {
      await pool.query('DELETE FROM estoque WHERE id = $1', [req.params.id]);
    } else {
      await pool.query(
        'UPDATE estoque SET quantidade = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [novaQuantidade, req.params.id]
      );
    }

    res.json({ message: 'Baixa realizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  try {
    await ensureSchema();
    await ensureAdminUser();

    app.listen(port, () => {
      console.log(`Backend rodando na porta ${port}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar backend:', error);
    process.exit(1);
  }
};

startServer();
