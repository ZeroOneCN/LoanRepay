import { useMemo, useState } from 'react';
import { Row, Col, Table, Tag, Space, Button, Modal, Form, InputNumber, Select, Input, message } from 'antd';
import { DollarOutlined, TransactionOutlined, RiseOutlined, FallOutlined, PlusOutlined } from '@ant-design/icons';
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

interface InterestFormValues {
  debt_id: string;
  amount: number;
  note?: string;
}

const txTypeColor: Record<string, string> = {
  create: 'blue',
  repay: 'green',
  adjust: 'orange',
  delete: 'red',
  interest: 'purple',
};

export default function InterestStats() {
  const { transactions, debts, recordTransaction } = useApp();
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [interestForm] = Form.useForm<InterestFormValues>();

  const handleOpenInterestModal = () => {
    if (debts.length === 0) {
      message.warning('请先在债务管理中添加债务');
      return;
    }
    interestForm.resetFields();
    interestForm.setFieldsValue({ debt_id: debts[0]?.id, amount: 0 });
    setInterestModalOpen(true);
  };

  const handleInterestSubmit = async () => {
    let values;
    try {
      values = await interestForm.validateFields();
    } catch {
      return; // 校验失败，表单自带红色提示
    }
    const debt = debts.find(d => d.id === values.debt_id);
    if (!debt) { message.error('未找到对应债务'); return; }
    if (!values.amount || values.amount <= 0) { message.warning('请输入有效利息金额'); return; }
    try {
      await recordTransaction({
        debt_id: debt.id,
        debt_name: debt.name,
        type: 'interest',
        amount: values.amount,
        interest_portion: values.amount,
        principal_portion: 0,
        remaining_after: debt.remainingAmount,
        interest_rate: debt.interestRate,
        note: values.note ? `未支付利息录入：${values.note}` : '未支付利息录入'
      });
      message.success(`已为「${debt.name}」录入未支付利息 ¥${formatMoney(values.amount)}`);
      setInterestModalOpen(false);
    } catch (e: any) {
      message.error(e?.message || '录入失败，请检查后端服务是否启动');
    }
  };

  const stats = useMemo(() => {
    const repayTx = transactions.filter(t => t.type === 'repay');
    const interestTx = transactions.filter(t => t.type === 'interest');
    // 累计利息支出：只统计已还款中的利息部分（未支付利息已包含在欠款余额中，不重复计算）
    const totalInterest = repayTx.reduce((sum, t) => sum + t.interest_portion, 0);
    const totalPrincipal = repayTx.reduce((sum, t) => sum + t.principal_portion, 0);
    const totalRepaid = repayTx.reduce((sum, t) => sum + t.interest_portion + t.principal_portion, 0);

    const now = dayjs();
    const thisMonthRepay = repayTx.filter(t => dayjs(t.created_at).isSame(now, 'month'));
    const monthInterest = thisMonthRepay.reduce((sum, t) => sum + t.interest_portion, 0);
    const monthRepaid = thisMonthRepay.reduce((sum, t) => sum + t.interest_portion + t.principal_portion, 0);

    // 未支付利息总额（已包含在欠款余额中，仅作参考）
    const unpaidInterest = interestTx.reduce((sum, t) => sum + t.amount, 0);

    return { totalInterest, totalPrincipal, totalRepaid, monthInterest, monthRepaid, unpaidInterest };
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

  const showEmpty = transactions.length === 0 && debts.length === 0;

  return (
    <div>
      <PageHeader
        title="利息统计"
        subtitle="还款利息分析与交易记录"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenInterestModal}
            disabled={debts.length === 0}
          >
            录入未支付利息
          </Button>
        }
      />

      {showEmpty ? (
        <EmptyState description="暂无交易记录，还款或新增债务后将自动记录" />
      ) : (
        <>
      {/* 统计卡片 */}
      <Row gutter={[SPACING.lg, SPACING.lg]} style={{ marginBottom: SPACING.lg }}>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计利息支出" value={stats.totalInterest} precision={2} prefix={<RiseOutlined />} suffix="元" color={COLORS.warning} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="未支付利息（已含在欠款中）" value={stats.unpaidInterest} precision={2} prefix={<DollarOutlined />} suffix="元" color={COLORS.danger} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计还款本金" value={stats.totalPrincipal} precision={2} prefix={<FallOutlined />} suffix="元" color={COLORS.success} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="累计还款总额" value={stats.totalRepaid} precision={2} prefix={<TransactionOutlined />} suffix="元" color={COLORS.primary} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatisticCard title="本月利息" value={stats.monthInterest} precision={2} prefix={<DollarOutlined />} suffix="元" color={COLORS.warning} />
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
        </>
      )}

      {/* 录入未支付利息 Modal */}
      <Modal
        title="录入未支付利息"
        open={interestModalOpen}
        onOk={handleInterestSubmit}
        onCancel={() => setInterestModalOpen(false)}
        okText="确认录入"
        cancelText="取消"
        width={460}
        maskClosable={false}
      >
        <Form form={interestForm} layout="vertical">
          <Form.Item
            name="debt_id"
            label="选择债务"
            rules={[{ required: true, message: '请选择债务' }]}
          >
            <Select placeholder="请选择债务" showSearch optionFilterProp="children">
              {debts.map(d => (
                <Option key={d.id} value={d.id}>
                  {d.name}（剩余 ¥{formatMoney(d.remainingAmount)}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="未支付利息金额（元）"
            rules={[{ required: true, message: '请输入利息金额' }]}
            tooltip="录入所有账单加起来累计的未支付利息，将计入利息统计"
          >
            <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} placeholder="如：500" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选，如：X月账单利息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
