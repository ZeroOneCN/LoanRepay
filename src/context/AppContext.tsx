import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Debt, Asset, IncomeConfig, RepaymentStrategy, Transaction, InvestPlatform, InvestAccount, PnlRecord, FxRate, Currency } from '../types';
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
  getAllPlatforms, addPlatform as dbAddPlatform, updatePlatform as dbUpdatePlatform, deletePlatform as dbDeletePlatform,
  getAllAccounts, addAccount as dbAddAccount, updateAccount as dbUpdateAccount, deleteAccount as dbDeleteAccount,
  getAllPnl, addPnl as dbAddPnl, updatePnl as dbUpdatePnl, deletePnl as dbDeletePnl,
  getAllFxRates, saveFxRate as dbSaveFxRate, deleteFxRate as dbDeleteFxRate,
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
}

interface AppContextType extends AppState {
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  updateDebt: (id: string, debt: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  repayDebt: (id: string, amount: number, interestPortion: number) => Promise<void>;
  recordTransaction: (tx: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
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
  // 投资记账页面显示币种（默认 CNY，持久化到 localStorage）
  const [displayCurrency, setDisplayCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem('displayCurrency');
      return (saved as Currency) || 'CNY';
    } catch { return 'CNY'; }
  });

  const recordTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    const fullTx: Transaction = {
      ...tx,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString()
    };
    setTransactions(prev => [fullTx, ...prev]);
    try {
      await dbAddTransaction(fullTx);
    } catch (e) {
      console.error('Failed to record transaction:', e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();
        const [loadedDebts, loadedAssets, loadedIncome, loadedStrategy, loadedTargetDate, loadedTx, loadedPlatforms, loadedAccounts, loadedPnl, loadedRates] = await Promise.all([
          getAllDebts(),
          getAllAssets(),
          getIncomeConfig(),
          getStrategy(),
          getTargetDate(),
          getAllTransactions(),
          getAllPlatforms(),
          getAllAccounts(),
          getAllPnl(),
          getAllFxRates()
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
    setDebts(prev => [...prev, newDebt]);
    try {
      await dbAddDebt(newDebt);
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
      console.error('Failed to add debt to DB:', e);
    }
  };

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    const oldDebt = debts.find(d => d.id === id);
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    try {
      await dbUpdateDebt(id, updates);
      // 仅当金额变动时记录交易
      if (oldDebt && updates.remainingAmount !== undefined && updates.remainingAmount !== oldDebt.remainingAmount) {
        const diff = updates.remainingAmount - oldDebt.remainingAmount;
        const isRepay = diff < 0;
        const changeAmount = Math.abs(diff);
        // 利息拆分：如果是还款（金额减少），按月利息拆分
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
        // 非金额变动的编辑也记录
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
      console.error('Failed to update debt in DB:', e);
    }
  };

  const deleteDebt = async (id: string) => {
    const debt = debts.find(d => d.id === id);
    setDebts(prev => prev.filter(d => d.id !== id));
    try {
      await dbDeleteDebt(id);
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
      console.error('Failed to delete debt from DB:', e);
    }
  };

  const repayDebt = async (id: string, amount: number, interestPortion: number) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    const principalPortion = amount - interestPortion;
    const newRemaining = debt.remainingAmount - principalPortion;
    setDebts(prev => prev.map(d => d.id === id ? { ...d, remainingAmount: newRemaining } : d));
    try {
      await dbUpdateDebt(id, { remainingAmount: newRemaining });
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
      console.error('Failed to repay debt:', e);
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt'>) => {
    const newAsset: Asset = {
      ...asset,
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setAssets(prev => [...prev, newAsset]);
    try {
      await dbAddAsset(newAsset);
    } catch (e) {
      console.error('Failed to add asset to DB:', e);
    }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    try {
      await dbUpdateAsset(id, updates);
    } catch (e) {
      console.error('Failed to update asset in DB:', e);
    }
  };

  const deleteAsset = async (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    try {
      await dbDeleteAsset(id);
    } catch (e) {
      console.error('Failed to delete asset from DB:', e);
    }
  };

  const updateIncomeConfig = async (config: Partial<IncomeConfig>) => {
    const newConfig = {
      ...incomeConfig,
      ...config,
      updateAt: new Date().toISOString()
    };
    setIncomeConfig(newConfig);
    try {
      await saveIncomeConfig(newConfig);
    } catch (e) {
      console.error('Failed to save income config to DB:', e);
    }
  };

  const setStrategy = async (newStrategy: RepaymentStrategy) => {
    setStrategyState(newStrategy);
    try {
      await saveStrategy(newStrategy);
    } catch (e) {
      console.error('Failed to save strategy to DB:', e);
    }
  };

  const setTargetDate = async (date: string) => {
    setTargetDateState(date);
    try {
      await saveTargetDate(date);
    } catch (e) {
      console.error('Failed to save target date to DB:', e);
    }
  };

  // ==================== 投资记账方法 ====================

  const addPlatform = async (p: Omit<InvestPlatform, 'id' | 'createdAt'>) => {
    const newPlatform: InvestPlatform = {
      ...p,
      id: `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setPlatforms(prev => [newPlatform, ...prev]);
    try { await dbAddPlatform(newPlatform); } catch (e) { console.error('Failed to add platform:', e); }
  };

  const updatePlatform = async (id: string, updates: Partial<InvestPlatform>) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try { await dbUpdatePlatform(id, updates); } catch (e) { console.error('Failed to update platform:', e); }
  };

  const deletePlatform = async (id: string) => {
    setPlatforms(prev => prev.filter(p => p.id !== id));
    setAccounts(prev => prev.filter(a => a.platformId !== id));
    setPnlRecords(prev => prev.filter(r => r.platformId !== id));
    try { await dbDeletePlatform(id); } catch (e) { console.error('Failed to delete platform:', e); }
  };

  const addAccount = async (a: Omit<InvestAccount, 'id' | 'createdAt'>) => {
    const newAccount: InvestAccount = {
      ...a,
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setAccounts(prev => [newAccount, ...prev]);
    try { await dbAddAccount(newAccount); } catch (e) { console.error('Failed to add account:', e); }
  };

  const updateAccount = async (id: string, updates: Partial<InvestAccount>) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    try { await dbUpdateAccount(id, updates); } catch (e) { console.error('Failed to update account:', e); }
  };

  const deleteAccount = async (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setPnlRecords(prev => prev.filter(r => r.accountId !== id));
    try { await dbDeleteAccount(id); } catch (e) { console.error('Failed to delete account:', e); }
  };

  const addPnl = async (p: Omit<PnlRecord, 'id' | 'createdAt'>) => {
    const newPnl: PnlRecord = {
      ...p,
      id: `pnl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setPnlRecords(prev => [newPnl, ...prev]);
    try { await dbAddPnl(newPnl); } catch (e) { console.error('Failed to add pnl:', e); }
  };

  const updatePnl = async (id: string, updates: Partial<PnlRecord>) => {
    setPnlRecords(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    try { await dbUpdatePnl(id, updates); } catch (e) { console.error('Failed to update pnl:', e); }
  };

  const deletePnl = async (id: string) => {
    setPnlRecords(prev => prev.filter(p => p.id !== id));
    try { await dbDeletePnl(id); } catch (e) { console.error('Failed to delete pnl:', e); }
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
    setFxRates(prev => {
      const others = prev.filter(x => x.from !== r.from);
      return [...others, newRate];
    });
    try { await dbSaveFxRate(newRate); } catch (e) { console.error('Failed to save fx rate:', e); }
  };

  const deleteFxRate = async (id: string) => {
    setFxRates(prev => prev.filter(r => r.id !== id));
    try { await dbDeleteFxRate(id); } catch (e) { console.error('Failed to delete fx rate:', e); }
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
      addDebt,
      updateDebt,
      deleteDebt,
      repayDebt,
      recordTransaction,
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
      convertCurrency
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
