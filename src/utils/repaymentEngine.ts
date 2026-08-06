import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Debt, MonthlyRepayment, DebtMonthlyDetail, RepaymentPlan, RepaymentStrategy } from '../types';

/**
 * 计算月度利息
 * @param remainingAmount 剩余本金
 * @param annualRate 年利率（百分比，如 18 表示 18%），可选
 * @returns 月度利息
 */
export function calculateMonthlyInterest(remainingAmount: number, annualRate?: number): number {
  if (!annualRate || annualRate <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  return remainingAmount * monthlyRate;
}

/**
 * 计算最低还款额（根据还款方式）
 * @param debt 债务数据
 * @returns 最低还款额
 */
export function calculateMinPayment(debt: Debt): number {
  if (debt.repaymentType === 'flexible') {
    return 0;
  }
  if (debt.repaymentType === 'interest_only') {
    return calculateMonthlyInterest(debt.remainingAmount, debt.interestRate);
  }
  return Math.max(debt.remainingAmount * 0.05, 100);
}

/**
 * 生成还款计划
 * @param debts 债务列表
 * @param monthlyAvailable 每月可用于还款的金额
 * @param strategy 还款策略
 * @param startDate 开始日期
 * @param maxMonths 最大计算月数
 * @returns 还款计划
 */
export function generateRepaymentPlan(
  debts: Debt[],
  monthlyAvailable: number,
  strategy: RepaymentStrategy,
  startDate: string = dayjs().format('YYYY-MM-DD'),
  maxMonths: number = 360
): RepaymentPlan {
  if (debts.length === 0 || monthlyAvailable <= 0) {
    return {
      months: [],
      totalInterest: 0,
      totalPayment: 0,
      totalMonths: 0,
      payoffDate: startDate,
      strategy,
      startDate
    };
  }

  const workingDebts: Debt[] = debts.map(d => ({ ...d }));
  const months: MonthlyRepayment[] = [];
  let totalInterest = 0;
  let totalPayment = 0;
  let currentDate = dayjs(startDate);

  for (let month = 1; month <= maxMonths; month++) {
    const allPaid = workingDebts.every(d => d.remainingAmount <= 0.01);
    if (allPaid) break;

    let remainingBudget = monthlyAvailable;
    const debtDetails: DebtMonthlyDetail[] = [];
    let monthInterest = 0;
    let monthPrincipal = 0;

    const sortedDebts = sortDebtsByStrategy([...workingDebts], strategy);

    for (const debt of sortedDebts) {
      if (debt.remainingAmount <= 0.01) {
        debtDetails.push({
          debtId: debt.id,
          debtName: debt.name,
          payment: 0,
          interest: 0,
          principal: 0,
          remaining: 0
        });
        continue;
      }

      const interest = calculateMonthlyInterest(debt.remainingAmount, debt.interestRate);
      const minPay = calculateMinPayment(debt);
      
      let payment: number;
      if (remainingBudget >= minPay) {
        payment = Math.min(minPay + remainingBudget - minPay, debt.remainingAmount + interest);
      } else {
        payment = remainingBudget;
      }
      payment = Math.min(payment, debt.remainingAmount + interest);

      const principalPaid = Math.max(0, payment - interest);
      const newRemaining = Math.max(0, debt.remainingAmount - principalPaid);

      debtDetails.push({
        debtId: debt.id,
        debtName: debt.name,
        payment,
        interest,
        principal: principalPaid,
        remaining: newRemaining
      });

      const originalDebt = workingDebts.find(d => d.id === debt.id);
      if (originalDebt) {
        originalDebt.remainingAmount = newRemaining;
      }

      remainingBudget -= payment;
      monthInterest += interest;
      monthPrincipal += principalPaid;

      if (remainingBudget <= 0) break;
    }

    const totalMonthPayment = monthInterest + monthPrincipal;
    const remainingTotal = workingDebts.reduce((sum, d) => sum + Math.max(0, d.remainingAmount), 0);

    months.push({
      month,
      date: currentDate.format('YYYY-MM-DD'),
      totalPayment: totalMonthPayment,
      totalInterest: monthInterest,
      totalPrincipal: monthPrincipal,
      debts: debtDetails,
      remainingTotal
    });

    totalInterest += monthInterest;
    totalPayment += totalMonthPayment;
    currentDate = currentDate.add(1, 'month');
  }

  return {
    months,
    totalInterest,
    totalPayment,
    totalMonths: months.length,
    payoffDate: months.length > 0 ? months[months.length - 1].date : startDate,
    strategy,
    startDate
  };
}

/**
 * 按策略对债务进行排序
 * @param debts 债务列表
 * @param strategy 还款策略
 * @returns 排序后的债务列表
 */
function sortDebtsByStrategy(debts: Debt[], strategy: RepaymentStrategy): Debt[] {
  switch (strategy) {
    case 'avalanche':
      return debts.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
    case 'snowball':
      return debts.sort((a, b) => a.remainingAmount - b.remainingAmount);
    case 'minimum':
    case 'custom':
    default:
      return debts;
  }
}

/**
 * 模拟最低还款滚动策略（借新还旧）
 * 计算只还最低还款额，优先使用现有可用额度倒卡，额度不足时新增借款的情况
 * @param debts 现有债务
 * @param monthlyAvailable 每月可支配金额
 * @param newBorrowRate 新借款利率
 * @param months 模拟月数
 */
export function simulateMinimumRoll(
  debts: Debt[],
  monthlyAvailable: number,
  newBorrowRate: number,
  months: number = 12
): {
  totalDebtGrowth: number;
  newBorrowTotal: number;
  totalInterestPaid: number;
  finalTotalDebt: number;
  totalAvailableCreditUsed: number;
  maxUsageRate: number;
  details: Array<{
    month: number;
    minPaymentTotal: number;
    shortfall: number;
    availableCreditUsed: number;
    newBorrowed: number;
    totalDebt: number;
    overallUsageRate: number;
  }>;
} {
  const details: Array<{
    month: number;
    minPaymentTotal: number;
    shortfall: number;
    availableCreditUsed: number;
    newBorrowed: number;
    totalDebt: number;
    overallUsageRate: number;
  }> = [];

  let currentDebts = debts.map(d => ({ ...d }));
  let totalNewBorrowed = 0;
  let totalInterestPaid = 0;
  let totalAvailableCreditUsed = 0;
  let maxUsageRate = 0;
  let initialTotalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);

  const getTotalAvailableCredit = (): number => {
    return currentDebts.reduce((sum, d) => {
      if (!d.creditLimit) return sum;
      return sum + Math.max(0, d.creditLimit - d.remainingAmount);
    }, 0);
  };

  const getTotalCreditLimit = (): number => {
    return currentDebts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  };

  for (let m = 1; m <= months; m++) {
    let monthInterest = 0;
    let minPaymentTotal = 0;

    for (const debt of currentDebts) {
      if (debt.remainingAmount <= 0) continue;
      const interest = calculateMonthlyInterest(debt.remainingAmount, debt.interestRate);
      const minPay = calculateMinPayment(debt);
      monthInterest += interest;
      minPaymentTotal += minPay;
    }

    const shortfall = Math.max(0, minPaymentTotal - monthlyAvailable);
    const availableCredit = getTotalAvailableCredit();
    const availableCreditUsed = Math.min(shortfall, availableCredit);
    const newBorrowed = Math.max(0, shortfall - availableCredit);

    totalAvailableCreditUsed += availableCreditUsed;
    totalNewBorrowed += newBorrowed;
    totalInterestPaid += monthInterest;

    for (const debt of currentDebts) {
      if (debt.remainingAmount <= 0) continue;
      const interest = calculateMonthlyInterest(debt.remainingAmount, debt.interestRate);
      const minPay = calculateMinPayment(debt);
      const actualPay = monthlyAvailable >= minPaymentTotal
        ? minPay
        : monthlyAvailable * (minPay / minPaymentTotal);
      const principalPaid = Math.max(0, actualPay - interest);
      debt.remainingAmount = Math.max(0, debt.remainingAmount - principalPaid);
    }

    if (availableCreditUsed > 0) {
      const debtsWithCredit = currentDebts.filter(d => d.creditLimit && d.creditLimit - d.remainingAmount > 0)
        .sort((a, b) => (a.interestRate || 0) - (b.interestRate || 0));
      let remainingToBorrow = availableCreditUsed;
      for (const debt of debtsWithCredit) {
        if (remainingToBorrow <= 0) break;
        const available = (debt.creditLimit || 0) - debt.remainingAmount;
        const borrowFromThis = Math.min(remainingToBorrow, available);
        debt.remainingAmount += borrowFromThis;
        remainingToBorrow -= borrowFromThis;
      }
    }

    if (newBorrowed > 0) {
      currentDebts.push({
        id: uuidv4(),
        name: `新借款-${m}月`,
        type: '网贷',
        remainingAmount: newBorrowed,
        interestRate: newBorrowRate,
        dueDate: 1,
        repaymentType: 'revolving',
        createdAt: new Date().toISOString()
      });
    }

    const totalDebt = currentDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
    const totalLimit = getTotalCreditLimit();
    const overallUsageRate = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 100;
    if (overallUsageRate > maxUsageRate) maxUsageRate = overallUsageRate;

    details.push({
      month: m,
      minPaymentTotal,
      shortfall,
      availableCreditUsed,
      newBorrowed,
      totalDebt,
      overallUsageRate
    });
  }

  const finalTotalDebt = currentDebts.reduce((sum, d) => sum + d.remainingAmount, 0);

  return {
    totalDebtGrowth: finalTotalDebt - initialTotalDebt,
    newBorrowTotal: totalNewBorrowed,
    totalInterestPaid,
    finalTotalDebt,
    totalAvailableCreditUsed,
    maxUsageRate,
    details
  };
}

/**
 * 计算债务整合方案
 * 将多笔高利率债务整合为一笔低利率贷款
 * @param debts 待整合债务
 * @param newRate 新贷款利率
 * @param newTerm 新贷款期限（月）
 * @param monthlyAvailable 每月可还款金额
 */
export function calculateDebtConsolidation(
  debts: Debt[],
  newRate: number,
  newTerm: number,
  monthlyAvailable: number
): {
  feasible: boolean;
  newMonthlyPayment: number;
  totalInterestOld: number;
  totalInterestNew: number;
  interestSaving: number;
  monthlySaving: number;
} {
  const totalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const oldPlan = generateRepaymentPlan(debts, monthlyAvailable, 'avalanche');

  const monthlyRate = newRate / 100 / 12;
  const newMonthlyPayment = totalDebt * (monthlyRate * Math.pow(1 + monthlyRate, newTerm)) / 
                           (Math.pow(1 + monthlyRate, newTerm) - 1);
  const totalInterestNew = newMonthlyPayment * newTerm - totalDebt;

  return {
    feasible: newMonthlyPayment <= monthlyAvailable * 1.5,
    newMonthlyPayment,
    totalInterestOld: oldPlan.totalInterest,
    totalInterestNew,
    interestSaving: oldPlan.totalInterest - totalInterestNew,
    monthlySaving: oldPlan.months.length > 0
      ? (oldPlan.totalPayment / oldPlan.totalMonths) - newMonthlyPayment
      : 0
  };
}

/**
 * 生成余额转移方案分析
 * 将高利率信用卡余额转移到低利率（或0利率）卡
 * @param highRateDebts 高利率债务
 * @param transferFeeRate 转账手续费率
 * @param promoRate 促销利率
 * @param promoMonths 促销期月数
 * @param normalRate 正常利率
 */
export function analyzeBalanceTransfer(
  highRateDebts: Debt[],
  transferFeeRate: number,
  promoRate: number,
  promoMonths: number,
  normalRate: number
): {
  transferAmount: number;
  transferFee: number;
  promoInterest: number;
  normalPlanInterest: number;
  totalSaving: number;
  breakEvenMonth: number;
} {
  const transferAmount = highRateDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const transferFee = transferAmount * (transferFeeRate / 100);

  const monthlyRate = promoRate / 100 / 12;
  const promoInterest = transferAmount * monthlyRate * promoMonths;

  const highRate = Math.max(...highRateDebts.map(d => d.interestRate || 0));
  const normalMonthlyRate = highRate / 100 / 12;
  const normalPlanInterest = transferAmount * normalMonthlyRate * promoMonths;

  const totalSaving = normalPlanInterest - promoInterest - transferFee;

  const monthlySaving = transferAmount * (highRate - promoRate) / 100 / 12;
  const breakEvenMonth = monthlySaving > 0 ? Math.ceil(transferFee / monthlySaving) : -1;

  return {
    transferAmount,
    transferFee,
    promoInterest,
    normalPlanInterest,
    totalSaving,
    breakEvenMonth
  };
}

/**
 * 计算可用额度
 * @param debt 债务数据
 * @returns 可用额度金额
 */
export function getAvailableCredit(debt: Debt): number {
  if (!debt.creditLimit) return 0;
  return Math.max(0, debt.creditLimit - debt.remainingAmount);
}

/**
 * 计算额度使用率
 * @param debt 债务数据
 * @returns 使用率百分比（0-100）
 */
export function getCreditUsageRate(debt: Debt): number {
  if (!debt.creditLimit || debt.creditLimit <= 0) return 0;
  return (debt.remainingAmount / debt.creditLimit) * 100;
}

/**
 * 计算总额度统计
 * @param debts 债务列表
 * @returns 额度统计信息
 */
export function calculateCreditStats(debts: Debt[]): {
  totalCreditLimit: number;
  totalUsed: number;
  totalAvailable: number;
  overallUsageRate: number;
} {
  const totalCreditLimit = debts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  const totalUsed = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalAvailable = Math.max(0, totalCreditLimit - totalUsed);
  const overallUsageRate = totalCreditLimit > 0 ? (totalUsed / totalCreditLimit) * 100 : 0;
  return {
    totalCreditLimit,
    totalUsed,
    totalAvailable,
    overallUsageRate
  };
}

/**
 * 格式化金额
 * @param amount 金额
 * @returns 格式化后的金额字符串
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
