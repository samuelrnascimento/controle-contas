const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(cors());
app.use(express.json());

// Teste de conexão
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ===== COMPRAS =====

// Listar todas as compras
app.get('/api/compras', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compras ORDER BY mes DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar compra
app.post('/api/compras', async (req, res) => {
  const { item, quantidade, valor, mes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO compras (item, quantidade, valor, mes) VALUES ($1, $2, $3, $4) RETURNING *',
      [item, quantidade, valor, mes]
    );
    
    // Atualizar ou criar item no estoque
    const estoqueExistente = await pool.query(
      'SELECT * FROM estoque WHERE LOWER(item) = LOWER($1)',
      [item]
    );
    
    if (estoqueExistente.rows.length > 0) {
      await pool.query(
        'UPDATE estoque SET quantidade = quantidade + $1 WHERE LOWER(item) = LOWER($2)',
        [quantidade, item]
      );
    } else {
      await pool.query(
        'INSERT INTO estoque (item, quantidade) VALUES ($1, $2)',
        [item, quantidade]
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir compra
app.delete('/api/compras/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM compras WHERE id = $1', [req.params.id]);
    res.json({ message: 'Compra excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CONTAS =====

// Listar todas as contas
app.get('/api/contas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contas ORDER BY mes DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar conta
app.post('/api/contas', async (req, res) => {
  const { tipo, valor, mes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO contas (tipo, valor, mes) VALUES ($1, $2, $3) RETURNING *',
      [tipo, valor, mes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir conta
app.delete('/api/contas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM contas WHERE id = $1', [req.params.id]);
    res.json({ message: 'Conta excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MANUTENÇÕES =====

// Listar todas as manutenções
app.get('/api/manutencoes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM manutencoes ORDER BY data DESC, id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar manutenção
app.post('/api/manutencoes', async (req, res) => {
  const { descricao, valor, data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO manutencoes (descricao, valor, data) VALUES ($1, $2, $3) RETURNING *',
      [descricao, valor, data]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excluir manutenção
app.delete('/api/manutencoes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM manutencoes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Manutenção excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ESTOQUE =====

// Listar todo o estoque
app.get('/api/estoque', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estoque WHERE quantidade > 0 ORDER BY item');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dar baixa no estoque
app.patch('/api/estoque/:id/baixa', async (req, res) => {
  const { quantidade } = req.body;
  try {
    const item = await pool.query('SELECT * FROM estoque WHERE id = $1', [req.params.id]);
    
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    if (item.rows[0].quantidade < quantidade) {
      return res.status(400).json({ error: 'Quantidade insuficiente em estoque' });
    }
    
    const novaQuantidade = item.rows[0].quantidade - quantidade;
    
    if (novaQuantidade === 0) {
      await pool.query('DELETE FROM estoque WHERE id = $1', [req.params.id]);
    } else {
      await pool.query('UPDATE estoque SET quantidade = $1 WHERE id = $2', [novaQuantidade, req.params.id]);
    }
    
    res.json({ message: 'Baixa realizada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
