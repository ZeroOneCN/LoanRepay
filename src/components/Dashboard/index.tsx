import { useMemo } from 'react';
import { Row, Col, Card, Progress, List, Tag, Space, Alert } from 'antd';
import {
  DollarOutlined,
  RedEnvelopeOutlined,
  BankOutlined,
  CalculatorOutlined,
  RiseOutlined,
  WarningOutlined,
  PieChartOutlined,
  AccountBookOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { generateRepaymentPlan, formatMoney, calculateMinPayment, calculateMonthlyInterest, calculateCreditStats } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

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
    const data = debts.map(d => ({
      name: d.name,
      value: d.remainingAmount
    }));
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
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' }
        },
        labelLine: { show: false },
        data
      }]
    };
  }, [debts]);

  const assetPieOption = useMemo(() => {
    if (assets.length === 0) return {};
    const data = assets.map(a => ({
      name: a.name,
      value: a.amount
    }));
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
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' }
        },
        labelLine: { show: false },
        data
      }]
    };
  }, [assets]);

  const sortedDebts = [...debts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
  const highRateDebts = debts.filter(d => (d.interestRate || 0) >= 18);
  const totalMinPayment = debts.reduce((sum, d) => sum + calculateMinPayment(d), 0);
  const totalMonthlyInterest = debts.reduce((sum, d) => sum + calculateMonthlyInterest(d.remainingAmount, d.interestRate), 0);

  const debtRatio = totalAsset > 0 ? (totalDebt / totalAsset) * 100 : totalDebt > 0 ? 100 : 0;
  const incomeCoverage = totalMinPayment > 0
    ? (incomeConfig.availableForRepayment / totalMinPayment) * 100
    : 100;

  const creditStats = calculateCreditStats(debts);
  const hasCreditData = creditStats.totalCreditLimit > 0;

  return (
    <div>
      <PageHeader
        title="财务总览"
        subtitle="查看你的整体财务状况，了解债务风险与还款进度"
      />

      {/* 统计卡片行 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="总资产"
            value={totalAsset}
            precision={2}
            prefix={<BankOutlined />}
            suffix="元"
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="总负债"
            value={totalDebt}
            precision={2}
            prefix={<RedEnvelopeOutlined />}
            suffix="元"
            color={COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="净资产"
            value={netWorth}
            precision={2}
            prefix={<DollarOutlined />}
            suffix="元"
            color={netWorth >= 0 ? COLORS.primary : COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            title="负债率"
            value={debtRatio}
            precision={1}
            prefix={<CalculatorOutlined />}
            suffix="%"
            color={debtRatio > 70 ? COLORS.danger : debtRatio > 40 ? COLORS.warning : COLORS.success}
          />
        </Col>
      </Row>

      {/* 关键指标 + 风险评估 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>关键指标</span>} size="small" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: FONT.body }}>每月最低还款</span>
                  <span style={{ fontWeight: 500, fontSize: FONT.body }}>¥{formatMoney(totalMinPayment)}</span>
                </div>
                <Progress
                  percent={incomeCoverage}
                  strokeColor={incomeCoverage >= 100 ? COLORS.success : incomeCoverage >= 80 ? COLORS.warning : COLORS.danger}
                  format={() => `可覆盖 ${incomeCoverage.toFixed(1)}%`}
                  size="small"
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: FONT.body }}>每月产生利息</span>
                  <span style={{ color: COLORS.warning, fontWeight: 500 }}>¥{formatMoney(totalMonthlyInterest)}</span>
                </div>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>
                  相当于每天利息约 ¥{formatMoney(totalMonthlyInterest / 30)}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: FONT.body }}>预计还清时间</span>
                  <span style={{ fontWeight: 500 }}>
                    {currentPlan.totalMonths > 0 ? `${currentPlan.totalMonths}个月` : '--'}
                  </span>
                </div>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>
                  预计还清日期：{currentPlan.payoffDate || '--'}
                </div>
              </div>
              {hasCreditData && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: FONT.body }}>整体额度使用率</span>
                    <span style={{
                      fontWeight: 500,
                      color: creditStats.overallUsageRate >= 90 ? COLORS.danger : creditStats.overallUsageRate >= 70 ? COLORS.warning : COLORS.success
                    }}>
                      {creditStats.overallUsageRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    percent={creditStats.overallUsageRate}
                    strokeColor={creditStats.overallUsageRate >= 90 ? COLORS.danger : creditStats.overallUsageRate >= 70 ? COLORS.warning : COLORS.success}
                    format={() => `可用 ¥${formatMoney(creditStats.totalAvailable)}`}
                    size="small"
                  />
                  <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary, marginTop: 4 }}>
                    总额度 ¥{formatMoney(creditStats.totalCreditLimit)}
                  </div>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: FONT.body }}>应急资金储备</span>
                  <span style={{
                    fontWeight: 500,
                    color: emergencyMonths >= 6 ? COLORS.success : emergencyMonths >= 3 ? COLORS.warning : COLORS.danger
                  }}>
                    {emergencyMonths.toFixed(1)}个月
                  </span>
                </div>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>
                  高流动性资产 / 月支出
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>风险评估</span>} size="small" style={{ height: '100%' }}>
            {highRateDebts.length > 0 && (
              <Alert
                message={`有 ${highRateDebts.length} 笔高利率债务（≥18%）`}
                description="建议优先偿还高利率债务，可以节省大量利息支出。"
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: SPACING.md }}
              />
            )}
            {hasCreditData && creditStats.overallUsageRate >= 80 && (
              <Alert
                message={`额度使用率过高（${creditStats.overallUsageRate.toFixed(1)}%）`}
                description="整体额度使用率超过80%，继续借新还旧可能很快面临额度枯竭，建议尽快降低负债。"
                type="error"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: SPACING.md }}
              />
            )}
            <Alert
              message={incomeCoverage >= 100 ? '还款能力充足' : incomeCoverage >= 80 ? '还款能力一般' : '还款能力不足'}
              description={
                incomeCoverage >= 100
                  ? '每月可还款金额可以覆盖所有最低还款，建议使用雪崩法或雪球法加速还款。'
                  : incomeCoverage >= 80
                    ? '还款能力勉强覆盖最低还款，建议增加收入或减少支出。'
                    : '每月可还款金额不足以覆盖最低还款，可能需要考虑债务重组或寻求帮助。'
              }
              type={incomeCoverage >= 100 ? 'success' : incomeCoverage >= 80 ? 'warning' : 'error'}
              showIcon
              style={{ marginBottom: SPACING.md }}
            />
            <Alert
              message={emergencyMonths >= 6 ? '应急资金充足' : emergencyMonths >= 3 ? '应急资金一般' : '应急资金不足'}
              description={
                emergencyMonths >= 6
                  ? '你的应急资金可以覆盖6个月以上支出，财务状况较安全。'
                  : emergencyMonths >= 3
                    ? '建议储备3-6个月的应急资金。'
                    : '应急资金不足3个月，建议优先积累应急资金。'
              }
              type={emergencyMonths >= 6 ? 'success' : emergencyMonths >= 3 ? 'warning' : 'error'}
              showIcon
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>债务分布</span>} size="small">
            {debts.length > 0 ? (
              <ReactECharts option={debtPieOption} style={{ height: 260 }} notMerge={true} />
            ) : (
              <EmptyState description="暂无债务数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>资产分布</span>} size="small">
            {assets.length > 0 ? (
              <ReactECharts option={assetPieOption} style={{ height: 260 }} notMerge={true} />
            ) : (
              <EmptyState description="暂无资产数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 高利率债务列表 */}
      <Card
        title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>高利率债务优先偿还建议</span>}
        size="small"
      >
        {sortedDebts.length === 0 ? (
          <EmptyState description="暂无债务数据" />
        ) : (
          <List
            size="small"
            dataSource={sortedDebts.slice(0, 5)}
            renderItem={(item) => (
              <List.Item
                style={{ transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontSize: FONT.body }}>{item.name}</span>
                      <Tag color={(item.interestRate || 0) >= 18 ? 'red' : (item.interestRate || 0) >= 12 ? 'orange' : 'green'}>
                        {item.interestRate ? `${item.interestRate}%` : '-'}
                      </Tag>
                      <Tag color="blue">{item.type}</Tag>
                    </Space>
                  }
                  description={
                    <span style={{ fontSize: FONT.bodySmall }}>
                      剩余：<span style={{ color: COLORS.danger }}>¥{formatMoney(item.remainingAmount)}</span>
                      <span style={{ marginLeft: SPACING.lg }}>
                        月利息：¥{formatMoney(calculateMonthlyInterest(item.remainingAmount, item.interestRate))}
                      </span>
                    </span>
                  }
                />
                <RiseOutlined style={{ color: COLORS.danger }} />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}