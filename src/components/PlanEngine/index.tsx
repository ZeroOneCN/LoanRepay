import { useState, useMemo } from 'react';
import { Card, Select, Radio, Table, Row, Col, Statistic, Tag, Progress, Space, Alert, DatePicker } from 'antd';
import { ClockCircleOutlined, FundOutlined, ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { RepaymentStrategy } from '../../types';
import { generateRepaymentPlan, formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';
import dayjs from 'dayjs';

const { Option } = Select;

export default function PlanEngine() {
  const { debts, incomeConfig, strategy, setStrategy, targetDate, setTargetDate } = useApp();
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  const currentPlan = useMemo(() => {
    return generateRepaymentPlan(debts, incomeConfig.availableForRepayment, strategy);
  }, [debts, incomeConfig.availableForRepayment, strategy]);

  const avalanchePlan = useMemo(() => {
    return generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'avalanche');
  }, [debts, incomeConfig.availableForRepayment]);

  const snowballPlan = useMemo(() => {
    return generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'snowball');
  }, [debts, incomeConfig.availableForRepayment]);

  const minimumPlan = useMemo(() => {
    return generateRepaymentPlan(debts, incomeConfig.availableForRepayment, 'minimum');
  }, [debts, incomeConfig.availableForRepayment]);

  const chartOption = useMemo(() => {
    if (currentPlan.months.length === 0) return {};

    const dates = currentPlan.months.map(m => m.date.substring(0, 7));
    const remainingData = currentPlan.months.map(m => m.remainingTotal);
    const interestData = currentPlan.months.map((m, i) => {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += currentPlan.months[j].totalInterest;
      }
      return sum;
    });

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
      legend: { data: ['剩余债务', '累计利息'] },
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
          formatter: (val: number) => {
            if (val >= 10000) return `${(val / 10000).toFixed(1)}万`;
            return val.toFixed(0);
          }
        }
      },
      series: [
        {
          name: '剩余债务',
          type: 'line',
          smooth: true,
          data: remainingData,
          areaStyle: { opacity: 0.3 },
          color: COLORS.danger,
          lineStyle: { width: 2 }
        },
        {
          name: '累计利息',
          type: 'line',
          smooth: true,
          data: interestData,
          areaStyle: { opacity: 0.3 },
          color: COLORS.warning,
          lineStyle: { width: 2 }
        }
      ]
    };
  }, [currentPlan]);

  const detailColumns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 80,
      render: (val: number, record: any) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: FONT.tableCell }}>第{val}月</span>
          <span style={{ color: COLORS.textTertiary, fontSize: FONT.caption }}>{record.date.substring(0, 10)}</span>
        </Space>
      )
    },
    {
      title: '月还款额',
      dataIndex: 'totalPayment',
      key: 'totalPayment',
      render: (val: number) => <span style={{ fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>
    },
    {
      title: '本金',
      dataIndex: 'totalPrincipal',
      key: 'totalPrincipal',
      render: (val: number) => <span style={{ color: COLORS.success, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>
    },
    {
      title: '利息',
      dataIndex: 'totalInterest',
      key: 'totalInterest',
      render: (val: number) => <span style={{ color: COLORS.warning, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>
    },
    {
      title: '剩余债务',
      dataIndex: 'remainingTotal',
      key: 'remainingTotal',
      render: (val: number) => <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>
    }
  ];

  const expandedRowRender = (record: any) => {
    const debtColumns = [
      { title: '债务名称', dataIndex: 'debtName', key: 'debtName', render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.bodySmall }}>{text}</span> },
      { title: '还款额', dataIndex: 'payment', key: 'payment', render: (val: number) => <span style={{ fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '本金', dataIndex: 'principal', key: 'principal', render: (val: number) => <span style={{ color: COLORS.success, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '利息', dataIndex: 'interest', key: 'interest', render: (val: number) => <span style={{ color: COLORS.warning, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> },
      { title: '剩余', dataIndex: 'remaining', key: 'remaining', render: (val: number) => <span style={{ color: COLORS.danger, fontSize: FONT.bodySmall }}>¥{formatMoney(val)}</span> }
    ];

    return (
      <Table
        columns={debtColumns}
        dataSource={record.debts}
        rowKey="debtId"
        pagination={false}
        size="small"
      />
    );
  };

  // 空状态和错误状态
  if (debts.length === 0) {
    return (
      <EmptyState
        description="请先在「债务管理」中添加债务记录，然后查看还款规划"
        actionText="去添加债务"
      />
    );
  }

  if (incomeConfig.availableForRepayment <= 0) {
    return (
      <Alert
        message="可用于还款金额不足"
        description="请在「收入支出」中设置月收入和支出，确保有足够的可还款金额（收入 - 支出 > 0）。"
        type="error"
        showIcon
        style={{ marginTop: SPACING.lg }}
      />
    );
  }

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
              <StatisticCard
                title="还款总期数"
                value={currentPlan.totalMonths}
                suffix="个月"
                prefix={<ClockCircleOutlined />}
                color={COLORS.primary}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" style={{ height: '100%' }} hoverable>
                <Statistic
                  title="预计还清日期"
                  value={currentPlan.payoffDate || '--'}
                  prefix={<FundOutlined style={{ color: COLORS.purple }} />}
                  valueStyle={{ fontSize: 16, color: COLORS.purple, fontWeight: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard
                title="总还款额"
                value={currentPlan.totalPayment}
                precision={2}
                prefix="¥"
                color={COLORS.orange}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <StatisticCard
                title="总利息支出"
                value={currentPlan.totalInterest}
                precision={2}
                prefix="¥"
                color={COLORS.danger}
              />
            </Col>
          </Row>

          {/* 策略对比 + 目标时间 */}
          <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
            <Col xs={24} md={12}>
              <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>策略对比分析</span>} size="small">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: FONT.bodySmall }}>
                        <Tag color={strategy === 'avalanche' ? 'blue' : 'default'}>雪崩法</Tag>
                        总利息：¥{formatMoney(avalanchePlan.totalInterest)}
                      </span>
                      <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>{avalanchePlan.totalMonths}个月</span>
                    </div>
                    <Progress percent={100} showInfo={false} strokeColor={COLORS.danger} size="small" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: FONT.bodySmall }}>
                        <Tag color={strategy === 'snowball' ? 'blue' : 'default'}>雪球法</Tag>
                        总利息：¥{formatMoney(snowballPlan.totalInterest)}
                      </span>
                      <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>{snowballPlan.totalMonths}个月</span>
                    </div>
                    <Progress
                      percent={avalanchePlan.totalInterest > 0 ? (snowballPlan.totalInterest / avalanchePlan.totalInterest) * 100 : 0}
                      showInfo={false}
                      strokeColor={COLORS.warning}
                      size="small"
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: FONT.bodySmall }}>
                        <Tag color={strategy === 'minimum' ? 'blue' : 'default'}>最低还款法</Tag>
                        总利息：¥{formatMoney(minimumPlan.totalInterest)}
                      </span>
                      <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>{minimumPlan.totalMonths}个月</span>
                    </div>
                    <Progress
                      percent={avalanchePlan.totalInterest > 0 ? Math.min(100, (minimumPlan.totalInterest / avalanchePlan.totalInterest) * 100) : 0}
                      showInfo={false}
                      strokeColor={COLORS.success}
                      size="small"
                    />
                  </div>
                </Space>
                <Alert
                  message="建议"
                  description={
                    avalanchePlan.totalInterest <= snowballPlan.totalInterest
                      ? '推荐使用「雪崩法」，总利息支出最少，适合追求省钱的用户。'
                      : '推荐使用「雪球法」，先还清小债务能获得心理成就感。'
                  }
                  type="success"
                  showIcon
                  style={{ marginTop: SPACING.md }}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>目标时间设置</span>} size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0', fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>
                      设置你的目标还清日期，系统将评估是否可行：
                    </p>
                    <DatePicker
                      value={targetDate ? dayjs(targetDate) : undefined}
                      onChange={(date) => setTargetDate(date ? date.format('YYYY-MM-DD') : '')}
                      placeholder="选择目标日期"
                      style={{ width: '100%' }}
                      disabledDate={(current) => current && current < dayjs().endOf('day')}
                    />
                  </div>
                  {targetDate ? (
                    <div style={{ padding: SPACING.md, background: '#f6ffed', borderRadius: 6 }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: FONT.body }}>目标分析</p>
                      <p style={{ margin: '8px 0 0 0', fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>
                        目标日期：{targetDate} ｜ 距离目标还有：{dayjs(targetDate).diff(dayjs(), 'month')}个月
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>
                        按当前计划：{currentPlan.totalMonths}个月还清
                      </p>
                      <p style={{ margin: '8px 0 0 0', fontWeight: 500, fontSize: FONT.body, color: currentPlan.totalMonths <= dayjs(targetDate).diff(dayjs(), 'month') ? COLORS.success : COLORS.danger }}>
                        {currentPlan.totalMonths <= dayjs(targetDate).diff(dayjs(), 'month')
                          ? '✅ 可以在目标日期前还清'
                          : '❌ 无法在目标日期前还清，需增加每月还款额'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: SPACING.md, background: '#fafafa', borderRadius: 6, textAlign: 'center' }}>
                      <span style={{ fontSize: FONT.bodySmall, color: COLORS.textTertiary }}>
                        选择目标日期后，将显示可行性分析
                      </span>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          {/* 还款趋势图 */}
          <Card
            title={<span style={{ fontSize: FONT.h2, fontWeight: 600 }}>还款趋势图</span>}
            size="small"
          >
            <ReactECharts option={chartOption} style={{ height: 350 }} notMerge={true} />
          </Card>
        </>
      )}

      {viewMode === 'detail' && (
        <Card size="small">
          <Table
            columns={detailColumns}
            dataSource={currentPlan.months}
            rowKey="month"
            pagination={{
              pageSize: 12,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个月`
            }}
            size="small"
            expandable={{ expandedRowRender }}
          />
        </Card>
      )}
    </div>
  );
}