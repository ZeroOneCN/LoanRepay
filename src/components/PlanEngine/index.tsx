import { useState, useMemo } from 'react';
import { Select, Radio, Table, Row, Col, Tag, Space, Alert, DatePicker } from 'antd';
import { ClockCircleOutlined, FundOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { generateRepaymentPlan, formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';
import dayjs from 'dayjs';

const { Option } = Select;

export default function PlanEngine() {
  const { debts, incomeConfig, strategy, setStrategy, targetDate, setTargetDate } = useApp();
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  const currentPlan = useMemo(() => generateRepaymentPlan(debts, incomeConfig.availableForRepayment, strategy), [debts, incomeConfig.availableForRepayment, strategy]);
  const avalanchePlan = useMemo(() => generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'avalanche'), [debts, incomeConfig.availableForRepayment]);
  const snowballPlan = useMemo(() => generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'snowball'), [debts, incomeConfig.availableForRepayment]);
  const minimumPlan = useMemo(() => generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'minimum'), [debts, incomeConfig.availableForRepayment]);

  const chartOption = useMemo(() => {
    if (currentPlan.months.length === 0) return {};
    const dates = currentPlan.months.map(m => m.date.substring(0, 7));
    const remainingData = currentPlan.months.map(m => m.remainingTotal);
    const interestData = currentPlan.months.map((m, i) => {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += currentPlan.months[j].totalInterest;
      return sum;
    });
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => { result += `${p.marker}${p.seriesName}: ¥${formatMoney(p.value)}<br/>`; });
          return result;
        }
      },
      legend: { data: ['剩余债务', '累计利息'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: dates, axisLabel: { rotate: 45, fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val.toFixed(0) } },
      series: [
        { name: '剩余债务', type: 'line', smooth: true, data: remainingData, color: COLORS.danger, lineStyle: { width: 2 }, areaStyle: { opacity: 0.1 } },
        { name: '累计利息', type: 'line', smooth: true, data: interestData, color: COLORS.warning, lineStyle: { width: 2 }, areaStyle: { opacity: 0.1 } }
      ]
    };
  }, [currentPlan]);

  const detailColumns = [
    {
      title: '月份', dataIndex: 'month', key: 'month', width: 80,
      render: (val: number, record: any) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: FONT.tableCell }}>第{val}月</span>
          <span style={{ color: COLORS.textTertiary, fontSize: FONT.caption }}>{record.date.substring(0, 10)}</span>
        </Space>
      )
    },
    { title: '月还款额', dataIndex: 'totalPayment', key: 'totalPayment', render: (val: number) => <span style={{ fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> },
    { title: '本金', dataIndex: 'totalPrincipal', key: 'totalPrincipal', render: (val: number) => <span style={{ color: COLORS.success, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> },
    { title: '利息', dataIndex: 'totalInterest', key: 'totalInterest', render: (val: number) => <span style={{ color: COLORS.warning, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> },
    { title: '剩余债务', dataIndex: 'remainingTotal', key: 'remainingTotal', render: (val: number) => <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> }
  ];

  const expandedRowRender = (record: any) => {
    const debtColumns = [
      { title: '债务名称', dataIndex: 'debtName', key: 'debtName', render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.bodySmall }}>{text}</span> },
      { title: '还款额', dataIndex: 'payment', key: 'payment', render: (val: number) => <span style={{ fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '本金', dataIndex: 'principal', key: 'principal', render: (val: number) => <span style={{ color: COLORS.success, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '利息', dataIndex: 'interest', key: 'interest', render: (val: number) => <span style={{ color: COLORS.warning, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '剩余', dataIndex: 'remaining', key: 'remaining', render: (val: number) => <span style={{ color: COLORS.danger, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> }
    ];
    return <Table columns={debtColumns} dataSource={record.debts} rowKey="debtId" pagination={false} size="small" />;
  };

  if (debts.length === 0) {
    return <EmptyState description="请先在「债务管理」中添加债务记录" actionText="去添加债务" />;
  }

  if (incomeConfig.availableForRepayment <= 0) {
    return <Alert message="可用于还款金额不足" description="请在「收入支出」中设置月收入和支出，确保有足够的可还款金额。" type="error" showIcon style={{ marginTop: SPACING.lg }} />;
  }

  // 策略对比数据
  const strategies = [
    { key: 'avalanche', name: '雪崩法', interest: avalanchePlan.totalInterest, months: avalanchePlan.totalMonths },
    { key: 'snowball', name: '雪球法', interest: snowballPlan.totalInterest, months: snowballPlan.totalMonths },
    { key: 'minimum', name: '最低还款法', interest: minimumPlan.totalInterest, months: minimumPlan.totalMonths },
  ];

  const targetMonths = targetDate ? dayjs(targetDate).diff(dayjs(), 'month') : 0;

  return (
    <div>
      <PageHeader
        title="智能还款规划"
        subtitle="选择还款策略，查看模拟还款进度"
        extra={
          <Space>
            <Select value={strategy} onChange={(v) => setStrategy(v)} style={{ width: 180 }} size="small">
              <Option value="avalanche">雪崩法（优先高利率）</Option>
              <Option value="snowball">雪球法（优先小额债务）</Option>
              <Option value="minimum">最低还款法</Option>
            </Select>
            <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} size="small">
              <Radio.Button value="summary">总览</Radio.Button>
              <Radio.Button value="detail">明细</Radio.Button>
            </Radio.Group>
          </Space>
        }
      />

      {viewMode === 'summary' && (
        <>
          {/* 统计卡片 */}
          <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard title="还款总期数" value={currentPlan.totalMonths} suffix="个月" prefix={<ClockCircleOutlined />} color={COLORS.primary} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard title="预计还清日期" value={currentPlan.payoffDate || '--'} prefix={<FundOutlined />} color={COLORS.purple} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard title="总还款额" value={currentPlan.totalPayment} precision={2} prefix="¥" color={COLORS.warning} />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard title="总利息支出" value={currentPlan.totalInterest} precision={2} prefix="¥" color={COLORS.danger} />
            </Col>
          </Row>

          {/* 策略对比 + 目标时间 */}
          <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
            <Col xs={24} md={14}>
              <SectionCard title="策略对比">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <th style={{ textAlign: 'left', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>策略</th>
                      <th style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>总利息</th>
                      <th style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>期数</th>
                      <th style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map(s => (
                      <tr key={s.key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: `${SPACING.sm}px 0`, fontSize: FONT.body }}>
                          <Tag color={strategy === s.key ? 'blue' : 'default'}>{s.name}</Tag>
                        </td>
                        <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body, color: COLORS.warning, fontWeight: 500 }}>¥{formatMoney(s.interest)}</td>
                        <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0`, fontSize: FONT.body, color: COLORS.textSecondary }}>{s.months}个月</td>
                        <td style={{ textAlign: 'right', padding: `${SPACING.sm}px 0` }}>
                          {strategy === s.key && <Tag color="blue">当前</Tag>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Alert
                  message="建议"
                  description={avalanchePlan.totalInterest <= snowballPlan.totalInterest
                    ? '推荐「雪崩法」，总利息支出最少。'
                    : '推荐「雪球法」，先还清小债务获得心理成就感。'}
                  type="success" showIcon style={{ marginTop: SPACING.md }}
                />
              </SectionCard>
            </Col>
            <Col xs={24} md={10}>
              <SectionCard title="目标时间">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <DatePicker
                    value={targetDate ? dayjs(targetDate) : undefined}
                    onChange={(date) => setTargetDate(date ? date.format('YYYY-MM-DD') : '')}
                    placeholder="选择目标还清日期"
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current < dayjs().endOf('day')}
                  />
                  {targetDate ? (
                    <div style={{ padding: SPACING.md, background: currentPlan.totalMonths <= targetMonths ? COLORS.bgSuccessLight : COLORS.bgDangerLight, borderRadius: 6 }}>
                      <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginBottom: SPACING.xs }}>
                        距目标 {targetMonths}个月 ｜ 当前计划 {currentPlan.totalMonths}个月
                      </div>
                      <div style={{ fontSize: FONT.body, fontWeight: 500, color: currentPlan.totalMonths <= targetMonths ? COLORS.success : COLORS.danger }}>
                        {currentPlan.totalMonths <= targetMonths ? '✅ 可在目标前还清' : '❌ 无法在目标前还清'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary, textAlign: 'center', padding: SPACING.md }}>
                      选择目标日期后查看可行性分析
                    </div>
                  )}
                </Space>
              </SectionCard>
            </Col>
          </Row>

          {/* 还款趋势图 */}
          <SectionCard title="还款趋势图">
            <ReactECharts option={chartOption} style={{ height: 350 }} notMerge={true} />
          </SectionCard>
        </>
      )}

      {viewMode === 'detail' && (
        <SectionCard title="还款明细">
          <Table
            columns={detailColumns}
            dataSource={currentPlan.months}
            rowKey="month"
            pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (total) => `共 ${total} 个月` }}
            size="small"
            expandable={{ expandedRowRender }}
          />
        </SectionCard>
      )}
    </div>
  );
}
