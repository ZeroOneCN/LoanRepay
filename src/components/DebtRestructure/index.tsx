import { useState, useMemo } from 'react';
import { Tabs, Form, InputNumber, Row, Col, Alert, Tag, Space, Table, Progress } from 'antd';
import { WarningOutlined, RocketOutlined, SwapOutlined, BankOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { simulateMinimumRoll, calculateDebtConsolidation, analyzeBalanceTransfer, formatMoney } from '../../utils/repaymentEngine';
import { RestructureType } from '../../types';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import PaginatedTable from '../Common/PaginatedTable';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { TabPane } = Tabs;

export default function DebtRestructure() {
  const { debts, incomeConfig, totalDebt } = useApp();
  const [activeTab, setActiveTab] = useState<RestructureType>('minimum_roll');

  const [rollMonths, setRollMonths] = useState(12);
  const [newBorrowRate, setNewBorrowRate] = useState(18);
  const [consolidationRate, setConsolidationRate] = useState(12);
  const [consolidationTerm, setConsolidationTerm] = useState(36);
  const [transferFeeRate, setTransferFeeRate] = useState(3);
  const [transferPromoRate, setTransferPromoRate] = useState(0);
  const [transferPromoMonths, setTransferPromoMonths] = useState(12);
  const [transferNormalRate, setTransferNormalRate] = useState(18);

  const highRateDebts = useMemo(() => debts.filter(d => (d.interestRate || 0) >= 15), [debts]);

  const rollSimulation = useMemo(() => simulateMinimumRoll(debts, incomeConfig.availableForRepayment, newBorrowRate, rollMonths), [debts, incomeConfig.availableForRepayment, newBorrowRate, rollMonths]);
  const consolidationResult = useMemo(() => calculateDebtConsolidation(debts, consolidationRate, consolidationTerm, incomeConfig.availableForRepayment), [debts, consolidationRate, consolidationTerm, incomeConfig.availableForRepayment]);
  const transferResult = useMemo(() => analyzeBalanceTransfer(highRateDebts, transferFeeRate, transferPromoRate, transferPromoMonths, transferNormalRate), [highRateDebts, transferFeeRate, transferPromoRate, transferPromoMonths, transferNormalRate]);

  const rollChartOption = useMemo(() => {
    const months = rollSimulation.details.map(d => `第${d.month}月`);
    return {
      tooltip: { trigger: 'axis', formatter: (params: any) => { let r = `${params[0].axisValue}<br/>`; params.forEach((p: any) => { r += `${p.marker}${p.seriesName}: ¥${formatMoney(p.value)}<br/>`; }); return r; } },
      legend: { data: ['总债务', '新增借款', '最低还款额'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: months, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val.toFixed(0) } },
      series: [
        { name: '总债务', type: 'line', smooth: true, data: rollSimulation.details.map(d => d.totalDebt), color: COLORS.danger, lineStyle: { width: 3 } },
        { name: '新增借款', type: 'bar', data: rollSimulation.details.map(d => d.newBorrowed), color: COLORS.warning },
        { name: '最低还款额', type: 'line', data: rollSimulation.details.map(d => d.minPaymentTotal), color: COLORS.purple, lineStyle: { type: 'dashed' } }
      ]
    };
  }, [rollSimulation]);

  const rollDetailColumns = [
    { title: '月份', dataIndex: 'month', key: 'month', render: (v: number) => `第${v}月` },
    { title: '最低还款', dataIndex: 'minPaymentTotal', key: 'minPaymentTotal', render: (v: number) => `¥${formatMoney(v)}` },
    { title: '资金缺口', dataIndex: 'shortfall', key: 'shortfall', render: (v: number) => <span style={{ color: v > 0 ? COLORS.danger : COLORS.success }}>¥{formatMoney(v)}</span> },
    { title: '新增借款', dataIndex: 'newBorrowed', key: 'newBorrowed', render: (v: number) => <span style={{ color: COLORS.warning }}>¥{formatMoney(v)}</span> },
    { title: '总债务', dataIndex: 'totalDebt', key: 'totalDebt', render: (v: number) => <span style={{ color: COLORS.danger, fontWeight: 500 }}>¥{formatMoney(v)}</span> }
  ];

  if (debts.length === 0) {
    return <EmptyState description="请先在「债务管理」中添加债务记录" actionText="去添加债务" />;
  }

  const borrowScenarios = [
    { name: '信用卡还贷款', desc: '信用卡套现偿还贷款。取现手续费1-3%，日息万分之五（年化18.25%）。', risk: 'red' as const, level: '高风险' },
    { name: '网贷还信用卡', desc: '申请新网贷还信用卡账单。网贷利率15-36%，可能比信用卡滞纳金划算。', risk: 'orange' as const, level: '中风险' },
    { name: '账单分期', desc: '信用卡账单分期降低月供。手续费0.6-0.9%/月，实际年化13-20%。', risk: 'blue' as const, level: '低风险' },
    { name: '最低还款', desc: '只还信用卡最低还款额（约10%）。剩余按日计息，年化约18%。', risk: 'orange' as const, level: '中风险' },
  ];

  return (
    <div>
      <PageHeader title="债务重组策略" subtitle="模拟借新还旧、余额转移等方案，选择最优路径" />

      <Alert
        message="风险提示"
        description="以下策略仅供参考模拟，以贷养贷存在债务滚雪球风险，请谨慎评估。"
        type="warning" showIcon icon={<WarningOutlined />}
        style={{ marginBottom: SPACING.lg }}
      />

      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as RestructureType)}>
        {/* 最低还款滚动 */}
        <TabPane tab={<span><RocketOutlined /> 最低还款滚动</span>} key="minimum_roll">
          <SectionCard title="参数设置" style={{ marginBottom: SPACING.lg }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}><Form.Item label="模拟月数"><InputNumber style={{ width: '100%' }} min={1} max={60} value={rollMonths} onChange={(v) => setRollMonths(v ?? 12)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="新借款年利率（%）"><InputNumber style={{ width: '100%' }} min={0} max={50} step={0.5} value={newBorrowRate} onChange={(v) => setNewBorrowRate(v ?? 18)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="每月可还款额（元）"><InputNumber style={{ width: '100%' }} value={incomeConfig.availableForRepayment} disabled /></Form.Item></Col>
            </Row>
          </SectionCard>

          <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
            <Col xs={24} sm={12} md={6}><StatisticCard title="初始总债务" value={totalDebt} precision={2} prefix="¥" color={COLORS.danger} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="最终总债务" value={rollSimulation.finalTotalDebt} precision={2} prefix="¥" color={COLORS.danger} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="债务增长" value={rollSimulation.totalDebtGrowth} precision={2} prefix="¥" color={COLORS.warning} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="累计新借款" value={rollSimulation.newBorrowTotal} precision={2} prefix="¥" color={COLORS.orange} /></Col>
          </Row>

          <Alert
            message="策略说明"
            description={rollSimulation.totalDebtGrowth > 0
              ? `${rollMonths}个月后债务将增加 ¥${formatMoney(rollSimulation.totalDebtGrowth)}，增长${((rollSimulation.totalDebtGrowth / totalDebt) * 100).toFixed(1)}%。`
              : '当前每月可还款额足以覆盖所有最低还款，无需新增借款。'}
            type={rollSimulation.totalDebtGrowth > 0 ? 'error' : 'success'} showIcon
            style={{ marginBottom: SPACING.lg }}
          />

          <SectionCard title="债务变化趋势" style={{ marginBottom: SPACING.lg }}>
            <ReactECharts option={rollChartOption} style={{ height: 300 }} notMerge={true} />
          </SectionCard>

          <SectionCard title="月度明细">
            <Table columns={rollDetailColumns} dataSource={rollSimulation.details} rowKey="month" pagination={false} size="small" />
          </SectionCard>
        </TabPane>

        {/* 余额转移 */}
        <TabPane tab={<span><SwapOutlined /> 余额转移</span>} key="balance_transfer">
          <SectionCard title="参数设置" style={{ marginBottom: SPACING.lg }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}><Form.Item label="转账手续费率（%）"><InputNumber style={{ width: '100%' }} min={0} max={10} step={0.5} value={transferFeeRate} onChange={(v) => setTransferFeeRate(v ?? 3)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="促销期利率（%）"><InputNumber style={{ width: '100%' }} min={0} max={20} step={0.5} value={transferPromoRate} onChange={(v) => setTransferPromoRate(v ?? 0)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="促销期（月）"><InputNumber style={{ width: '100%' }} min={1} max={24} value={transferPromoMonths} onChange={(v) => setTransferPromoMonths(v ?? 12)} /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}><Form.Item label="促销后年利率（%）"><InputNumber style={{ width: '100%' }} min={0} max={50} step={0.5} value={transferNormalRate} onChange={(v) => setTransferNormalRate(v ?? 18)} /></Form.Item></Col>
              <Col xs={24} sm={12}>
                <Form.Item label={<span>转移债务（利率≥15%）<InfoCircleOutlined style={{ marginLeft: 4 }} /></span>}>
                  <InputNumber style={{ width: '100%' }} value={transferResult.transferAmount} disabled prefix="¥" />
                </Form.Item>
              </Col>
            </Row>
          </SectionCard>

          {highRateDebts.length === 0 ? (
            <Alert message="没有高利率债务" description="当前没有年利率≥15%的债务，余额转移可能不划算。" type="info" showIcon />
          ) : (
            <>
              <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
                <Col xs={24} sm={12} md={6}><StatisticCard title="转账手续费" value={transferResult.transferFee} precision={2} prefix="¥" color={COLORS.danger} /></Col>
                <Col xs={24} sm={12} md={6}><StatisticCard title="促销期利息" value={transferResult.promoInterest} precision={2} prefix="¥" color={COLORS.warning} /></Col>
                <Col xs={24} sm={12} md={6}><StatisticCard title="原方案利息" value={transferResult.normalPlanInterest} precision={2} prefix="¥" color={COLORS.orange} /></Col>
                <Col xs={24} sm={12} md={6}><StatisticCard title="净节省" value={transferResult.totalSaving} precision={2} prefix="¥" color={transferResult.totalSaving > 0 ? COLORS.success : COLORS.danger} /></Col>
              </Row>

              <Alert
                message={transferResult.totalSaving > 0 ? '方案可行' : '方案不划算'}
                description={transferResult.totalSaving > 0
                  ? `余额转移可节省 ¥${formatMoney(transferResult.totalSaving)} 利息。预计${transferResult.breakEvenMonth}个月回本。`
                  : `余额转移将多支出 ¥${formatMoney(Math.abs(transferResult.totalSaving))}。`}
                type={transferResult.totalSaving > 0 ? 'success' : 'error'} showIcon
                style={{ marginBottom: SPACING.lg }}
              />

              <SectionCard title="回本分析">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: FONT.bodySmall }}>手续费成本</span>
                      <span style={{ fontSize: FONT.bodySmall }}>¥{formatMoney(transferResult.transferFee)}</span>
                    </div>
                    <Progress percent={transferResult.breakEvenMonth > 0 ? Math.min(100, (transferPromoMonths / transferResult.breakEvenMonth) * 100) : 100} showInfo={false} strokeColor={COLORS.warning} size="small" />
                  </div>
                  <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>
                    每月节省利息：¥{formatMoney((transferResult.normalPlanInterest - transferResult.promoInterest) / transferPromoMonths)}
                    <br />预计回本时间：{transferResult.breakEvenMonth > 0 ? `${transferResult.breakEvenMonth}个月` : '无法回本'}
                    <br />促销期内总节省：¥{formatMoney(Math.max(0, transferResult.totalSaving))}
                  </div>
                </Space>
              </SectionCard>
            </>
          )}
        </TabPane>

        {/* 债务整合 */}
        <TabPane tab={<span><BankOutlined /> 债务整合</span>} key="debt_consolidation">
          <SectionCard title="参数设置" style={{ marginBottom: SPACING.lg }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}><Form.Item label="新贷款年利率（%）"><InputNumber style={{ width: '100%' }} min={0} max={30} step={0.5} value={consolidationRate} onChange={(v) => setConsolidationRate(v ?? 12)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="贷款期限（月）"><InputNumber style={{ width: '100%' }} min={6} max={120} value={consolidationTerm} onChange={(v) => setConsolidationTerm(v ?? 36)} /></Form.Item></Col>
              <Col xs={24} sm={8}><Form.Item label="整合总额（元）"><InputNumber style={{ width: '100%' }} value={totalDebt} disabled prefix="¥" /></Form.Item></Col>
            </Row>
          </SectionCard>

          <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
            <Col xs={24} sm={12} md={6}><StatisticCard title="新月供" value={consolidationResult.newMonthlyPayment} precision={2} prefix="¥" color={COLORS.primary} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="原方案总利息" value={consolidationResult.totalInterestOld} precision={2} prefix="¥" color={COLORS.orange} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="新方案总利息" value={consolidationResult.totalInterestNew} precision={2} prefix="¥" color={COLORS.warning} /></Col>
            <Col xs={24} sm={12} md={6}><StatisticCard title="利息节省" value={consolidationResult.interestSaving} precision={2} prefix="¥" color={consolidationResult.interestSaving > 0 ? COLORS.success : COLORS.danger} /></Col>
          </Row>

          <Alert
            message={consolidationResult.feasible ? '方案可行' : '还款压力较大'}
            description={consolidationResult.interestSaving > 0
              ? `债务整合后总利息节省 ¥${formatMoney(consolidationResult.interestSaving)}，每月还款 ¥${formatMoney(consolidationResult.newMonthlyPayment)}。`
              : `债务整合后利息增加 ¥${formatMoney(Math.abs(consolidationResult.interestSaving))}。`}
            type={consolidationResult.feasible && consolidationResult.interestSaving > 0 ? 'success' : 'warning'} showIcon
            style={{ marginBottom: SPACING.lg }}
          />

          <SectionCard title="方案对比">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <th style={{ textAlign: 'left', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>指标</th>
                  <th style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.danger }}>当前方案</th>
                  <th style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.success }}>整合后</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: `${SPACING.sm}px 0`, fontSize: FONT.body }}>总利息</td>
                  <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body, color: COLORS.danger }}>¥{formatMoney(consolidationResult.totalInterestOld)}</td>
                  <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body, color: COLORS.success }}>¥{formatMoney(consolidationResult.totalInterestNew)}</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: `${SPACING.sm}px 0`, fontSize: FONT.body }}>月均还款</td>
                  <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body }}>¥{formatMoney(consolidationResult.monthlySaving + consolidationResult.newMonthlyPayment)}</td>
                  <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body }}>¥{formatMoney(consolidationResult.newMonthlyPayment)}</td>
                </tr>
                <tr>
                  <td style={{ padding: `${SPACING.sm}px 0`, fontSize: FONT.body, fontWeight: 500 }}>节省</td>
                  <td colSpan={2} style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body, fontWeight: 500, color: COLORS.success }}>
                    ¥{formatMoney(consolidationResult.interestSaving)}
                    <span style={{ marginLeft: SPACING.md, fontSize: FONT.bodySmall, color: COLORS.textTertiary, fontWeight: 400 }}>
                      月供{consolidationResult.monthlySaving >= 0 ? '减少' : '增加'} ¥{formatMoney(Math.abs(consolidationResult.monthlySaving))}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </SectionCard>
        </TabPane>

        {/* 借新还旧 */}
        <TabPane tab={<span><ThunderboltOutlined /> 借新还旧</span>} key="borrow_new">
          <Alert
            message="风险提示"
            description="借新还旧本质是债务延期，长期依赖会导致债务总额因利息和手续费不断增加。建议仅作为短期应急手段。"
            type="warning" showIcon
            style={{ marginBottom: SPACING.lg }}
          />

          <SectionCard title="常见借新还旧场景">
            <PaginatedTable
              columns={[
                { title: '场景', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ fontWeight: 500, fontSize: FONT.body }}>{t}</span> },
                { title: '说明', dataIndex: 'desc', key: 'desc', render: (t: string) => <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>{t}</span> },
                { title: '风险', dataIndex: 'level', key: 'level', width: 80, render: (_: any, r: any) => <Tag color={r.risk}>{r.level}</Tag> },
              ]}
              dataSource={borrowScenarios}
              rowKey="name"
              size="small"
            />
          </SectionCard>
        </TabPane>
      </Tabs>
    </div>
  );
}
