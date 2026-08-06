import { useState, useMemo } from 'react';
import { Card, Tabs, Form, InputNumber, Select, Button, Row, Col, Statistic, Alert, Tag, Space, Table, Progress, Tooltip } from 'antd';
import { WarningOutlined, ThunderboltOutlined, SwapOutlined, BankOutlined, RocketOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import {
  simulateMinimumRoll,
  calculateDebtConsolidation,
  analyzeBalanceTransfer,
  generateRepaymentPlan,
  formatMoney
} from '../../utils/repaymentEngine';
import { RestructureType, RESTRUCTURE_TYPE_LABELS } from '../../types';

const { Option } = Select;
const { TabPane } = Tabs;

export default function DebtRestructure() {
  const { debts, incomeConfig, totalDebt } = useApp();
  const [activeTab, setActiveTab] = useState<RestructureType>('minimum_roll');

  const [rollForm] = Form.useForm();
  const [consolidationForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  const [rollMonths, setRollMonths] = useState(12);
  const [newBorrowRate, setNewBorrowRate] = useState(18);
  const [consolidationRate, setConsolidationRate] = useState(12);
  const [consolidationTerm, setConsolidationTerm] = useState(36);
  const [transferFeeRate, setTransferFeeRate] = useState(3);
  const [transferPromoRate, setTransferPromoRate] = useState(0);
  const [transferPromoMonths, setTransferPromoMonths] = useState(12);
  const [transferNormalRate, setTransferNormalRate] = useState(18);

  const highRateDebts = useMemo(() => {
    return debts.filter(d => (d.interestRate || 0) >= 15);
  }, [debts]);

  const rollSimulation = useMemo(() => {
    return simulateMinimumRoll(
      debts,
      incomeConfig.availableForRepayment,
      newBorrowRate,
      rollMonths
    );
  }, [debts, incomeConfig.availableForRepayment, newBorrowRate, rollMonths]);

  const consolidationResult = useMemo(() => {
    return calculateDebtConsolidation(
      debts,
      consolidationRate,
      consolidationTerm,
      incomeConfig.availableForRepayment
    );
  }, [debts, consolidationRate, consolidationTerm, incomeConfig.availableForRepayment]);

  const transferResult = useMemo(() => {
    return analyzeBalanceTransfer(
      highRateDebts,
      transferFeeRate,
      transferPromoRate,
      transferPromoMonths,
      transferNormalRate
    );
  }, [highRateDebts, transferFeeRate, transferPromoRate, transferPromoMonths, transferNormalRate]);

  const rollChartOption = useMemo(() => {
    const months = rollSimulation.details.map(d => `第${d.month}月`);
    const totalDebtData = rollSimulation.details.map(d => d.totalDebt);
    const newBorrowData = rollSimulation.details.map(d => d.newBorrowed);
    const minPaymentData = rollSimulation.details.map(d => d.minPaymentTotal);

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
      legend: {
        data: ['总债务', '新增借款', '最低还款额']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => {
            if (val >= 10000) return `${(val / 10000).toFixed(1)}万`;
            return val.toFixed(0);
          }
        }
      },
      series: [
        {
          name: '总债务',
          type: 'line',
          smooth: true,
          data: totalDebtData,
          color: '#ff4d4f',
          lineStyle: { width: 3 }
        },
        {
          name: '新增借款',
          type: 'bar',
          data: newBorrowData,
          color: '#faad14'
        },
        {
          name: '最低还款额',
          type: 'line',
          data: minPaymentData,
          color: '#722ed1',
          lineStyle: { type: 'dashed' }
        }
      ]
    };
  }, [rollSimulation]);

  const rollDetailColumns = [
    { title: '月份', dataIndex: 'month', key: 'month', render: (v: number) => `第${v}月` },
    {
      title: '最低还款总额',
      dataIndex: 'minPaymentTotal',
      key: 'minPaymentTotal',
      render: (v: number) => `¥${formatMoney(v)}`
    },
    {
      title: '资金缺口',
      dataIndex: 'shortfall',
      key: 'shortfall',
      render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>¥{formatMoney(v)}</span>
    },
    {
      title: '新增借款',
      dataIndex: 'newBorrowed',
      key: 'newBorrowed',
      render: (v: number) => <span style={{ color: '#faad14' }}>¥{formatMoney(v)}</span>
    },
    {
      title: '总债务',
      dataIndex: 'totalDebt',
      key: 'totalDebt',
      render: (v: number) => <span style={{ color: '#ff4d4f', fontWeight: 500 }}>¥{formatMoney(v)}</span>
    }
  ];

  if (debts.length === 0) {
    return (
      <Alert
        message="暂无债务数据"
        description="请先在「债务管理」中添加债务记录，然后查看债务重组方案。"
        type="info"
        showIcon
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>债务重组策略</h3>
        <p style={{ margin: '4px 0 0 0', color: '#666' }}>
          模拟各种债务处理策略，包括借新还旧、余额转移等方案，帮助你选择最优路径
        </p>
      </div>

      <Alert
        message="风险提示"
        description="以下策略仅供参考模拟，以贷养贷存在债务滚雪球的风险，请谨慎评估自身还款能力。"
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as RestructureType)}>
        <TabPane
          tab={
            <span>
              <RocketOutlined />
              最低还款滚动
            </span>
          }
          key="minimum_roll"
        >
          <Card size="small" title="参数设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item label="模拟月数">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    max={60}
                    value={rollMonths}
                    onChange={(v) => setRollMonths(v ?? 12)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="新借款年利率（%）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={50}
                    step={0.5}
                    value={newBorrowRate}
                    onChange={(v) => setNewBorrowRate(v ?? 18)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="每月可还款额（元）">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={incomeConfig.availableForRepayment}
                    disabled
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="初始总债务"
                  value={totalDebt}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="最终总债务"
                  value={rollSimulation.finalTotalDebt}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="债务增长"
                  value={rollSimulation.totalDebtGrowth}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#ff7a45' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="累计新借款"
                  value={rollSimulation.newBorrowTotal}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message="策略说明"
            description={
              rollSimulation.totalDebtGrowth > 0
                ? `只还最低还款额，资金缺口通过新借款弥补。${rollMonths}个月后债务将增加 ¥${formatMoney(rollSimulation.totalDebtGrowth)}，增长${((rollSimulation.totalDebtGrowth / totalDebt) * 100).toFixed(1)}%。这是"借新还旧"的典型模式，债务会像滚雪球一样越滚越大。`
                : '当前每月可还款额足以覆盖所有最低还款，无需新增借款。'
            }
            type={rollSimulation.totalDebtGrowth > 0 ? 'error' : 'success'}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Card size="small" title="债务变化趋势" style={{ marginBottom: 16 }}>
            <ReactECharts option={rollChartOption} style={{ height: 300 }} notMerge={true} />
          </Card>

          <Card size="small" title="月度明细">
            <Table
              columns={rollDetailColumns}
              dataSource={rollSimulation.details}
              rowKey="month"
              pagination={false}
              size="small"
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <SwapOutlined />
              余额转移
            </span>
          }
          key="balance_transfer"
        >
          <Card size="small" title="参数设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item label="转账手续费率（%）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={10}
                    step={0.5}
                    value={transferFeeRate}
                    onChange={(v) => setTransferFeeRate(v ?? 3)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="促销期利率（%）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={20}
                    step={0.5}
                    value={transferPromoRate}
                    onChange={(v) => setTransferPromoRate(v ?? 0)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="促销期（月）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    max={24}
                    value={transferPromoMonths}
                    onChange={(v) => setTransferPromoMonths(v ?? 12)}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="促销后年利率（%）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={50}
                    step={0.5}
                    value={transferNormalRate}
                    onChange={(v) => setTransferNormalRate(v ?? 18)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span>
                      转移债务（利率≥15%）
                      <Tooltip title="自动筛选利率≥15%的高利率债务">
                        <InfoCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </span>
                  }
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    value={transferResult.transferAmount}
                    disabled
                    prefix="¥"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {highRateDebts.length === 0 ? (
            <Alert
              message="没有高利率债务"
              description="当前没有年利率≥15%的债务，余额转移可能不划算。"
              type="info"
              showIcon
            />
          ) : (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small">
                    <Statistic
                      title="转账手续费"
                      value={transferResult.transferFee}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small">
                    <Statistic
                      title="促销期利息"
                      value={transferResult.promoInterest}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small">
                    <Statistic
                      title="原方案利息"
                      value={transferResult.normalPlanInterest}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: '#ff7a45' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small">
                    <Statistic
                      title="净节省"
                      value={transferResult.totalSaving}
                      precision={2}
                      prefix="¥"
                      valueStyle={{ color: transferResult.totalSaving > 0 ? '#52c41a' : '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Alert
                message={transferResult.totalSaving > 0 ? '方案可行' : '方案不划算'}
                description={
                  transferResult.totalSaving > 0
                    ? `余额转移可以节省 ¥${formatMoney(transferResult.totalSaving)} 的利息。预计${transferResult.breakEvenMonth}个月回本。建议在促销期内尽量多还本金。`
                    : `余额转移不划算，将多支出 ¥${formatMoney(Math.abs(transferResult.totalSaving))}。原因可能是手续费过高或促销期太短。`
                }
                type={transferResult.totalSaving > 0 ? 'success' : 'error'}
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Card size="small" title="回本分析">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>手续费成本</span>
                      <span>¥{formatMoney(transferResult.transferFee)}</span>
                    </div>
                    <Progress
                      percent={transferResult.breakEvenMonth > 0
                        ? Math.min(100, (transferPromoMonths / transferResult.breakEvenMonth) * 100)
                        : 100}
                      showInfo={false}
                      strokeColor="#faad14"
                      size="small"
                    />
                  </div>
                  <p style={{ margin: 0, color: '#666' }}>
                    每月节省利息：¥{formatMoney(
                      (transferResult.normalPlanInterest - transferResult.promoInterest) / transferPromoMonths
                    )}
                    <br />
                    预计回本时间：{transferResult.breakEvenMonth > 0 ? `${transferResult.breakEvenMonth}个月` : '无法回本'}
                    <br />
                    促销期内总节省：¥{formatMoney(Math.max(0, transferResult.totalSaving))}
                  </p>
                </Space>
              </Card>
            </>
          )}
        </TabPane>

        <TabPane
          tab={
            <span>
              <BankOutlined />
              债务整合
            </span>
          }
          key="debt_consolidation"
        >
          <Card size="small" title="参数设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item label="新贷款年利率（%）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={30}
                    step={0.5}
                    value={consolidationRate}
                    onChange={(v) => setConsolidationRate(v ?? 12)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="贷款期限（月）">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={6}
                    max={120}
                    value={consolidationTerm}
                    onChange={(v) => setConsolidationTerm(v ?? 36)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="整合债务总额（元）">
                  <InputNumber
                    style={{ width: '100%' }}
                    value={totalDebt}
                    disabled
                    prefix="¥"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="新月供"
                  value={consolidationResult.newMonthlyPayment}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="原方案总利息"
                  value={consolidationResult.totalInterestOld}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#ff7a45' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="新方案总利息"
                  value={consolidationResult.totalInterestNew}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="利息节省"
                  value={consolidationResult.interestSaving}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: consolidationResult.interestSaving > 0 ? '#52c41a' : '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Alert
            message={consolidationResult.feasible ? '方案可行' : '还款压力较大'}
            description={
              consolidationResult.interestSaving > 0
                ? `债务整合后，总利息可节省 ¥${formatMoney(consolidationResult.interestSaving)}。每月还款约 ¥${formatMoney(consolidationResult.newMonthlyPayment)}。`
                : `债务整合后利息反而增加 ¥${formatMoney(Math.abs(consolidationResult.interestSaving))}，可能因为新利率仍高于当前部分债务利率。`
            }
            type={consolidationResult.feasible && consolidationResult.interestSaving > 0 ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Card size="small" title="方案对比">
            <Row gutter={16}>
              <Col span={12}>
                <h4 style={{ color: '#ff4d4f' }}>当前方案（雪崩法）</h4>
                <p>总利息：¥{formatMoney(consolidationResult.totalInterestOld)}</p>
                <p>月均还款：¥{formatMoney(consolidationResult.monthlySaving + consolidationResult.newMonthlyPayment)}</p>
              </Col>
              <Col span={12}>
                <h4 style={{ color: '#52c41a' }}>整合后方案</h4>
                <p>总利息：¥{formatMoney(consolidationResult.totalInterestNew)}</p>
                <p>每月还款：¥{formatMoney(consolidationResult.newMonthlyPayment)}</p>
              </Col>
            </Row>
            <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', borderRadius: 4 }}>
              <p style={{ margin: 0 }}>
                <strong>节省：</strong>
                <span style={{ color: '#52c41a', fontSize: 18, fontWeight: 600 }}>
                  ¥{formatMoney(consolidationResult.interestSaving)}
                </span>
                <span style={{ marginLeft: 16 }}>
                  月供变化：{consolidationResult.monthlySaving >= 0 ? '减少' : '增加'} ¥{formatMoney(Math.abs(consolidationResult.monthlySaving))}
                </span>
              </p>
            </div>
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <ThunderboltOutlined />
              借新还旧
            </span>
          }
          key="borrow_new"
        >
          <Card size="small">
            <h4>借新还旧策略说明</h4>
            <p style={{ color: '#666' }}>
              当某笔债务到期而手头资金不足时，通过借入新的贷款来偿还原有债务。
              这种方式可以暂时缓解还款压力，但需注意新贷款的利率和费用。
            </p>
            <Alert
              message="风险提示"
              description="借新还旧本质是债务延期，如果长期依赖此方式，债务总额会因利息和手续费不断增加，最终可能陷入债务深渊。建议仅作为短期应急手段。"
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
            />
          </Card>

          <Card size="small" title="常见借新还旧场景" style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" type="inner" title="信用卡还贷款">
                  <p style={{ color: '#666', fontSize: 13 }}>
                    用信用卡套现偿还贷款到期部分。
                    信用卡取现手续费约1-3%，且无免息期，日息万分之五（年化18.25%）。
                  </p>
                  <Tag color="red">高风险</Tag>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" type="inner" title="网贷还信用卡">
                  <p style={{ color: '#666', fontSize: 13 }}>
                    申请新的网贷来还信用卡账单。
                    网贷利率通常较高（15-36%），但可能比信用卡滞纳金划算。
                  </p>
                  <Tag color="orange">中风险</Tag>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" type="inner" title="账单分期">
                  <p style={{ color: '#666', fontSize: 13 }}>
                    将信用卡账单分期，降低月供。
                    分期手续费率通常在0.6-0.9%/月，实际年化约13-20%。
                  </p>
                  <Tag color="blue">低风险</Tag>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" type="inner" title="最低还款">
                  <p style={{ color: '#666', fontSize: 13 }}>
                    只还信用卡最低还款额（约10%）。
                    剩余部分按日计息，年化约18%，且全额计息。
                  </p>
                  <Tag color="orange">中风险</Tag>
                </Card>
              </Col>
            </Row>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
