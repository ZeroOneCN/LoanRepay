import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Modal, Form, Input, InputNumber, Select, DatePicker, Popconfirm, Tag, Space, message, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useApp } from '../../context/AppContext';
import { Transaction } from '../../types';
import { formatMoney } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import PaginatedTable from '../Common/PaginatedTable';
import { COLORS, FONT, SPACING } from '../../styles/theme';

const { Option } = Select;

interface PaymentFormValues {
  debt_id: string;
  amount: number;
  interestPortion: number;
  note?: string;
  createdAt: dayjs.Dayjs;
}

export default function RepaymentHistory() {
  const location = useLocation();
  const { transactions, debts, updateDebt, recordTransaction, updateTransaction, deleteTransaction } = useApp();

  // 从导航 state 获取债务 ID（来自债务管理页面的跳转）
  const initialDebtId = (location.state as any)?.debtId || 'all';
  const [searchText, setSearchText] = useState('');
  const [filterDebtId, setFilterDebtId] = useState<string>(initialDebtId);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentEditingTx, setPaymentEditingTx] = useState<Transaction | null>(null);
  const [paymentForm] = Form.useForm<PaymentFormValues>();

  const repayTransactions = useMemo(() => {
    let list = transactions.filter(t => t.type === 'repay');
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter(t => t.debt_name.toLowerCase().includes(q));
    }
    if (filterDebtId !== 'all') {
      list = list.filter(t => t.debt_id === filterDebtId);
    }
    return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [transactions, searchText, filterDebtId]);

  const stats = useMemo(() => {
    const total = repayTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    const interest = repayTransactions.reduce((s, t) => s + (t.interest_portion || 0), 0);
    const principal = repayTransactions.reduce((s, t) => s + (t.principal_portion || 0), 0);
    return { count: repayTransactions.length, total, interest, principal };
  }, [repayTransactions]);

  const openNewPayment = () => {
    setPaymentEditingTx(null);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      debt_id: debts[0]?.id,
      amount: undefined,
      interestPortion: 0,
      note: undefined,
      createdAt: dayjs()
    });
    setPaymentModalOpen(true);
  };

  const openEditPayment = (tx: Transaction) => {
    setPaymentEditingTx(tx);
    paymentForm.setFieldsValue({
      debt_id: tx.debt_id,
      amount: tx.amount,
      interestPortion: tx.interest_portion || 0,
      note: tx.note,
      createdAt: tx.created_at ? dayjs(tx.created_at) : dayjs()
    });
    setPaymentModalOpen(true);
  };

  const handlePaymentDelete = async (tx: Transaction) => {
    try {
      await deleteTransaction(tx.id);
      message.success('删除还款记录成功，债务剩余金额已自动回滚');
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  };

  const handlePaymentSubmit = async () => {
    try {
      const v = await paymentForm.validateFields();
      if (!v.amount || v.amount <= 0) { message.warning('请输入还款金额'); return; }
      if ((v.interestPortion || 0) > v.amount) { message.warning('利息不能超过还款总额'); return; }
      const interestPortion = v.interestPortion || 0;
      const principalPortion = v.amount - interestPortion;
      const createdAt = v.createdAt ? v.createdAt.toDate().toISOString() : new Date().toISOString();
      const currentDebt = debts.find(d => d.id === v.debt_id);
      if (!currentDebt) { message.error('未找到对应债务'); return; }

      if (paymentEditingTx) {
        const updates: Partial<Transaction> = {
          amount: v.amount,
          interest_portion: interestPortion,
          principal_portion: principalPortion,
          note: v.note,
          created_at: createdAt,
        };
        await updateTransaction(paymentEditingTx.id, updates);
        message.success('编辑还款记录成功');
      } else {
        const newRemaining = currentDebt.remainingAmount - principalPortion;
        if (newRemaining < -0.01) {
          message.warning('补录的还款本金超过债务剩余金额，请调整数值');
          return;
        }
        await updateDebt(v.debt_id, { remainingAmount: Math.max(0, newRemaining) }, { recordTx: false });
        await recordTransaction({
          debt_id: currentDebt.id,
          debt_name: currentDebt.name,
          type: 'repay',
          amount: v.amount,
          interest_portion: interestPortion,
          principal_portion: principalPortion,
          remaining_after: Math.max(0, newRemaining),
          interest_rate: currentDebt?.interestRate,
          note: v.note || `补录还款（利息¥${interestPortion.toFixed(2)} + 本金¥${principalPortion.toFixed(2)}）`,
        });
        message.success('补录还款记录成功');
      }
      setPaymentModalOpen(false);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '还款时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v: string) => <span style={{ fontSize: FONT.tableCell }}>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</span>,
      defaultSortOrder: 'descend' as const,
      sorter: (a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''),
    },
    {
      title: '债务名称',
      dataIndex: 'debt_name',
      key: 'debt_name',
      ellipsis: true,
      render: (text: string) => <span style={{ fontWeight: 500, fontSize: FONT.tableCell }}>{text}</span>,
    },
    {
      title: '还款总额',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: FONT.tableCell, fontWeight: 500, color: COLORS.primary }}>¥{formatMoney(v)}</span>,
      sorter: (a: any, b: any) => a.amount - b.amount,
    },
    {
      title: '本金',
      dataIndex: 'principal_portion',
      key: 'principal_portion',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.success }}>¥{formatMoney(v)}</span>,
    },
    {
      title: '利息',
      dataIndex: 'interest_portion',
      key: 'interest_portion',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.warning }}>¥{formatMoney(v)}</span>,
    },
    {
      title: '还款后剩余',
      dataIndex: 'remaining_after',
      key: 'remaining_after',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>¥{formatMoney(v)}</span>,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => <span title={v || ''} style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{v || '-'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: Transaction) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditPayment(r)}>编辑</Button>
          <Popconfirm title="删除这条还款记录？系统会把本金自动加回债务剩余金额。" onConfirm={() => handlePaymentDelete(r)} okText="确定删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="还款记录"
        subtitle={`共 ${stats.count} 条还款记录，累计还款 ¥${formatMoney(stats.total)}`}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewPayment} disabled={debts.length === 0}>
            补录还款
          </Button>
        }
      />

      {/* 统计卡片 — 一行显示 */}
      <div style={{ display: 'flex', gap: SPACING.lg, marginBottom: SPACING.lg, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, padding: SPACING.md, borderRadius: 8, background: COLORS.bgPrimaryLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计还款总额</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.primary, marginTop: 2 }}>¥{formatMoney(stats.total)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, padding: SPACING.md, borderRadius: 8, background: COLORS.bgSuccessLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计本金（{stats.count}次）</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.success, marginTop: 2 }}>¥{formatMoney(stats.principal)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, padding: SPACING.md, borderRadius: 8, background: COLORS.bgWarningLight }}>
          <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计利息支出</div>
          <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.warning, marginTop: 2 }}>¥{formatMoney(stats.interest)}</div>
        </div>
      </div>

      {/* 搜索 + 筛选 */}
      <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索债务名称"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onSearch={(v) => setSearchText(v)}
          allowClear
          style={{ width: 240 }}
        />
        <Select
          value={filterDebtId}
          onChange={setFilterDebtId}
          style={{ width: 200 }}
          placeholder="筛选债务"
        >
          <Option value="all">全部债务</Option>
          {debts.map(d => (
            <Option key={d.id} value={d.id}>{d.name}</Option>
          ))}
        </Select>
      </div>

      {transactions.length === 0 ? (
        <EmptyState description="暂无还款记录，进行还款操作后将自动生成记录。" />
      ) : (
        <PaginatedTable
          columns={columns}
          dataSource={repayTransactions}
          rowKey="id"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      )}

      {/* 补录/编辑还款 Modal */}
      <Modal
        title={paymentEditingTx ? '编辑还款记录' : '补录还款记录'}
        open={paymentModalOpen}
        onOk={handlePaymentSubmit}
        onCancel={() => setPaymentModalOpen(false)}
        okText={paymentEditingTx ? '保存修改' : '确认补录'}
        destroyOnClose
        width={520}
      >
        <Form form={paymentForm} layout="vertical" preserve={false}>
          <Form.Item name="debt_id" label="选择债务" rules={[{ required: true, message: '请选择债务' }]}>
            <Select placeholder="请选择债务" showSearch optionFilterProp="children" disabled={!!paymentEditingTx}>
              {debts.map(d => (
                <Option key={d.id} value={d.id}>
                  {d.name}（剩余 ¥{formatMoney(d.remainingAmount)}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="还款时间" name="createdAt" rules={[{ required: true, message: '请选择还款时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>
          <Form.Item label="本次还款金额（元）" name="amount" rules={[{ required: true, message: '请输入还款金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="输入本次还款总额" />
          </Form.Item>
          <Form.Item label="其中利息部分（元）" name="interestPortion" tooltip="本次还款中包含的利息金额，剩余部分会计入本金">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="0" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
        <Divider style={{ margin: '0 0 12px' }} />
        <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>
          {paymentEditingTx ? (
            <span>修改本金/利息后，系统会自动同步调整对应债务的剩余金额。</span>
          ) : (
            <span>补录会立即扣减对应债务的剩余金额（本金部分），并生成一条还款流水。</span>
          )}
        </div>
      </Modal>
    </div>
  );
}