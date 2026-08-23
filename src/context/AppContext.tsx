import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Debt, Asset, IncomeConfig, RepaymentStrategy, Transaction, InvestPlatform, InvestAccount, PnlRecord, FxRate, Currency, InvestMemo } from '../types';
import {
  initDatabase,
  getAllDebts,
  addDebt as dbAddDebt,
  updateDebt as dbUpdateDebt,
  deleteDebt as dbDeleteDebt,
  getAllAssets,
  addAsset as dbAddAsset,
  updateAsset as dbUpdateAsset,
  deleteAsset as dbDeleteAsset,
  getIncomeConfig,
  saveIncomeConfig,
  getStrategy,
  saveStrategy,
  getTargetDate,
  saveTargetDate,
  getAllTransactions,
  addTransaction as dbAddTransaction,
  updateTransaction as dbUpdateTransaction,
  deleteTransaction as dbDeleteTransaction,
  getAllPlatforms, addPlatform as dbAddPlatform, updatePlatform as dbUpdatePlatform, deletePlatform as dbDeletePlatform,
  getAllAccounts, addAccount as dbAddAccount, updateAccount as dbUpdateAccount, deleteAccount as dbDeleteAccount,
  getAllPnl, addPnl as dbAddPnl, updatePnl as dbUpdatePnl, deletePnl as dbDeletePnl,
  getAllFxRates, saveFxRate as dbSaveFxRate, deleteFxRate as dbDeleteFxRate,
  getAllMemos, addMemo as dbAddMemo, updateMemo as dbUpdateMemo, deleteMemo as dbDeleteMemo,
} from '../services/database';
import { calculateMonthlyInterest } from '../utils/repaymentEngine';

interface AppState {
  debts: Debt[];
  assets: Asset[];
  transactions: Transaction[];
  incomeConfig: IncomeConfig;
  strategy: RepaymentStrategy;
  targetDate: string;
  dbReady: boolean;
  platforms: InvestPlatform[];
  accounts: InvestAccount[];
  pnlRecords: PnlRecord[];
  fxRates: FxRate[];
  displayCurrency: Currency;
  memos: InvestMemo[];
}

interface AppContextType extends AppState {
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  updateDebt: (id: string, debt: Partial<Debt>, options?: { recordTx?: boolean }) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  repayDebt: (id: string, amount: number, interestPortion: number) => Promise<void>;
  recordTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  addAsset: (asset: Omit<Asset, 'id' | 'createdAt'>) => Promise<void>;
  updateAsset: (id: string, asset: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  updateIncomeConfig: (config: Partial<IncomeConfig>) => Promise<void>;
  setStrategy: (strategy: RepaymentStrategy) => Promise<void>;
  setTargetDate: (date: string) => Promise<void>;
  totalDebt: number;
  totalAsset: number;
  netWorth: number;
  // 投资记账
  addPlatform: (p: Omit<InvestPlatform, 'id' | 'createdAt'>) => Promise<void>;
  updatePlatform: (id: string, updates: Partial<InvestPlatform>) => Promise<void>;
  deletePlatform: (id: string) => Promise<void>;
  addAccount: (a: Omit<InvestAccount, 'id' | 'createdAt'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<InvestAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addPnl: (p: Omit<PnlRecord, 'id' | 'createdAt'>) => Promise<void>;
  updatePnl: (id: string, updates: Partial<PnlRecord>) => Promise<void>;
  deletePnl: (id: string) => Promise<void>;
  saveFxRate: (r: Omit<FxRate, 'id' | 'updatedAt'> & { id?: string }) => Promise<void>;
  deleteFxRate: (id: string) => Promise<void>;
  setDisplayCurrency: (cur: Currency) => void;
  convertToCNY: (amount: number, from: FxRate['from']) => number;
  convertCurrency: (amount: number, from: Currency, to: Currency) => number;
  addMemo: (m: Omit<InvestMemo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateMemo: (id: string, updates: Partial<InvestMemo>) => Promise<void>;
  deleteMemo: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultIncomeConfig: IncomeConfig = {
  monthlyIncome: 10000,
  monthlyExpense: 5000,
  availableForRepayment: 5000,
  updateAt: new Date().toISOString()
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeConfig, setIncomeConfig] = useState<IncomeConfig>(defaultIncomeConfig);
  const [strategy, setStrategyState] = useState<RepaymentStrategy>('avalanche');
  const [targetDate, setTargetDateState] = useState<string>('');
  const [dbReady, setDbReady] = useState(false);
  const [platforms, setPlatforms] = useState<InvestPlatform[]>([]);
  const [pnlRecords, setPnlRecords] = useState<PnlRecord[]>([]);
  const [accounts, setAccounts] = useState<InvestAccount[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [memos, setMemos] = useState<InvestMemo[]>([]);
  // 投资记账页面显示币种（默认 CNY，持久化到 localStorage）
  const [displayCurrency, setDisplayCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem('displayCurrency');
      return (saved as Currency) || 'CNY';
    } catch { return 'CNY'; }
  });

  // 统一错误提示：后端未启动或写入失败时抛出带友好信息的错误
  const wrapErr = (e: any, action: string) => {
    const msg = e?.message || String(e);
    // fetch failed（后端没起）的特征
    if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
      return new Error(`后端服务未启动或无法连接，${action}失败。请先启动后端服务（npm run server）后重试。`);
    }
    return new Error(`${action}失败：${msg}`);
  };

  const recordTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    const fullTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    // 先写库，成功后再更新 state；失败抛错让调用方感知
    try {
      await dbAddTransaction(fullTx);
    } catch (e) {
      throw wrapErr(e, '记录交易');
    }
    setTransactions(prev => [fullTx, ...prev]);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();
        const [loadedDebts, loadedAssets, loadedIncome, loadedStrategy, loadedTargetDate, loadedTx, loadedPlatforms, loadedAccounts, loadedPnl, loadedRates, loadedMemos] = await Promise.all([
          getAllDebts(),
          getAllAssets(),
          getIncomeConfig(),
          getStrategy(),
          getTargetDate(),
          getAllTransactions(),
          getAllPlatforms(),
          getAllAccounts(),
          getAllPnl(),
          getAllFxRates(),
          getAllMemos()
        ]);
        setDebts(loadedDebts);
        setAssets(loadedAssets);
        setIncomeConfig(loadedIncome || defaultIncomeConfig);
        setStrategyState(loadedStrategy);
        setTargetDateState(loadedTargetDate);
        setTransactions(loadedTx);
        setPlatforms(loadedPlatforms);
        setAccounts(loadedAccounts);
        setPnlRecords(loadedPnl);
        setFxRates(loadedRates);
        setMemos(loadedMemos);
        setDbReady(true);
      } catch (e) {
        console.error('Failed to load data from SQLite:', e);
        setDbReady(true);
      }
    };
    loadData();
  }, []);

  const addDebt = async (debt: Omit<Debt, 'id' | 'createdAt'>) => {
    const newDebt: Debt = {
      ...debt,
      id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    // 先写库，成功后再更新 state
    try {
      await dbAddDebt(newDebt);
    } catch (e) {
      throw wrapErr(e, '添加债务');
    }
    setDebts(prev => [...prev, newDebt]);
    // 交易记录是辅助记录，失败只打日志不阻断主流程
    try {
      await recordTransaction({
        debt_id: newDebt.id,
        debt_name: newDebt.name,
        type: 'create',
        amount: newDebt.remainingAmount,
        interest_portion: 0,
        principal_portion: 0,
        remaining_after: newDebt.remainingAmount,
        interest_rate: newDebt.interestRate,
        note: '新增债务'
      });
    } catch (e) {
      console.error('Failed to record transaction (non-blocking):', e);
    }
  };

  const updateDebt = async (id: string, updates: Partial<Debt>, options?: { recordTx?: boolean }) => {
    const { recordTx = true } = options || {};
    const oldDebt = debts.find(d => d.id === id);
    try {
      await dbUpdateDebt(id, updates);
    } catch (e) {
      throw wrapErr(e, '更新债务');
    }
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    if (!recordTx) return;
    // 交易记录辅助，失败不阻断
    try {
      if (oldDebt && updates.remainingAmount !== undefined && updates.remainingAmount !== oldDebt.remainingAmount) {
        const diff = updates.remainingAmount - oldDebt.remainingAmount;
        const isRepay = diff < 0;
        const changeAmount = Math.abs(diff);
        let interestPortion = 0;
        let principalPortion = changeAmount;
        if (isRepay && oldDebt.interestRate) {
          const monthlyInterest = calculateMonthlyInterest(oldDebt.remainingAmount, oldDebt.interestRate);
          interestPortion = Math.min(changeAmount, monthlyInterest);
          principalPortion = changeAmount - interestPortion;
        }
        await recordTransaction({
          debt_id: id,
          debt_name: updates.name || oldDebt.name,
          type: isRepay ? 'repay' : 'adjust',
          amount: changeAmount,
          interest_portion: interestPortion,
          principal_portion: principalPortion,
          remaining_after: updates.remainingAmount,
          interest_rate: updates.interestRate ?? oldDebt.interestRate,
          note: isRepay ? '还款扣减' : '手动调整'
        });
      } else if (oldDebt && (updates.interestRate !== undefined || updates.creditLimit !== undefined || updates.name !== undefined)) {
        await recordTransaction({
          debt_id: id,
          debt_name: updates.name || oldDebt.name,
          type: 'adjust',
          amount: 0,
          interest_portion: 0,
          principal_portion: 0,
          remaining_after: updates.remainingAmount ?? oldDebt.remainingAmount,
          interest_rate: updates.interestRate ?? oldDebt.interestRate,
          note: '编辑债务信息'
        });
      }
    } catch (e) {
      console.error('Failed to record transaction (non-blocking):', e);
    }
  };

  const deleteDebt = async (id: string) => {
    const debt = debts.find(d => d.id === id);
    try {
      await dbDeleteDebt(id);
    } catch (e) {
      throw wrapErr(e, '删除债务');
    }
    setDebts(prev => prev.filter(d => d.id !== id));
    try {
      if (debt) {
        await recordTransaction({
          debt_id: id,
          debt_name: debt.name,
          type: 'delete',
          amount: debt.remainingAmount,
          interest_portion: 0,
          principal_portion: debt.remainingAmount,
          remaining_after: 0,
          interest_rate: debt.interestRate,
          note: '删除债务'
        });
      }
    } catch (e) {
      console.error('Failed to record transaction (non-blocking):', e);
    }
  };

  const repayDebt = async (id: string, amount: number, interestPortion: number) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    const principalPortion = amount - interestPortion;
    const newRemaining = debt.remainingAmount - principalPortion;
    try {
      await dbUpdateDebt(id, { remainingAmount: newRemaining });
    } catch (e) {
      throw wrapErr(e, '还款');
    }
    setDebts(prev => prev.map(d => d.id === id ? { ...d, remainingAmount: newRemaining } : d));
    try {
      await recordTransaction({
        debt_id: id,
        debt_name: debt.name,
        type: 'repay',
        amount,
        interest_portion: interestPortion,
        principal_portion: principalPortion,
        remaining_after: newRemaining,
        interest_rate: debt.interestRate,
        note: `还款（利息¥${interestPortion.toFixed(2)} + 本金¥${principalPortion.toFixed(2)}）`
      });
    } catch (e) {
      console.error('Failed to record transaction (non-blocking):', e);
    }
  };

  const deleteTransaction = async (id: string) => {
    // 先取出本地 state 里的记录（用于回滚），再调服务端删除
    const txToDelete = transactions.find(t => t.id === id);
    try {
      await dbDeleteTransaction(id);
    } catch (e) { throw wrapErr(e, '删除交易记录'); }
    setTransactions(prev => prev.filter(t => t.id !== id));
    // 使用本地 state 数据（而非服务端返回的 tx）更新 debts 状态，更可靠
    if (txToDelete && txToDelete.type === 'repay' && txToDelete.debt_id && typeof txToDelete.principal_portion === 'number') {
      setDebts(prev => prev.map(d => d.id === txToDelete.debt_id ? { ...d, remainingAmount: d.remainingAmount + txToDelete.principal_portion } : d));
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const oldTx = transactions.find(t => t.id === id);
    try { await dbUpdateTransaction(id, updates); } catch (e) { throw wrapErr(e, '更新交易记录'); }
    const newTx: Transaction = { ...(oldTx as Transaction), ...updates };
    setTransactions(prev => prev.map(t => t.id === id ? newTx : t));
    // 仅 type=repay：若 amount/principal/interest 变化，重算 debt.remainingAmount
    // 简化处理：根据 oldTx.principal_portion 和 newTx.principal_portion 的差额，调整 remainingAmount
    if (oldTx && newTx && newTx.type === 'repay' && newTx.debt_id
        && typeof oldTx.principal_portion === 'number'
        && typeof newTx.principal_portion === 'number') {
      const diff = newTx.principal_portion - oldTx.principal_portion; // diff>0 表示多还了，remaining 再减一点
      if (diff !== 0) {
        setDebts(prev => prev.map(d => d.id === newTx.debt_id ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - diff) } : d));
        // 同步写库（保证刷新后也生效）
        try {
          const curDebt = debts.find(d => d.id === newTx.debt_id);
          if (curDebt) {
            const newRemaining = Math.max(0, curDebt.remainingAmount - diff);
            await dbUpdateDebt(curDebt.id, { remainingAmount: newRemaining });
          }
        } catch (e) {
          console.warn('更新债务剩余金额失败，建议在债务管理中手动编辑：', e);
        }
      }
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt'>) => {
    const newAsset: Asset = {
      ...asset,
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    try { await dbAddAsset(newAsset); } catch (e) { throw wrapErr(e, '添加资产'); }
    setAssets(prev => [...prev, newAsset]);
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    try { await dbUpdateAsset(id, updates); } catch (e) { throw wrapErr(e, '更新资产'); }
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAsset = async (id: string) => {
    try { await dbDeleteAsset(id); } catch (e) { throw wrapErr(e, '删除资产'); }
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const updateIncomeConfig = async (config: Partial<IncomeConfig>) => {
    const newConfig = {
      ...incomeConfig,
      ...config,
      updateAt: new Date().toISOString()
    };
    try { await saveIncomeConfig(newConfig); } catch (e) { throw wrapErr(e, '保存收支配置'); }
    setIncomeConfig(newConfig);
  };

  const setStrategy = async (newStrategy: RepaymentStrategy) => {
    try { await saveStrategy(newStrategy); } catch (e) { throw wrapErr(e, '保存策略'); }
    setStrategyState(newStrategy);
  };

  const setTargetDate = async (date: string) => {
    try { await saveTargetDate(date); } catch (e) { throw wrapErr(e, '保存目标日期'); }
    setTargetDateState(date);
  };

  // ==================== 投资记账方法 ====================
  // 原则：先 await 写库成功，再 setState；失败抛错让调用方感知并提示

  const addPlatform = async (p: Omit<InvestPlatform, 'id' | 'createdAt'>) => {
    const newPlatform: InvestPlatform = {
      ...p,
      id: `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    try { await dbAddPlatform(newPlatform); } catch (e) { throw wrapErr(e, '添加平台'); }
    setPlatforms(prev => [newPlatform, ...prev]);
  };

  const updatePlatform = async (id: string, updates: Partial<InvestPlatform>) => {
    try { await dbUpdatePlatform(id, updates); } catch (e) { throw wrapErr(e, '更新平台'); }
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePlatform = async (id: string) => {
    try { await dbDeletePlatform(id); } catch (e) { throw wrapErr(e, '删除平台'); }
    // 后端已级联删除账户和盈亏，前端同步更新
    setPlatforms(prev => prev.filter(p => p.id !== id));
    setAccounts(prev => prev.filter(a => a.platformId !== id));
    setPnlRecords(prev => prev.filter(r => r.platformId !== id));
  };

  const addAccount = async (a: Omit<InvestAccount, 'id' | 'createdAt'>) => {
    const newAccount: InvestAccount = {
      ...a,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    try { await dbAddAccount(newAccount); } catch (e) { throw wrapErr(e, '添加账户'); }
    setAccounts(prev => [newAccount, ...prev]);
  };

  const updateAccount = async (id: string, updates: Partial<InvestAccount>) => {
    try { await dbUpdateAccount(id, updates); } catch (e) { throw wrapErr(e, '更新账户'); }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAccount = async (id: string) => {
    try { await dbDeleteAccount(id); } catch (e) { throw wrapErr(e, '删除账户'); }
    setAccounts(prev => prev.filter(a => a.id !== id));
    setPnlRecords(prev => prev.filter(r => r.accountId !== id));
  };

  const addPnl = async (p: Omit<PnlRecord, 'id' | 'createdAt'>) => {
    const newPnl: PnlRecord = {
      ...p,
      id: `pnl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    try { await dbAddPnl(newPnl); } catch (e) { throw wrapErr(e, '添加盈亏记录'); }
    setPnlRecords(prev => [newPnl, ...prev]);
  };

  const updatePnl = async (id: string, updates: Partial<PnlRecord>) => {
    try { await dbUpdatePnl(id, updates); } catch (e) { throw wrapErr(e, '更新盈亏记录'); }
    setPnlRecords(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePnl = async (id: string) => {
    try { await dbDeletePnl(id); } catch (e) { throw wrapErr(e, '删除盈亏记录'); }
    setPnlRecords(prev => prev.filter(p => p.id !== id));
  };

  const saveFxRate = async (r: Omit<FxRate, 'id' | 'updatedAt'> & { id?: string }) => {
    const existing = fxRates.find(x => x.from === r.from);
    const id = r.id || existing?.id || `fx_${r.from}`;
    const newRate: FxRate = {
      id,
      from: r.from,
      rate: r.rate,
      updatedAt: new Date().toISOString()
    };
    try { await dbSaveFxRate(newRate); } catch (e) { throw wrapErr(e, '保存汇率'); }
    setFxRates(prev => {
      const others = prev.filter(x => x.from !== r.from);
      return [...others, newRate];
    });
  };

  const deleteFxRate = async (id: string) => {
    try { await dbDeleteFxRate(id); } catch (e) { throw wrapErr(e, '删除汇率'); }
    setFxRates(prev => prev.filter(r => r.id !== id));
  };

  // ==================== 投资备忘录方法 ====================

  const addMemo = async (m: Omit<InvestMemo, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newMemo: InvestMemo = {
      ...m,
      id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    try { await dbAddMemo(newMemo); } catch (e) { throw wrapErr(e, '添加备忘录'); }
    setMemos(prev => [newMemo, ...prev]);
  };

  const updateMemo = async (id: string, updates: Partial<InvestMemo>) => {
    try { await dbUpdateMemo(id, { ...updates, updatedAt: new Date().toISOString() }); } catch (e) { throw wrapErr(e, '更新备忘录'); }
    setMemos(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
  };

  const deleteMemo = async (id: string) => {
    try { await dbDeleteMemo(id); } catch (e) { throw wrapErr(e, '删除备忘录'); }
    setMemos(prev => prev.filter(m => m.id !== id));
  };

  const setDisplayCurrency = (cur: Currency) => {
    setDisplayCurrencyState(cur);
    try { localStorage.setItem('displayCurrency', cur); } catch {}
  };

  const convertToCNY = (amount: number, from: FxRate['from']): number => {
    if (from === 'CNY') return amount;
    const rate = fxRates.find(r => r.from === from)?.rate;
    if (!rate) return amount; // 无汇率则返回原值，由调用方提示
    return amount * rate;
  };

  // 任意币种间转换：先统一转 CNY，再除以目标币种汇率
  const convertCurrency = (amount: number, from: Currency, to: Currency): number => {
    if (from === to) return amount;
    const inCNY = convertToCNY(amount, from); // to CNY
    if (to === 'CNY') return inCNY;
    const toRate = fxRates.find(r => r.from === to)?.rate;
    if (!toRate || toRate <= 0) return inCNY; // 目标币种无汇率，返回 CNY 口径
    return inCNY / toRate;
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalAsset = assets.reduce((sum, a) => sum + a.amount, 0);
  const netWorth = totalAsset - totalDebt;

  return (
    <AppContext.Provider value={{
      debts,
      assets,
      transactions,
      incomeConfig,
      strategy,
      targetDate,
      dbReady,
      platforms,
      accounts,
      pnlRecords,
      fxRates,
      displayCurrency,
      memos,
      addDebt,
      updateDebt,
      deleteDebt,
      repayDebt,
      recordTransaction,
      deleteTransaction,
      updateTransaction,
      addAsset,
      updateAsset,
      deleteAsset,
      updateIncomeConfig,
      setStrategy,
      setTargetDate,
      totalDebt,
      totalAsset,
      netWorth,
      addPlatform,
      updatePlatform,
      deletePlatform,
      addAccount,
      updateAccount,
      deleteAccount,
      addPnl,
      updatePnl,
      deletePnl,
      saveFxRate,
      deleteFxRate,
      setDisplayCurrency,
      convertToCNY,
      convertCurrency,
      addMemo,
      updateMemo,
      deleteMemo,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
