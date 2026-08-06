import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Debt, Asset, IncomeConfig, RepaymentStrategy } from '../types';
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
  saveTargetDate
} from '../services/database';

interface AppState {
  debts: Debt[];
  assets: Asset[];
  incomeConfig: IncomeConfig;
  strategy: RepaymentStrategy;
  targetDate: string;
  dbReady: boolean;
}

interface AppContextType extends AppState {
  addDebt: (debt: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>;
  updateDebt: (id: string, debt: Partial<Debt>) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
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
  const [incomeConfig, setIncomeConfig] = useState<IncomeConfig>(defaultIncomeConfig);
  const [strategy, setStrategyState] = useState<RepaymentStrategy>('avalanche');
  const [targetDate, setTargetDateState] = useState<string>('');
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();
        const [loadedDebts, loadedAssets, loadedIncome, loadedStrategy, loadedTargetDate] = await Promise.all([
          getAllDebts(),
          getAllAssets(),
          getIncomeConfig(),
          getStrategy(),
          getTargetDate()
        ]);
        setDebts(loadedDebts);
        setAssets(loadedAssets);
        setIncomeConfig(loadedIncome || defaultIncomeConfig);
        setStrategyState(loadedStrategy);
        setTargetDateState(loadedTargetDate);
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
    } catch (e) {
      console.error('Failed to add debt to DB:', e);
    }
  };

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    try {
      await dbUpdateDebt(id, updates);
    } catch (e) {
      console.error('Failed to update debt in DB:', e);
    }
  };

  const deleteDebt = async (id: string) => {
    setDebts(prev => prev.filter(d => d.id !== id));
    try {
      await dbDeleteDebt(id);
    } catch (e) {
      console.error('Failed to delete debt from DB:', e);
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
      incomeConfig,
      strategy,
      targetDate,
      dbReady,
      addDebt,
      updateDebt,
      deleteDebt,
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
