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
    dueDate INTEGER,
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
addColumnIfNotExists('debts', 'lastDueDate', 'INTEGER');
addColumnIfNotExists('debts', 'creditLimit', 'REAL');
addColumnIfNotExists('debts', 'interestRate', 'REAL');
addColumnIfNotExists('debts', 'note', 'TEXT');

// 迁移：debts.dueDate 由 NOT NULL 改为可空（灵活模式不填出账日）
// SQLite 无法直接去掉 NOT NULL，需重建表
(function migrateDebtsDueDate() {
  try {
    const cols = db.pragma('table_info(debts)');
    const dueDateCol = cols.find(c => c.name === 'dueDate');
    if (dueDateCol && dueDateCol.notnull === 1) {
      console.log('[migrate] debts.dueDate NOT NULL → 可空，开始重建表...');
      db.exec('BEGIN TRANSACTION');
      db.exec(`CREATE TABLE debts_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        remainingAmount REAL NOT NULL,
        creditLimit REAL,
        interestRate REAL,
        dueDate INTEGER,
        lastDueDate INTEGER,
        repaymentType TEXT DEFAULT 'revolving',
        maturityDate TEXT,
        createdAt TEXT NOT NULL,
        note TEXT
      )`);
      db.exec(`INSERT INTO debts_new (id, name, type, remainingAmount, creditLimit, interestRate, dueDate, lastDueDate, repaymentType, maturityDate, createdAt, note)
               SELECT id, name, type, remainingAmount, creditLimit, interestRate, dueDate, lastDueDate, repaymentType, maturityDate, createdAt, note FROM debts`);
      db.exec('DROP TABLE debts');
      db.exec('ALTER TABLE debts_new RENAME TO debts');
      db.exec('COMMIT');
      console.log('[migrate] debts.dueDate 已迁移为可空');
    }
  } catch (e) {
    db.exec('ROLLBACK');
    console.warn('[migrate] debts.dueDate 迁移失败:', e.message);
  }
})();

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

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL,
    debt_name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    interest_portion REAL NOT NULL DEFAULT 0,
    principal_portion REAL NOT NULL DEFAULT 0,
    remaining_after REAL NOT NULL DEFAULT 0,
    interest_rate REAL,
    created_at TEXT NOT NULL,
    note TEXT
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
    `).run(id, name, type, remainingAmount, creditLimit ?? null, interestRate ?? null, dueDate ?? null, lastDueDate ?? null, repaymentType || 'revolving', maturityDate ?? null, createdAt, note || null);
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

// ==================== 交易记录相关 ====================

app.get('/api/transactions', (req, res) => {
  try {
    const { debtId, type, startDate, endDate } = req.query;
    let sql = 'SELECT * FROM transactions';
    const conditions = [];
    const params = [];
    if (debtId) { conditions.push('debt_id = ?'); params.push(debtId); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (startDate) { conditions.push('created_at >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('created_at <= ?'); params.push(endDate); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', (req, res) => {
  try {
    const { id, debt_id, debt_name, type, amount, interest_portion, principal_portion, remaining_after, interest_rate, created_at, note } = req.body;
    db.prepare(`
      INSERT INTO transactions (id, debt_id, debt_name, type, amount, interest_portion, principal_portion, remaining_after, interest_rate, created_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, debt_id, debt_name, type, amount || 0, interest_portion || 0, principal_portion || 0, remaining_after || 0, interest_rate ?? null, created_at, note || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => req.body[k]);
    db.prepare(`UPDATE transactions SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    // 若是还款记录 (type=repay)，则把 debt 的剩余金额加回本金部分（保持业务一致）
    if (tx && tx.type === 'repay' && tx.debt_id && typeof tx.principal_portion === 'number') {
      const debt = db.prepare('SELECT remainingAmount FROM debts WHERE id = ?').get(tx.debt_id);
      if (debt && typeof debt.remainingAmount === 'number') {
        const newRemaining = debt.remainingAmount + tx.principal_portion;
        db.prepare('UPDATE debts SET remainingAmount = ? WHERE id = ?').run(newRemaining, tx.debt_id);
      }
    }
    res.json({ success: true, tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 投资记账相关 ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS invest_platforms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    market TEXT NOT NULL,
    currency TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    note TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invest_accounts (
    id TEXT PRIMARY KEY,
    platformId TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    productType TEXT,
    note TEXT,
    createdAt TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invest_pnl (
    id TEXT PRIMARY KEY,
    platformId TEXT NOT NULL,
    accountId TEXT,
    symbol TEXT,
    currency TEXT NOT NULL,
    pnl REAL NOT NULL,
    recordedAt TEXT NOT NULL,
    note TEXT,
    createdAt TEXT NOT NULL
  )
`);

// 迁移老表结构（如果 invest_pnl 是老版本创建的）
addColumnIfNotExists('invest_pnl', 'accountId', 'TEXT');

// 老版本的 invest_pnl 表有 symbol TEXT NOT NULL 约束，用户不填品种时会报错
// 通过「重建表 + 复制数据」迁移为 symbol TEXT 可空
(function migrateInvestPnlSymbolNullable() {
  try {
    const cols = db.pragma('table_info(invest_pnl)');
    const symbolCol = cols.find(c => c.name === 'symbol');
    if (!symbolCol || symbolCol.notnull === 0) return; // 已经可空，无需迁移
    // 利用 SQLite 的 built-in "rebuild"：重命名、创建新表、导数据
    const tx = db.transaction(() => {
      // 1. 导出当前所有数据
      const rows = db.prepare('SELECT id, platformId, accountId, symbol, currency, pnl, recordedAt, note, createdAt FROM invest_pnl').all();
      // 2. 重命名旧表
      db.prepare('ALTER TABLE invest_pnl RENAME TO invest_pnl_old_symbol_mig').run();
      // 3. 建新表（和 server/index.js 中最新 CREATE TABLE 语句一致）
      db.prepare(`CREATE TABLE invest_pnl (
        id TEXT PRIMARY KEY,
        platformId TEXT NOT NULL,
        accountId TEXT,
        symbol TEXT,
        currency TEXT NOT NULL,
        pnl REAL NOT NULL,
        recordedAt TEXT NOT NULL,
        note TEXT,
        createdAt TEXT NOT NULL
      )`).run();
      // 4. 导入数据（symbol 保持原值）
      const insert = db.prepare('INSERT INTO invest_pnl (id, platformId, accountId, symbol, currency, pnl, recordedAt, note, createdAt) VALUES (@id, @platformId, @accountId, @symbol, @currency, @pnl, @recordedAt, @note, @createdAt)');
      rows.forEach(r => insert.run(r));
      // 5. 删除旧表
      db.prepare('DROP TABLE invest_pnl_old_symbol_mig').run();
      console.log('[migrate] invest_pnl.symbol 已由 NOT NULL 迁移为可空，迁移行数:', rows.length);
    });
    tx();
  } catch (e) {
    console.warn('[migrate] invest_pnl.symbol 迁移失败，将尝试回滚：', e.message);
    try {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invest_pnl_old_symbol_mig'").get();
      if (exists) {
        db.prepare("DROP TABLE IF EXISTS invest_pnl").run();
        db.prepare('ALTER TABLE invest_pnl_old_symbol_mig RENAME TO invest_pnl').run();
      }
    } catch (err) {
      console.warn('[migrate] 回滚失败:', err.message);
    }
  }
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS fx_rates (
    id TEXT PRIMARY KEY,
    \`from\` TEXT NOT NULL UNIQUE,
    rate REAL NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

// 平台
// 注：markets 以 JSON 字符串存储在 invest_platforms.market 列中
function parsePlatformRow(row) {
  if (!row) return row;
  let ms = row.market;
  if (typeof ms === 'string' && ms.length > 0) {
    try { ms = JSON.parse(ms); } catch (e) { ms = null; }
  } else {
    ms = null;
  }
  // 兼容老的单值字符串（'crypto' / 'us_stock' 等）
  if (typeof ms === 'string') ms = [ms];
  return { ...row, markets: Array.isArray(ms) ? ms : (ms ? [ms] : []) };
}

app.get('/api/invest/platforms', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invest_platforms ORDER BY createdAt DESC').all().map(parsePlatformRow);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invest/platforms', (req, res) => {
  try {
    const { id, name, markets, currency, createdAt, note } = req.body;
    const mJson = Array.isArray(markets) && markets.length > 0 ? JSON.stringify(markets) : null;
    db.prepare('INSERT INTO invest_platforms (id, name, market, currency, createdAt, note) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, mJson, currency, createdAt, note || null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/invest/platforms/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    // 数组字段序列化为 JSON 字符串存储
    if (Array.isArray(body.markets)) {
      body.market = body.markets.length > 0 ? JSON.stringify(body.markets) : null;
      delete body.markets;
    }
    const fields = Object.keys(body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => body[k]);
    db.prepare(`UPDATE invest_platforms SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invest/platforms/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invest_platforms WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM invest_accounts WHERE platformId = ?').run(req.params.id);
    db.prepare('DELETE FROM invest_pnl WHERE platformId = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 账户
// 注：productTypes 以 JSON 字符串存储在 invest_accounts.productType 列中
function parseAccountRow(row) {
  if (!row) return row;
  let pts = row.productType;
  if (typeof pts === 'string' && pts.length > 0) {
    try { pts = JSON.parse(pts); } catch (e) { pts = null; }
  } else {
    pts = null;
  }
  // 兼容老的单值字符串（'spot' / 'futures'）
  if (typeof pts === 'string') pts = [pts];
  return { ...row, productTypes: Array.isArray(pts) ? pts : (pts ? [pts] : undefined) };
}

app.get('/api/invest/accounts', (req, res) => {
  try {
    const { platformId } = req.query;
    let sql = 'SELECT * FROM invest_accounts';
    const params = [];
    if (platformId) { sql += ' WHERE platformId = ?'; params.push(platformId); }
    sql += ' ORDER BY createdAt DESC';
    const rows = db.prepare(sql).all(...params).map(parseAccountRow);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invest/accounts', (req, res) => {
  try {
    const { id, platformId, name, currency, productTypes, note, createdAt } = req.body;
    const ptJson = Array.isArray(productTypes) && productTypes.length > 0 ? JSON.stringify(productTypes) : null;
    db.prepare('INSERT INTO invest_accounts (id, platformId, name, currency, productType, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, platformId, name, currency, ptJson, note || null, createdAt);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/invest/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };
    // 数组字段序列化为 JSON 字符串存储
    if (Array.isArray(body.productTypes)) {
      body.productType = body.productTypes.length > 0 ? JSON.stringify(body.productTypes) : null;
      delete body.productTypes;
    }
    const fields = Object.keys(body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => body[k]);
    db.prepare(`UPDATE invest_accounts SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invest/accounts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invest_accounts WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM invest_pnl WHERE accountId = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 盈亏记录
app.get('/api/invest/pnl', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invest_pnl ORDER BY recordedAt DESC, createdAt DESC').all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invest/pnl', (req, res) => {
  try {
    const { id, platformId, accountId, symbol, currency, pnl, recordedAt, note, createdAt } = req.body;
    db.prepare('INSERT INTO invest_pnl (id, platformId, accountId, symbol, currency, pnl, recordedAt, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, platformId, accountId || null, symbol || null, currency, pnl, recordedAt, note || null, createdAt);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/invest/pnl/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = Object.keys(req.body).filter(k => k !== 'id');
    if (fields.length === 0) return res.json({ success: true });
    const setClause = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => req.body[k]);
    db.prepare(`UPDATE invest_pnl SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invest/pnl/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invest_pnl WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 汇率
app.get('/api/invest/rates', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM fx_rates').all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invest/rates', (req, res) => {
  try {
    const { id, from, rate, updatedAt } = req.body;
    db.prepare('INSERT OR REPLACE INTO fx_rates (id, `from`, rate, updatedAt) VALUES (?, ?, ?, ?)')
      .run(id, from, rate, updatedAt);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invest/rates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM fx_rates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== 投资备忘录 ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS invest_memos (
    id TEXT PRIMARY KEY,
    platformId TEXT,
    accountId TEXT,
    title TEXT NOT NULL,
    approxAmount TEXT,
    approxDate TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);

app.get('/api/invest/memos', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invest_memos ORDER BY createdAt DESC').all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/invest/memos', (req, res) => {
  try {
    const { id, platformId, accountId, title, approxAmount, approxDate, note, status, createdAt, updatedAt } = req.body;
    db.prepare('INSERT INTO invest_memos (id, platformId, accountId, title, approxAmount, approxDate, note, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, platformId || null, accountId || null, title, approxAmount || null, approxDate || null, note || null, status || 'pending', createdAt, updatedAt);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/invest/memos/:id', (req, res) => {
  try {
    const fields = ['platformId', 'accountId', 'title', 'approxAmount', 'approxDate', 'note', 'status', 'updatedAt'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.json({ success: true });
    db.prepare(`UPDATE invest_memos SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/invest/memos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM invest_memos WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}`);
  console.log(`数据库文件: ${dbPath}`);
});
