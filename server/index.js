import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '..', 'data', 'loan.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    remainingAmount REAL NOT NULL,
    creditLimit REAL,
    interestRate REAL,
    dueDate INTEGER NOT NULL,
    lastDueDate INTEGER,
    repaymentType TEXT DEFAULT 'revolving',
    maturityDate TEXT,
    createdAt TEXT NOT NULL,
    note TEXT
  )
`);

function addColumnIfNotExists(table, column, definition) {
  try {
    const cols = db.pragma(`table_info(${table})`);
    if (!cols.find(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`已添加字段: ${table}.${column}`);
    }
  } catch (e) {
    console.warn(`添加字段失败 ${table}.${column}:`, e.message);
  }
}

addColumnIfNotExists('debts', 'repaymentType', "TEXT DEFAULT 'revolving'");
addColumnIfNotExists('debts', 'maturityDate', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    liquidity TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    note TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const getDebtRow = (row) => row;

const getAssetRow = (row) => row;

app.get('/api/debts', (req, res) => {
  try {
    const debts = db.prepare('SELECT * FROM debts ORDER BY createdAt DESC').all().map(getDebtRow);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debts', (req, res) => {
  try {
    const { id, name, type, remainingAmount, creditLimit, interestRate, dueDate, lastDueDate, repaymentType, maturityDate, createdAt, note } = req.body;
    db.prepare(`
      INSERT INTO debts (id, name, type, remainingAmount, creditLimit, interestRate, dueDate, lastDueDate, repaymentType, maturityDate, createdAt, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, remainingAmount, creditLimit ?? null, interestRate ?? null, dueDate, lastDueDate ?? null, repaymentType || 'revolving', maturityDate ?? null, createdAt, note || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/debts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => req.body[k]);
    db.prepare(`UPDATE debts SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/debts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM debts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assets', (req, res) => {
  try {
    const assets = db.prepare('SELECT * FROM assets ORDER BY createdAt DESC').all().map(getAssetRow);
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assets', (req, res) => {
  try {
    const { id, name, type, amount, liquidity, createdAt, note } = req.body;
    db.prepare(`
      INSERT INTO assets (id, name, type, amount, liquidity, createdAt, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, amount, liquidity, createdAt, note || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/assets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => req.body[k]);
    db.prepare(`UPDATE assets SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/assets/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config/:key', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(req.params.key);
    res.json({ value: row ? row.value : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config/:key', (req, res) => {
  try {
    db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`).run(req.params.key, req.body.value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
  console.log(`数据库文件: ${dbPath}`);
});
