import { useMemo } from 'react';
import { Row, Col, Table, Tag, Space, Select } from 'antd';
import { DollarOutlined, TransactionOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { TRANSACTION_TYPE_LABELS, TransactionType } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import StatisticCard from '../Common/StatisticCard';
import SectionCard from '../Common/SectionCard';
import EmptyState from '../Common/EmptyState';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { Option } = Select;

const txTypeColor: Record<string, string> = {
  create: 'blue',
  repay: 'green',
  adjust: 'orange',
  delete: 'red',
};

export default function InterestStats() {
  const { transactions } = useApp();

  const stats = useMemo(() => {
    const repayTx = transactions.filter(t => t.type === 'repay');
    const totalInterest = repayTx.reduce((sum, t) => sum + t.interest_portion, 0);
    const totalPrincipal = repayTx.reduce((sum, t) => sum + t.principal_portion, 0);
    const totalRepaid = totalInterest + totalPrincipal;

    const now = dayjs();
    const thisMonth = repayTx.filter(t => dayjs(t.created_at).isSame(now, 'month'));
    const monthInterest = thisMonth.reduce((sum, t) => sum + t.interest_portion, 0);
    const monthRepaid = thisMonth.reduce((sum, t) => sum + t.interest_portion + t.principal_portion, 0);

    return { totalInterest, totalPrincipal, totalRepaid, monthInterest, monthRepaid };
  }, [transactions]);

  const trendChartOption = useMemo(() => {
    const monthlyMap = new Map<string, { interest: number; principal: number }>();
    transactions.filter(t => t.type === 'repay').forEach(t => {
      const month = dayjs(t.created_at).format('YYYY-MM');
      const existing = monthlyMap.get(month) || { interest: 0, principal: 0 };
      existing.interest += t.interest_portion;
      existing.principal += t.principal_portion;
      monthlyMap.set(month, existing);
    });

    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let r = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => { r += `${p.marker}${p.seriesName}: ¥${formatMoney(p.value)}<br/>`; });
          return r;
        }
      },
      legend: { data: ['利息', '本金'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: sortedMonths, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : val.toFixed(0) } },
      series: [
        { name: '利息', type: 'bar', data: sortedMonths.map(m => monthlyMap.get(m)!.interest), color: COLORS.warning },
        { name: '本金', type: 'bar', data: sortedMonths.map(m => monthlyMap.get(m)!.principal), color: COLORS.success },
      ]
    };
  }, [transactions]);

  const debtInterestMap = useMemo(() => {
    const map = new Map<string, { name: string; interest: number; principal: number }>();
    transactions.filter(t => t.type === 'repay').forEach(t => {
      const existing = map.get(t.debt_id) || { name: t.debt_name, interest: 0, principal: 0 };
      existing.interest += t.interest_portion;
      existing.principal += t.principal_portion;
      map.set(t.debt_id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.interest - a.interest);
  }, [transactions]);

  const pieChartOption = useMemo(() => {
    if (debtInterestMap.length === 0) return {};
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>¥${formatMoney(p.value)} (${p.percent}%)` },
      legend: { orient: 'horizontal', bottom: 0, textStyle: { fontSize: 12 }, itemWidth: 14, itemHeight: 10 },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 0, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: debtInterestMap.map(d => ({ name: d.name, value: d.interest }))
      }]
    };
  }, [debtInterestMap]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val: string) => <span style={{ fontSize: FONT.tableCell }}>{dayjs(val).format('YYYY-MM-DD HH:mm')}</span>
    },
    {
      title: '债务',
      dataIndex: 'debt_name',
      key: 'debt_name',
      ellipsis: true,
      render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (val: TransactionType) => <Tag color={txTypeColor[val]}>{TRANSACTION_TYPE_LABELS[val]}</Tag>
    },
    {
      title: '金额变动',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val: number, record: any) => {
        const isOutflow = record.type === 'create' || record.type === 'adjust';
        return <span style={{ color: isOutflow ? COLORS.danger : COLORS.success, fontWeight: 500, fontSize: FONT.tableCell }}>{isOutflow ? '+' : '-'}¥{formatMoney(val)}</span>;
      }
    },
    {
      title: '利息',
      dataIndex: 'interest_portion',
      key: 'interest_portion',
      width: 100,
      render: (val: number) => val > 0 ? <span style={{ color: COLORS.warning, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> : <span style={{ color: COLORS.textTertiary, fontSize: FONT.tableCell }}>-</span>
    },
    {
      title: '本金',
      dataIndex: 'principal_portion',
      key: 'principal_portion',
      width: 100,
      render: (val: number) => val > 0 ? <span style={{ color: COLORS.success, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span> : <span style={{ color: COLORS.textTertiary, fontSize: FONT.tableCell }}>-</span>
    },
    {
      title: '剩余金额',
      dataIndex: 'remaining_after',
      key: 'remaining_after',
      width: 120,
      render: (val: number) => <span style={{ color: COLORS.textSecondary, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (val: string) => <span style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{val || '-'}</span>
    },
  ];

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader title="利息统计" subtitle="还款利息分析与交易记录" />
        <EmptyState description="暂无交易记录，还款或新增债务后将自动记录" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="利息统计" subtitle="还款利息分析与交易记录" />

      {/* 统计卡片 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计利息支出" value={stats.totalInterest} precision={2} prefix={<RiseOutlined />} suffix="元" color={COLORS.warning} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计还款本金" value={stats.totalPrincipal} precision={2} prefix={<FallOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计还款总额" value={stats.totalRepaid} precision={2} prefix={<TransactionOutlined />} suffix="元" color={COLORS.primary} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="本月利息" value={stats.monthInterest} precision={2} prefix={<DollarOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
      </Row>

      {/* 趋势图 + 占比图 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} md={14}>
          <SectionCard title="利息与本金趋势">
            <ReactECharts option={trendChartOption} style={{ height: 280 }} notMerge={true} />
          </SectionCard>
        </Col>
        <Col xs={24} md={10}>
          <SectionCard title="债务利息占比">
            {debtInterestMap.length > 0 ? (
              <ReactECharts option={pieChartOption} style={{ height: 280 }} notMerge={true} />
            ) : (
              <EmptyState description="暂无利息数据" />
            )}
          </SectionCard>
        </Col>
      </Row>

      {/* 交易明细 */}
      <SectionCard title={`交易明细（共 ${transactions.length} 条）`}>
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          pagination={{
            defaultPageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['15', '30', '50'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          size="middle"
        />
      </SectionCard>
    </div>
  );
}
