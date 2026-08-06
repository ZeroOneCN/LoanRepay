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

// ==================== 投资记账 ====================

export type InvestMarket = 'crypto' | 'us_stock' | 'hk_stock' | 'a_stock' | 'other';

export const INVEST_MARKET_LABELS: Record<InvestMarket, string> = {
  crypto: '加密货币',
  us_stock: '美股',
  hk_stock: '港股',
  a_stock: 'A股',
  other: '其他',
};

export type Currency = 'CNY' | 'USD' | 'HKD' | 'USDT';

export const CURRENCY_LABELS: Record<Currency, string> = {
  CNY: '人民币 CNY',
  USD: '美元 USD',
  HKD: '港币 HKD',
  USDT: '泰达币 USDT',
};

/** 加密平台的产品类型（合约/现货） */
export type ProductType = 'spot' | 'futures';

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  spot: '现货',
  futures: '合约',
};

/** 投资平台 */
export interface InvestPlatform {
  id: string;
  name: string;
  market: InvestMarket;
  currency: Currency;    // 平台默认币种（账户会继承或覆盖）
  createdAt: string;
  note?: string;
}

/** 平台下的子账户（如币安的现货账户、合约账户，或不同券商账户） */
export interface InvestAccount {
  id: string;
  platformId: string;
  name: string;
  currency: Currency;            // 账户记账币种（默认继承平台）
  productTypes?: ProductType[];   // 仅 crypto 平台用：可同时选现货/合约
  note?: string;
  createdAt: string;
}

/** 盈亏快照记录：某账户的累计历史总盈亏（品种可空） */
export interface PnlRecord {
  id: string;
  platformId: string;           // 冗余：方便按平台聚合
  accountId: string;             // 关联账户
  symbol?: string;               // 品种/标的，可选（如 BTC、AAPL、00700），账户级记录可以不填
  currency: Currency;            // 记录币种（默认继承账户）
  pnl: number;                   // 累计盈亏金额（负数为亏损）
  recordedAt: string;            // 记录时间（用户填写的快照时间点）
  note?: string;
  createdAt: string;             // 系统创建时间
}

/** 全局汇率：target 固定为 CNY */
export interface FxRate {
  id: string;
  from: Currency;          // 源币种（非 CNY）
  rate: number;            // 1 单位源币种 = rate CNY
  updatedAt: string;
}
