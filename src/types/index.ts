export interface Debt {
  id: string;
  name: string;
  type: string;
  remainingAmount: number;
  creditLimit?: number;
  interestRate?: number;
  dueDate: number;
  lastDueDate?: number;
  repaymentType: RepaymentType;
  maturityDate?: string;
  createdAt: string;
  note?: string;
}

export type RepaymentType = 'revolving' | 'interest_only' | 'flexible';

export const REPAYMENT_TYPE_LABELS: Record<RepaymentType, string> = {
  revolving: '循环贷',
  interest_only: '先息后本',
  flexible: '灵活模式'
};

export const DEFAULT_DEBT_TYPES: string[] = [
  '信用卡',
  '网贷',
  '贷款'
];

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  amount: number;
  liquidity: LiquidityLevel;
  createdAt: string;
  note?: string;
}

export type AssetType = 'cash' | 'bank' | 'investment' | 'fund' | 'stock' | 'other';
export type LiquidityLevel = 'high' | 'medium' | 'low';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: '现金',
  bank: '银行存款',
  investment: '理财',
  fund: '基金',
  stock: '股票',
  other: '其他'
};

export const LIQUIDITY_LABELS: Record<LiquidityLevel, string> = {
  high: '高流动性（随取随用）',
  medium: '中流动性（T+1~T+7）',
  low: '低流动性（定期/长期）'
};

export interface IncomeConfig {
  monthlyIncome: number;
  monthlyExpense: number;
  availableForRepayment: number;
  extraIncome?: number;
  updateAt: string;
}

export interface RepaymentTarget {
  targetDate: string;
  targetStrategy: RepaymentStrategy;
}

export type RepaymentStrategy = 'avalanche' | 'snowball' | 'minimum' | 'custom';

export const STRATEGY_LABELS: Record<RepaymentStrategy, string> = {
  avalanche: '雪崩法（优先高利率）',
  snowball: '雪球法（优先小额债务）',
  minimum: '最低还款法',
  custom: '自定义'
};

export interface MonthlyRepayment {
  month: number;
  date: string;
  totalPayment: number;
  totalInterest: number;
  totalPrincipal: number;
  debts: DebtMonthlyDetail[];
  remainingTotal: number;
}

export interface DebtMonthlyDetail {
  debtId: string;
  debtName: string;
  payment: number;
  interest: number;
  principal: number;
  remaining: number;
}

export interface RepaymentPlan {
  months: MonthlyRepayment[];
  totalInterest: number;
  totalPayment: number;
  totalMonths: number;
  payoffDate: string;
  strategy: RepaymentStrategy;
  startDate: string;
}

export interface RestructureOption {
  id: string;
  name: string;
  description: string;
  type: RestructureType;
  sourceDebtIds: string[];
  newDebt: Partial<Debt>;
  saving: number;
  newTotalInterest: number;
  originalTotalInterest: number;
  risk: 'low' | 'medium' | 'high';
}

export type RestructureType = 'balance_transfer' | 'debt_consolidation' | 'borrow_new' | 'minimum_roll';

export const RESTRUCTURE_TYPE_LABELS: Record<RestructureType, string> = {
  balance_transfer: '余额转移',
  debt_consolidation: '债务整合',
  borrow_new: '借新还旧',
  minimum_roll: '最低还款滚动'
};

// ==================== 交易记录 ====================

export type TransactionType = 'create' | 'repay' | 'adjust' | 'delete' | 'interest';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  create: '新增债务',
  repay: '还款',
  adjust: '编辑调整',
  delete: '删除债务',
  interest: '利息录入'
};

export interface Transaction {
  id: string;
  debt_id: string;
  debt_name: string;
  type: TransactionType;
  amount: number;
  interest_portion: number;
  principal_portion: number;
  remaining_after: number;
  interest_rate?: number;
  created_at: string;
  note?: string;
}
