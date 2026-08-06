import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Debt, Asset, IncomeConfig, RepaymentStrategy, Transaction } from '../types';
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
        const [loadedDebts, loadedAssets, loadedIncome, loadedStrategy, loadedTargetDate, loadedTx] = await Promise.all([
          getAllDebts(),
          getAllAssets(),
          getIncomeConfig(),
          getStrategy(),
          getTargetDate(),
          getAllTransactions()
        ]);
        setDebts(loadedDebts);
        setAssets(loadedAssets);
        setIncomeConfig(loadedIncome || defaultIncomeConfig);
        setStrategyState(loadedStrategy);
        setTargetDateState(loadedTargetDate);
        setTransactions(loadedTx);
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
      netWorth
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
