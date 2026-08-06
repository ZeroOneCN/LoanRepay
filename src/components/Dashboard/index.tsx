import { useMemo } from 'react';
import { Row, Col, Progress, Tag, Space } from 'antd';
import {
  DollarOutlined,
  RedEnvelopeOutlined,
  BankOutlined,
  CalculatorOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { generateRepaymentPlan, formatMoney, calculateMinPayment, calculateMonthlyInterest, calculateCreditStats } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING, COMMON_STYLES } from '../../styles/theme';

export default function Dashboard() {
  const { debts, assets, incomeConfig, totalDebt, totalAsset, netWorth, strategy } = useApp();

  const currentPlan = useMemo(() => {
    return generateRepaymentPlan(debts, incomeConfig.availableForRepayment, strategy);
  }, [debts, incomeConfig.availableForRepayment, strategy]);

  const highLiquidityAsset = assets
    .filter(a => a.liquidity === 'high')
    .reduce((sum, a) => sum + a.amount, 0);

  const emergencyMonths = incomeConfig.monthlyExpense > 0
    ? highLiquidityAsset / incomeConfig.monthlyExpense
    : 0;

  const debtPieOption = useMemo(() => {
    if (debts.length === 0) return {};
    const data = debts.map(d => ({ name: d.name, value: d.remainingAmount }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}<br/>¥${formatMoney(params.value)} (${params.percent}%)`
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: { fontSize: 12 },
        itemWidth: 14,
        itemHeight: 10
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 0, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data
      }]
    };
  }, [debts]);

  const assetPieOption = useMemo(() => {
    if (assets.length === 0) return {};
    const data = assets.map(a => ({ name: a.name, value: a.amount }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}<br/>¥${formatMoney(params.value)} (${params.percent}%)`
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: { fontSize: 12 },
        itemWidth: 14,
        itemHeight: 10
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 0, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data
      }]
    };
  }, [assets]);

  const trendChartOption = useMemo(() => {
    if (currentPlan.months.length === 0) return {};
    const dates = currentPlan.months.map(m => m.date.substring(0, 7));
    const remainingData = currentPlan.months.map(m => m.remainingTotal);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => {
            result += `${p.marker}${p.seriesName}: ¥${formatMoney(p.value)}<br/>`;
          });
          return result;
        }
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: { rotate: 45, fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val.toFixed(0)
        }
      },
      series: [{
        name: '剩余债务',
        type: 'line',
        smooth: true,
        data: remainingData,
        color: COLORS.danger,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.1 },
      }]
    };
  }, [currentPlan]);

  const totalMinPayment = debts.reduce((sum, d) => sum + calculateMinPayment(d), 0);
  const totalMonthlyInterest = debts.reduce((sum, d) => sum + calculateMonthlyInterest(d.remainingAmount, d.interestRate), 0);
  const debtRatio = totalAsset > 0 ? (totalDebt / totalAsset) * 100 : totalDebt > 0 ? 100 : 0;
  const incomeCoverage = totalMinPayment > 0 ? (incomeConfig.availableForRepayment / totalMinPayment) * 100 : 100;
  const creditStats = calculateCreditStats(debts);
  const hasCreditData = creditStats.totalCreditLimit > 0;

  // 风险等级
  const riskLevel = incomeCoverage >= 100 && emergencyMonths >= 3 ? 'safe' : incomeCoverage >= 80 || emergencyMonths >= 1 ? 'warning' : 'danger';
  const riskConfig = {
    safe: { color: COLORS.success, bg: COLORS.bgSuccessLight, label: '财务状况健康' },
    warning: { color: COLORS.warning, bg: COLORS.bgWarningLight, label: '需关注风险' },
    danger: { color: COLORS.danger, bg: COLORS.bgDangerLight, label: '高风险预警' },
  };
  const risk = riskConfig[riskLevel];

  return (
    <div>
      <PageHeader title="财务总览" subtitle="整体财务状况与还款进度一览" />

      {/* 统计卡片 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="总资产" value={totalAsset} precision={2} prefix={<BankOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="总负债" value={totalDebt} precision={2} prefix={<RedEnvelopeOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="净资产" value={netWorth} precision={2} prefix={<DollarOutlined />} suffix="元" color={netWorth >= 0 ? COLORS.primary : COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="负债率" value={debtRatio} precision={1} prefix={<CalculatorOutlined />} suffix="%" color={debtRatio > 70 ? COLORS.danger : debtRatio > 40 ? COLORS.warning : COLORS.success} />
        </Col>
      </Row>

      {/* 财务健康度 + 分布图 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <SectionCard title="财务健康度">
            <div style={{ padding: `${SPACING.sm}px 0` }}>
              {/* 风险状态条 */}
              <div style={{
                padding: SPACING.md,
                background: risk.bg,
                borderRadius: 6,
                marginBottom: SPACING.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: FONT.body, fontWeight: 500, color: risk.color }}>{risk.label}</span>
                <Tag color={riskLevel === 'safe' ? 'success' : riskLevel === 'warning' ? 'warning' : 'error'}>
                  {riskLevel === 'safe' ? '安全' : riskLevel === 'warning' ? '注意' : '危险'}
                </Tag>
              </div>

              {/* 指标行 */}
              <div style={COMMON_STYLES.metricRow}>
                <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>每月最低还款</span>
                <span style={{ fontSize: FONT.body, fontWeight: 500 }}>¥{formatMoney(totalMinPayment)}</span>
              </div>
              <Progress
                percent={Math.min(100, incomeCoverage)}
                strokeColor={incomeCoverage >= 100 ? COLORS.success : incomeCoverage >= 80 ? COLORS.warning : COLORS.danger}
                format={() => `覆盖 ${incomeCoverage.toFixed(0)}%`}
                size="small"
              />

              <div style={{ ...COMMON_STYLES.metricRow, marginTop: SPACING.md }}>
                <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>每月产生利息</span>
                <span style={{ fontSize: FONT.body, fontWeight: 500, color: COLORS.warning }}>¥{formatMoney(totalMonthlyInterest)}</span>
              </div>
              <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginBottom: SPACING.sm }}>
                日均利息 ¥{formatMoney(totalMonthlyInterest / 30)}
              </div>

              <div style={COMMON_STYLES.metricRow}>
                <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>预计还清时间</span>
                <span style={{ fontSize: FONT.body, fontWeight: 500 }}>
                  {currentPlan.totalMonths > 0 ? `${currentPlan.totalMonths}个月` : '--'}
                </span>
              </div>
              <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginBottom: SPACING.sm }}>
                预计日期：{currentPlan.payoffDate || '--'}
              </div>

              {hasCreditData && (
                <>
                  <div style={COMMON_STYLES.metricRow}>
                    <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>额度使用率</span>
                    <span style={{
                      fontSize: FONT.body, fontWeight: 500,
                      color: creditStats.overallUsageRate >= 90 ? COLORS.danger : creditStats.overallUsageRate >= 70 ? COLORS.warning : COLORS.success
                    }}>
                      {creditStats.overallUsageRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    percent={creditStats.overallUsageRate}
                    strokeColor={creditStats.overallUsageRate >= 90 ? COLORS.danger : creditStats.overallUsageRate >= 70 ? COLORS.warning : COLORS.success}
                    size="small"
                  />
                </>
              )}

              <div style={{ ...COMMON_STYLES.metricRow, marginTop: SPACING.sm }}>
                <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>应急资金</span>
                <span style={{
                  fontSize: FONT.body, fontWeight: 500,
                  color: emergencyMonths >= 6 ? COLORS.success : emergencyMonths >= 3 ? COLORS.warning : COLORS.danger
                }}>
                  {emergencyMonths.toFixed(1)}个月
                </span>
              </div>
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} md={12}>
          <SectionCard title="资产负债分布">
            {debts.length === 0 && assets.length === 0 ? (
              <EmptyState description="暂无资产负债数据" />
            ) : (
              <Row gutter={SPACING.lg}>
                {debts.length > 0 && (
                  <Col span={12}>
                    <ReactECharts option={debtPieOption} style={{ height: 220 }} notMerge={true} />
                  </Col>
                )}
                {assets.length > 0 && (
                  <Col span={12}>
                    <ReactECharts option={assetPieOption} style={{ height: 220 }} notMerge={true} />
                  </Col>
                )}
                {debts.length > 0 && assets.length === 0 && (
                  <Col span={12}>
                    <EmptyState description="暂无资产数据" />
                  </Col>
                )}
                {debts.length === 0 && assets.length > 0 && (
                  <Col span={12}>
                    <EmptyState description="暂无债务数据" />
                  </Col>
                )}
              </Row>
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* 还款趋势 */}
      {currentPlan.months.length > 0 && (
        <SectionCard title="还款趋势">
          <ReactECharts option={trendChartOption} style={{ height: 300 }} notMerge={true} />
        </SectionCard>
      )}
    </div>
  );
}
