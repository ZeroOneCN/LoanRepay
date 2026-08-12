import { Debt, Asset, IncomeConfig, RepaymentStrategy, Transaction, InvestPlatform, InvestAccount, PnlRecord, FxRate } from '../types';

const API_BASE = '/api';

async function fetchApi(url: string, options?: RequestInit): Promise<any> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

// ==================== 债务相关操作 ====================

export async function initDatabase(): Promise<void> {
  // 后端模式不需要初始化，直接返回
}

export async function getAllDebts(): Promise<Debt[]> {
  return fetchApi(`${API_BASE}/debts`);
}

export async function addDebt(debt: Debt): Promise<void> {
  await fetchApi(`${API_BASE}/debts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(debt)
  });
}

export async function updateDebt(id: string, updates: Partial<Debt>): Promise<void> {
  await fetchApi(`${API_BASE}/debts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

export async function deleteDebt(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/debts/${id}`, {
    method: 'DELETE'
  });
}

// ==================== 资产相关操作 ====================

export async function getAllAssets(): Promise<Asset[]> {
  return fetchApi(`${API_BASE}/assets`);
}

export async function addAsset(asset: Asset): Promise<void> {
  await fetchApi(`${API_BASE}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset)
  });
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<void> {
  await fetchApi(`${API_BASE}/assets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/assets/${id}`, {
    method: 'DELETE'
  });
}

// ==================== 配置相关操作 ====================

export async function getConfig(key: string): Promise<string | null> {
  const result = await fetchApi(`${API_BASE}/config/${key}`);
  return result.value;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await fetchApi(`${API_BASE}/config/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
}

export async function getIncomeConfig(): Promise<IncomeConfig | null> {
  const val = await getConfig('income_config');
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export async function saveIncomeConfig(config: IncomeConfig): Promise<void> {
  await setConfig('income_config', JSON.stringify(config));
}

export async function getStrategy(): Promise<RepaymentStrategy> {
  const val = await getConfig('strategy');
  return (val as RepaymentStrategy) || 'avalanche';
}

export async function saveStrategy(strategy: RepaymentStrategy): Promise<void> {
  await setConfig('strategy', strategy);
}

export async function getTargetDate(): Promise<string> {
  const val = await getConfig('target_date');
  return val || '';
}

export async function saveTargetDate(date: string): Promise<void> {
  await setConfig('target_date', date);
}

export async function exportDatabase(): Promise<Uint8Array> {
  throw new Error('Export not supported in API mode');
}

export async function importDatabase(data: Uint8Array): Promise<void> {
  throw new Error('Import not supported in API mode');
}

// ==================== 交易记录相关操作 ====================

export async function getAllTransactions(filters?: { debtId?: string; type?: string }): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (filters?.debtId) params.set('debtId', filters.debtId);
  if (filters?.type) params.set('type', filters.type);
  const query = params.toString() ? `?${params.toString()}` : '';
  const rows = await fetchApi(`${API_BASE}/transactions${query}`);
  return rows.map((r: any) => ({
    id: r.id,
    debt_id: r.debt_id,
    debt_name: r.debt_name,
    type: r.type,
    amount: r.amount,
    interest_portion: r.interest_portion,
    principal_portion: r.principal_portion,
    remaining_after: r.remaining_after,
    interest_rate: r.interest_rate ?? undefined,
    created_at: r.created_at,
    note: r.note ?? undefined,
  }));
}

export async function addTransaction(transaction: Transaction): Promise<void> {
  await fetchApi(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transaction)
  });
}

export async function deleteTransaction(id: string): Promise<any> {
  return fetchApi(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE'
  });
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  await fetchApi(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

// ==================== 投资记账相关操作 ====================

export async function getAllPlatforms(): Promise<InvestPlatform[]> {
  return fetchApi(`${API_BASE}/invest/platforms`);
}

export async function addPlatform(p: InvestPlatform): Promise<void> {
  await fetchApi(`${API_BASE}/invest/platforms`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
  });
}

export async function updatePlatform(id: string, updates: Partial<InvestPlatform>): Promise<void> {
  await fetchApi(`${API_BASE}/invest/platforms/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
  });
}

export async function deletePlatform(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/invest/platforms/${id}`, { method: 'DELETE' });
}

export async function getAllAccounts(): Promise<InvestAccount[]> {
  return fetchApi(`${API_BASE}/invest/accounts`);
}

export async function addAccount(a: InvestAccount): Promise<void> {
  await fetchApi(`${API_BASE}/invest/accounts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a)
  });
}

export async function updateAccount(id: string, updates: Partial<InvestAccount>): Promise<void> {
  await fetchApi(`${API_BASE}/invest/accounts/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
  });
}

export async function deleteAccount(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/invest/accounts/${id}`, { method: 'DELETE' });
}

export async function getAllPnl(): Promise<PnlRecord[]> {
  return fetchApi(`${API_BASE}/invest/pnl`);
}

export async function addPnl(p: PnlRecord): Promise<void> {
  await fetchApi(`${API_BASE}/invest/pnl`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
  });
}

export async function updatePnl(id: string, updates: Partial<PnlRecord>): Promise<void> {
  await fetchApi(`${API_BASE}/invest/pnl/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
  });
}

export async function deletePnl(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/invest/pnl/${id}`, { method: 'DELETE' });
}

export async function getAllFxRates(): Promise<FxRate[]> {
  return fetchApi(`${API_BASE}/invest/rates`);
}

export async function saveFxRate(r: FxRate): Promise<void> {
  await fetchApi(`${API_BASE}/invest/rates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r)
  });
}

export async function deleteFxRate(id: string): Promise<void> {
  await fetchApi(`${API_BASE}/invest/rates/${id}`, { method: 'DELETE' });
}
