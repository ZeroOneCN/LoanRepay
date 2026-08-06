import { useState, useMemo } from 'react';
import { Card, Select, Radio, Table, Row, Col, Statistic, Tag, Progress, Space, Alert, DatePicker } from 'antd';
import { ThunderboltOutlined, RocketOutlined, ClockCircleOutlined, FundOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useApp } from '../../context/AppContext';
import { RepaymentStrategy, STRATEGY_LABELS } from '../../types';
import { generateRepaymentPlan, formatMoney } from '../../utils/repaymentEngine';
import dayjs from 'dayjs';

const { Option } = Select;

export default function PlanEngine() {
  const { debts, incomeConfig, strategy, setStrategy, targetDate, setTargetDate } = useApp();
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');

  const currentPlan = useMemo(() => {
    return generateRepaymentPlan(
      debts,
      incomeConfig.availableForRepayment,
      strategy
    );
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
      legend: {
        data: ['剩余债务', '累计利息']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          rotate: 45,
          fontSize: 10
        }
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
          color: '#ff4d4f',
          lineStyle: { width: 2 }
        },
        {
          name: '累计利息',
          type: 'line',
          smooth: true,
          data: interestData,
          areaStyle: { opacity: 0.3 },
          color: '#faad14',
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
          <span>第{val}月</span>
          <span style={{ color: '#999', fontSize: 12 }}>{record.date.substring(0, 10)}</span>
        </Space>
      )
    },
    {
      title: '月还款额',
      dataIndex: 'totalPayment',
      key: 'totalPayment',
      render: (val: number) => `¥${formatMoney(val)}`
    },
    {
      title: '本金',
      dataIndex: 'totalPrincipal',
      key: 'totalPrincipal',
      render: (val: number) => <span style={{ color: '#52c41a' }}>¥{formatMoney(val)}</span>
    },
    {
      title: '利息',
      dataIndex: 'totalInterest',
      key: 'totalInterest',
      render: (val: number) => <span style={{ color: '#faad14' }}>¥{formatMoney(val)}</span>
    },
    {
      title: '剩余债务',
      dataIndex: 'remainingTotal',
      key: 'remainingTotal',
      render: (val: number) => <span style={{ color: '#ff4d4f', fontWeight: 500 }}>¥{formatMoney(val)}</span>
    }
  ];

  const expandedRowRender = (record: any) => {
    const debtColumns = [
      { title: '债务名称', dataIndex: 'debtName', key: 'debtName' },
      {
        title: '还款额',
        dataIndex: 'payment',
        key: 'payment',
        render: (val: number) => `¥${formatMoney(val)}`
      },
      {
        title: '本金',
        dataIndex: 'principal',
        key: 'principal',
        render: (val: number) => <span style={{ color: '#52c41a' }}>¥{formatMoney(val)}</span>
      },
      {
        title: '利息',
        dataIndex: 'interest',
        key: 'interest',
        render: (val: number) => <span style={{ color: '#faad14' }}>¥{formatMoney(val)}</span>
      },
      {
        title: '剩余',
        dataIndex: 'remaining',
        key: 'remaining',
        render: (val: number) => <span style={{ color: '#ff4d4f' }}>¥{formatMoney(val)}</span>
      }
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

  if (debts.length === 0) {
    return (
      <Alert
        message="暂无债务数据"
        description="请先在「债务管理」中添加债务记录，然后查看还款规划。"
        type="info"
        showIcon
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
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>智能还款规划</h3>
        <Space>
          <Select value={strategy} onChange={(v) => { setStrategy(v); }} style={{ width: 200 }}>
            <Option value="avalanche">雪崩法（优先高利率）</Option>
            <Option value="snowball">雪球法（优先小额债务）</Option>
            <Option value="minimum">最低还款法</Option>
          </Select>
          <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
            <Radio.Button value="summary">总览</Radio.Button>
            <Radio.Button value="detail">明细</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      {viewMode === 'summary' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="还款总期数"
                  value={currentPlan.totalMonths}
                  suffix="个月"
                  prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="预计还清日期"
                  value={currentPlan.payoffDate}
                  prefix={<FundOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ fontSize: 16, color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="总还款额"
                  value={currentPlan.totalPayment}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="总利息支出"
                  value={currentPlan.totalInterest}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={12}>
              <Card title="策略对比分析" size="small">
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>
                        <Tag color={strategy === 'avalanche' ? 'blue' : 'default'}>雪崩法</Tag>
                        总利息：¥{formatMoney(avalanchePlan.totalInterest)}
                      </span>
                      <span style={{ color: '#666' }}>{avalanchePlan.totalMonths}个月</span>
                    </div>
                    <Progress
                      percent={100}
                      showInfo={false}
                      strokeColor="#ff4d4f"
                      size="small"
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>
                        <Tag color={strategy === 'snowball' ? 'blue' : 'default'}>雪球法</Tag>
                        总利息：¥{formatMoney(snowballPlan.totalInterest)}
                      </span>
                      <span style={{ color: '#666' }}>{snowballPlan.totalMonths}个月</span>
                    </div>
                    <Progress
                      percent={avalanchePlan.totalInterest > 0 ? (snowballPlan.totalInterest / avalanchePlan.totalInterest) * 100 : 0}
                      showInfo={false}
                      strokeColor="#faad14"
                      size="small"
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>
                        <Tag color={strategy === 'minimum' ? 'blue' : 'default'}>最低还款法</Tag>
                        总利息：¥{formatMoney(minimumPlan.totalInterest)}
                      </span>
                      <span style={{ color: '#666' }}>{minimumPlan.totalMonths}个月</span>
                    </div>
                    <Progress
                      percent={avalanchePlan.totalInterest > 0 ? Math.min(100, (minimumPlan.totalInterest / avalanchePlan.totalInterest) * 100) : 0}
                      showInfo={false}
                      strokeColor="#52c41a"
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
                  style={{ marginTop: 12 }}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="目标时间设置" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <p style={{ margin: '0 0 8px 0' }}>设置你的目标还清日期：</p>
                    <DatePicker
                      value={targetDate ? dayjs(targetDate) : undefined}
                      onChange={(date) => setTargetDate(date ? date.format('YYYY-MM-DD') : '')}
                      placeholder="选择目标日期"
                      style={{ width: '100%' }}
                      disabledDate={(current) => current && current < dayjs().endOf('day')}
                    />
                  </div>
                  {targetDate && (
                    <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4 }}>
                      <p style={{ margin: 0, fontWeight: 500 }}>目标分析</p>
                      <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                        目标日期：{targetDate}
                      </p>
                      <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                        距离目标还有：{dayjs(targetDate).diff(dayjs(), 'month')}个月
                      </p>
                      <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                        按当前计划：{currentPlan.totalMonths}个月还清
                      </p>
                      <p style={{ margin: '8px 0 0 0', fontWeight: 500, color: currentPlan.totalMonths <= dayjs(targetDate).diff(dayjs(), 'month') ? '#52c41a' : '#ff4d4f' }}>
                        {currentPlan.totalMonths <= dayjs(targetDate).diff(dayjs(), 'month')
                          ? '✅ 可以在目标日期前还清'
                          : '❌ 无法在目标日期前还清，需增加每月还款额'}
                      </p>
                    </div>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          <Card title="还款趋势图" size="small">
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
