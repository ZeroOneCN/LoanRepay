import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, Tag, Space, Row, Col, DatePicker, message, Dropdown, Input as AntInput, Grid, Drawer, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, MoreOutlined, SearchOutlined, FileTextOutlined, TransactionOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DEBT_TYPES, REPAYMENT_TYPE_LABELS, RepaymentType, Transaction } from '../../types';
import { formatMoney, calculateMonthlyInterest } from '../../utils/repaymentEngine';
import PageHeader from '../Common/PageHeader';
import EmptyState from '../Common/EmptyState';
import PaginatedTable from '../Common/PaginatedTable';
import { COLORS, FONT, SPACING } from '../../styles/theme';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { useBreakpoint } = Grid;

function getRepaymentTypeColor(type: string): string {
  const colorMap: Record<string, string> = { revolving: 'blue', interest_only: 'orange', flexible: 'green' };
  return colorMap[type] || 'default';
}

interface DebtFormValues {
  name: string;
  type: string;
  remainingAmount: number;
  creditLimit?: number;
  interestRate?: number;
  dueDate: number;
  lastDueDate?: number;
  repaymentType: RepaymentType;
  maturityDate?: dayjs.Dayjs;
  note?: string;
}

interface PaymentFormValues {
  amount: number;
  interestPortion: number;
  note?: string;
  createdAt: dayjs.Dayjs;
}

export default function DebtManager() {
  const navigate = useNavigate();
  const { debts, addDebt, updateDebt, deleteDebt, repayDebt, totalDebt, transactions, recordTransaction, updateTransaction, deleteTransaction } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [repayModal, setRepayModal] = useState<{ visible: boolean; debtId: string; debtName: string; remaining: number; interestRate?: number }>({ visible: false, debtId: '', debtName: '', remaining: 0 });
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [repayInterest, setRepayInterest] = useState<number>(0);
  const [form] = Form.useForm<DebtFormValues>();
  // 还款记录 Drawer / 新增-编辑 Modal
  const [drawerDebt, setDrawerDebt] = useState<{ id: string; name: string; remaining: number } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentEditingTx, setPaymentEditingTx] = useState<Transaction | null>(null);
  const [paymentForm] = Form.useForm<PaymentFormValues>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screens = useBreakpoint();

  const handleExport = () => {
    if (debts.length === 0) { message.warning('暂无债务数据可导出'); return; }
    const exportData = debts.map(d => ({
      '债务名称': d.name, '债务类型': d.type, '剩余金额': d.remainingAmount,
      '总额度': d.creditLimit || '', '年利率(%)': d.interestRate || '',
      '出账日': d.dueDate || '', '最迟还款日': d.lastDueDate || '',
      '还款方式': REPAYMENT_TYPE_LABELS[d.repaymentType as RepaymentType] || d.repaymentType,
      '到期日': d.maturityDate || '', '备注': d.note || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '债务数据');
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.writeFile(wb, `债务数据_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('导出成功');
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { '债务名称': '示例：招商银行信用卡', '债务类型': '信用卡', '剩余金额': 50000, '总额度': 100000, '年利率(%)': 18, '出账日': 10, '最迟还款日': 25, '还款方式': '循环贷', '到期日': '', '备注': '示例备注' },
      { '债务名称': '示例：蚂蚁借呗', '债务类型': '网贷', '剩余金额': 20000, '总额度': '', '年利率(%)': 15, '出账日': 1, '最迟还款日': 10, '还款方式': '灵活模式', '到期日': '', '备注': '' }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入模板');
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }];
    XLSX.writeFile(wb, '债务导入模板.xlsx');
    message.success('模板下载成功');
  };

  const handleImport = async (file: File) => {
    setImportLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
          if (jsonData.length === 0) { message.error('导入文件为空'); setImportLoading(false); return; }
          const repayTypeMap: Record<string, RepaymentType> = { '循环贷': 'revolving', '先息后本': 'interest_only', '灵活模式': 'flexible' };
          const existingNames = new Set(debts.map(d => d.name));
          let successCount = 0, skipCount = 0, errorCount = 0;
          for (const row of jsonData) {
            try {
              const name = row['债务名称']; const type = row['债务类型']; const remainingAmount = row['剩余金额'];
              if (!name || !type || remainingAmount === undefined) { errorCount++; continue; }
              if (existingNames.has(String(name))) { skipCount++; continue; }
              const repayType = repayTypeMap[row['还款方式'] || '循环贷'] || 'revolving';
              await addDebt({
                name: String(name), type: String(type), remainingAmount: Number(remainingAmount),
                creditLimit: row['总额度'] ? Number(row['总额度']) : undefined,
                interestRate: row['年利率(%)'] ? Number(row['年利率(%)']) : undefined,
                dueDate: row['出账日'] ? Number(row['出账日']) : 1,
                lastDueDate: row['最迟还款日'] ? Number(row['最迟还款日']) : undefined,
                repaymentType: repayType,
                maturityDate: row['到期日'] ? String(row['到期日']) : undefined,
                note: row['备注'] ? String(row['备注']) : undefined
              });
              existingNames.add(String(name));
              successCount++;
            } catch { errorCount++; }
          }
          const tips: string[] = [];
          if (successCount > 0) tips.push(`成功导入 ${successCount} 条`);
          if (skipCount > 0) tips.push(`跳过 ${skipCount} 条重复`);
          if (errorCount > 0) tips.push(`${errorCount} 条失败`);
          if (successCount > 0) message.success(tips.join('，'));
          else if (skipCount > 0) message.info('所有数据均已存在，无需重复导入');
          else message.error('导入失败，请检查文件格式');
        } catch { message.error('文件解析失败，请确保是有效的Excel文件'); }
        setImportLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch { message.error('读取文件失败'); setImportLoading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ type: '信用卡', dueDate: 10, repaymentType: 'revolving' });
    setIsModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name, type: record.type, remainingAmount: record.remainingAmount,
      creditLimit: record.creditLimit, interestRate: record.interestRate,
      dueDate: record.dueDate, lastDueDate: record.lastDueDate,
      repaymentType: record.repaymentType || 'revolving',
      maturityDate: record.maturityDate ? dayjs(record.maturityDate) : undefined,
      note: record.note
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch (e) { console.error('Form validation failed:', e); return; }
    const data: any = { ...values, maturityDate: values.maturityDate ? values.maturityDate.format('YYYY-MM-DD') : undefined };
    try {
      if (editingId) { await updateDebt(editingId, data); message.success('债务更新成功'); }
      else { await addDebt(data); message.success('债务添加成功'); }
      setIsModalOpen(false);
    } catch (e: any) {
      message.error(e?.message || '操作失败，请检查后端服务是否启动');
    }
  };

  const handleRepay = (record: any) => {
    const suggestedInterest = record.interestRate
      ? Math.min(calculateMonthlyInterest(record.remainingAmount, record.interestRate), record.remainingAmount)
      : 0;
    setRepayModal({ visible: true, debtId: record.id, debtName: record.name, remaining: record.remainingAmount, interestRate: record.interestRate });
    setRepayAmount(0);
    setRepayInterest(Math.round(suggestedInterest * 100) / 100);
  };

  const handleRepaySubmit = async () => {
    if (repayAmount <= 0) { message.warning('请输入有效还款金额'); return; }
    if (repayInterest > repayAmount) { message.warning('利息部分不能超过还款总额'); return; }
    const principalPortion = repayAmount - repayInterest;
    if (principalPortion > repayModal.remaining) { message.warning('本金部分（还款总额 - 利息）不能超过剩余金额'); return; }
    const newRemaining = repayModal.remaining - principalPortion;
    try {
      await repayDebt(repayModal.debtId, repayAmount, repayInterest);
      if (newRemaining === 0) {
        message.success(`「${repayModal.debtName}」已还清`);
      } else {
        message.success(`「${repayModal.debtName}」还款成功，剩余 ¥${formatMoney(newRemaining)}`);
      }
      setRepayModal({ ...repayModal, visible: false });
    } catch (e: any) {
      message.error(e?.message || '还款失败，请检查后端服务是否启动');
    }
  };

  // ========== 还款记录 Drawer + 编辑/新增/删除 ==========
  const openPaymentDrawer = (record: any) => {
    setDrawerDebt({ id: record.id, name: record.name, remaining: record.remainingAmount });
  };
  const closePaymentDrawer = () => setDrawerDebt(null);

  const debtRepayTxs = useMemo(() => {
    if (!drawerDebt) return [];
    return transactions
      .filter(t => t.debt_id === drawerDebt.id && t.type === 'repay')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [drawerDebt, transactions]);

  const repaySummary = useMemo(() => {
    const list = debtRepayTxs;
    const total = list.reduce((s, t) => s + (t.amount || 0), 0);
    const interest = list.reduce((s, t) => s + (t.interest_portion || 0), 0);
    const principal = list.reduce((s, t) => s + (t.principal_portion || 0), 0);
    return { count: list.length, total, interest, principal };
  }, [debtRepayTxs]);

  const openNewPayment = () => {
    setPaymentEditingTx(null);
    paymentForm.setFieldsValue({
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
      if (!drawerDebt) return;
      if (!v.amount || v.amount <= 0) { message.warning('请输入还款金额'); return; }
      if ((v.interestPortion || 0) > v.amount) { message.warning('利息不能超过还款总额'); return; }
      const interestPortion = v.interestPortion || 0;
      const principalPortion = v.amount - interestPortion;
      const createdAt = v.createdAt ? v.createdAt.toDate().toISOString() : new Date().toISOString();
      const currentDebt = debts.find(d => d.id === drawerDebt.id);
      const currentRemaining = currentDebt?.remainingAmount ?? drawerDebt.remaining;

      if (paymentEditingTx) {
        // 编辑：更新 transaction 内容 + 改 created_at/interest/amount/note，remaining_after 保持一致即可
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
        // 补录：先更新债务 remainingAmount，再写 transaction
        const newRemaining = currentRemaining - principalPortion;
        if (newRemaining < -0.01) {
          message.warning('补录的还款本金超过债务剩余金额，请调整数值');
          return;
        }
        await updateDebt(drawerDebt.id, { remainingAmount: Math.max(0, newRemaining) }, { recordTx: false });
        await recordTransaction({
          debt_id: drawerDebt.id,
          debt_name: drawerDebt.name,
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
      if (e?.errorFields) return; // 表单校验错误，不弹提示
      message.error(e?.message || '操作失败，请检查后端服务是否启动');
    }
  };

  const totalCreditLimit = debts.reduce((sum, d) => sum + (d.creditLimit || 0), 0);
  const totalAvailable = totalCreditLimit - totalDebt;

  // 搜索 + 筛选
  const filteredDebts = useMemo(() => {
    let result = [...debts];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q));
    }
    if (filterType !== 'all') {
      result = result.filter(d => d.type === filterType);
    }
    return result.sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [debts, searchText, filterType]);

  // 筛选后的汇总
  const filteredSummary = useMemo(() => {
    const sum = filteredDebts.reduce((acc, d) => {
      acc.amount += d.remainingAmount;
      acc.credit += d.creditLimit || 0;
      return acc;
    }, { amount: 0, credit: 0 });
    return { ...sum, available: sum.credit - sum.amount, count: filteredDebts.length };
  }, [filteredDebts]);

  const isFiltering = searchText.trim() !== '' || filterType !== 'all';

  const debtTypes = useMemo(() => {
    const types = new Set(debts.map(d => d.type));
    return Array.from(types);
  }, [debts]);

  const columns = [
    {
      title: '债务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4, fontSize: FONT.tableCell }}>{text}</div>
          <Space size={4} wrap>
            <Tag color="blue">{record.type}</Tag>
            <Tag color={getRepaymentTypeColor(record.repaymentType)}>
              {REPAYMENT_TYPE_LABELS[record.repaymentType as RepaymentType] || record.repaymentType}
            </Tag>
          </Space>
        </div>
      )
    },
    {
      title: '剩余金额',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      width: 120,
      ellipsis: true,
      defaultSortOrder: 'descend' as const,
      render: (val: number) => <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.tableCell }}>¥{formatMoney(val)}</span>,
      sorter: (a: any, b: any) => a.remainingAmount - b.remainingAmount
    },
    {
      title: '额度使用',
      key: 'creditInfo',
      width: 100,
      ellipsis: true,
      render: (_: any, record: any) => {
        if (!record.creditLimit) return <span style={{ color: COLORS.textTertiary, fontSize: FONT.tableCell }}>-</span>;
        const rate = (record.remainingAmount / record.creditLimit) * 100;
        const color = rate >= 90 ? COLORS.danger : rate >= 70 ? COLORS.warning : COLORS.success;
        return (
          <div>
            <div style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>¥{formatMoney(record.creditLimit)}</div>
            <div style={{ color, fontSize: FONT.caption, fontWeight: 500 }}>{rate.toFixed(1)}% 已用</div>
          </div>
        );
      },
      sorter: (a: any, b: any) => (a.creditLimit || 0) - (b.creditLimit || 0)
    },
    {
      title: '年利率',
      dataIndex: 'interestRate',
      key: 'interestRate',
      width: 80,
      render: (val: number) => val ? <Tag color={val >= 18 ? 'red' : val >= 10 ? 'orange' : 'green'}>{val}%</Tag> : '-',
      sorter: (a: any, b: any) => (a.interestRate || 0) - (b.interestRate || 0)
    },
    {
      title: '还款日',
      key: 'dueDates',
      width: 90,
      render: (_: any, record: any) => {
        const parts: string[] = [];
        if (record.dueDate) parts.push(`出账${record.dueDate}日`);
        if (record.lastDueDate) parts.push(`到期${record.lastDueDate}日`);
        return <span style={{ fontSize: FONT.tableCell }}>{parts.join(' / ') || '-'}</span>;
      }
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      width: 200,
      ellipsis: true,
      render: (val: string) => val ? <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>{val}</span> : <span style={{ color: COLORS.textTertiary, fontSize: FONT.tableCell }}>-</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={0} wrap={false}>
          <Button type="link" size="small" onClick={() => handleRepay(record)} style={{ padding: '0 4px' }}>还款</Button>
          <Button type="link" size="small" onClick={() => navigate('/debt/history', { state: { debtId: record.id } })} style={{ padding: '0 4px' }}>记录</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)} style={{ padding: '0 4px' }}>编辑</Button>
          <Popconfirm title="确定删除？删除后历史还款记录将保留在交易记录中（未记账的部分可单独删除）。" onConfirm={async () => { try { await deleteDebt(record.id); message.success('删除成功'); } catch (e: any) { message.error(e?.message || '删除失败，请检查后端服务是否启动'); } }} okText="确定删除" cancelText="取消">
            <Button type="link" size="small" danger style={{ padding: '0 4px' }}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const moreMenuItems = [
    { key: 'template', label: '下载模板', icon: <DownloadOutlined />, onClick: handleDownloadTemplate },
    { key: 'import', label: '导入Excel', icon: <UploadOutlined />, onClick: () => fileInputRef.current?.click() },
    { key: 'export', label: '导出数据', icon: <DownloadOutlined />, onClick: handleExport },
  ];

  // 移动端卡片渲染
  const isMobile = !screens.md;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {importLoading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>导入中...</div>
        </div>
      )}

      <PageHeader
        title="债务管理"
        subtitle={`总负债 ¥${formatMoney(totalDebt)}${totalCreditLimit > 0 ? ` ｜ 额度 ¥${formatMoney(totalCreditLimit)} ｜ 可用 ¥${formatMoney(Math.max(0, totalAvailable))}` : ''}`}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加债务</Button>
            <Dropdown menu={{ items: moreMenuItems }}>
              <Button icon={<MoreOutlined />}>更多操作</Button>
            </Dropdown>
          </Space>
        }
      />

      {/* 搜索 + 筛选 */}
      {debts.length > 0 && (
        <Row gutter={SPACING.sm} style={{ marginBottom: SPACING.sm }}>
          <Col xs={24} sm={12} md={8}>
            <AntInput
              prefix={<SearchOutlined style={{ color: COLORS.textTertiary }} />}
              placeholder="搜索债务名称或类型"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: '100%' }}
            >
              <Option value="all">全部类型</Option>
              {debtTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Col>
        </Row>
      )}

      {/* 筛选后的汇总条 */}
      {debts.length > 0 && (
        <div style={{
          marginBottom: SPACING.lg,
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          background: COLORS.bgLight,
          borderRadius: 6,
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACING.lg,
          alignItems: 'center',
          fontSize: FONT.bodySmall,
        }}>
          <span style={{ color: COLORS.textSecondary }}>
            {isFiltering ? `筛选结果：${filteredSummary.count} 条` : `共 ${debts.length} 条债务`}
          </span>
          <span style={{ color: COLORS.textSecondary }}>
            剩余金额：<span style={{ color: COLORS.danger, fontWeight: 500 }}>¥{formatMoney(filteredSummary.amount)}</span>
          </span>
          {filteredSummary.credit > 0 && (
            <>
              <span style={{ color: COLORS.textSecondary }}>
                总额度：<span style={{ color: COLORS.textPrimary, fontWeight: 500 }}>¥{formatMoney(filteredSummary.credit)}</span>
              </span>
              <span style={{ color: COLORS.textSecondary }}>
                可用额度：<span style={{ color: COLORS.success, fontWeight: 500 }}>¥{formatMoney(Math.max(0, filteredSummary.available))}</span>
              </span>
            </>
          )}
          {isFiltering && (
            <Button type="link" size="small" onClick={() => { setSearchText(''); setFilterType('all'); }} style={{ padding: 0, marginLeft: 'auto' }}>清除筛选</Button>
          )}
        </div>
      )}

      {debts.length === 0 ? (
        <EmptyState description="还没有债务记录，点击上方「添加债务」开始管理" actionText="添加债务" onAction={handleAdd} />
      ) : filteredDebts.length === 0 ? (
        <EmptyState description="没有匹配的债务记录" />
      ) : isMobile ? (
        /* 移动端卡片列表 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          {filteredDebts.map((item: any) => (
            <div
              key={item.id}
              style={{
                background: COLORS.bgCard,
                borderRadius: 8,
                padding: SPACING.lg,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {/* 标题行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.sm }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: FONT.body, marginBottom: 4 }}>{item.name}</div>
                  <Space size={4} wrap>
                    <Tag color="blue">{item.type}</Tag>
                    <Tag color={getRepaymentTypeColor(item.repaymentType)}>
                      {REPAYMENT_TYPE_LABELS[item.repaymentType as RepaymentType] || item.repaymentType}
                    </Tag>
                  </Space>
                </div>
                <span style={{ color: COLORS.danger, fontWeight: 500, fontSize: FONT.body }}>¥{formatMoney(item.remainingAmount)}</span>
              </div>
              {/* 信息行 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm }}>
                {item.creditLimit && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>额度</div>
                    <div style={{ fontSize: FONT.bodySmall }}>¥{formatMoney(item.creditLimit)}</div>
                  </div>
                )}
                {item.interestRate && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>年利率</div>
                    <div style={{ fontSize: FONT.bodySmall }}>
                      <Tag color={item.interestRate >= 18 ? 'red' : item.interestRate >= 10 ? 'orange' : 'green'} style={{ marginLeft: 0 }}>{item.interestRate}%</Tag>
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>还款日</div>
                  <div style={{ fontSize: FONT.bodySmall }}>
                    {[item.dueDate && `出账${item.dueDate}日`, item.lastDueDate && `到期${item.lastDueDate}日`].filter(Boolean).join(' / ') || '-'}
                  </div>
                </div>
                {item.interestRate && (
                  <div>
                    <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>月利息</div>
                    <div style={{ fontSize: FONT.bodySmall, color: COLORS.warning }}>¥{formatMoney(calculateMonthlyInterest(item.remainingAmount, item.interestRate))}</div>
                  </div>
                )}
              </div>
              {/* 操作行 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 0, marginTop: SPACING.sm, borderTop: `1px solid ${COLORS.border}`, paddingTop: SPACING.sm }}>
                <Button type="link" size="small" icon={<TransactionOutlined />} onClick={() => handleRepay(item)}>还款</Button>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>
                <Popconfirm title="确定删除？" onConfirm={async () => { try { await deleteDebt(item.id); message.success('删除成功'); } catch (e: any) { message.error(e?.message || '删除失败，请检查后端服务是否启动'); } }} okText="确定" cancelText="取消">
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* 桌面端表格 */
        <PaginatedTable
          columns={columns}
          dataSource={filteredDebts}
          rowKey="id"
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          size="middle"
        />
      )}

      <Modal
        title={editingId ? '编辑债务' : '添加债务'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={600}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="债务名称" rules={[{ required: true, message: '请输入债务名称' }]}>
                <Input placeholder="如：招商银行信用卡" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="债务类型" rules={[{ required: true, message: '请选择债务类型' }]}>
                <Select placeholder="请选择">{DEFAULT_DEBT_TYPES.map(type => <Option key={type} value={type}>{type}</Option>)}</Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="remainingAmount" label="当前剩余金额（元）" rules={[{ required: true, message: '请输入剩余金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如：50000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="creditLimit" label="总额度（元）" tooltip="信用卡/网贷的授信总额度">
                <InputNumber style={{ width: '100%' }} placeholder="如：100000" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="repaymentType" label="还款方式" rules={[{ required: true, message: '请选择还款方式' }]}>
                <Select onChange={(val) => {
                  if (val === 'flexible') {
                    form.setFieldsValue({ dueDate: undefined, lastDueDate: undefined });
                  }
                  if (val !== 'interest_only') {
                    form.setFieldsValue({ maturityDate: undefined });
                  }
                }}>
                  <Option value="revolving">循环贷</Option>
                  <Option value="interest_only">先息后本</Option>
                  <Option value="flexible">灵活模式</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="interestRate" label="年利率（%）" tooltip="信用卡通常18%，网贷15-24%，银行贷款3-8%">
                <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} placeholder="如：18" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}>
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type === 'flexible') return null;
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="dueDate" label="出账日" rules={[{ required: true, message: '请输入出账日' }]} tooltip="每月账单生成的日期">
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：15" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="lastDueDate" label="最迟还款日" rules={[{ required: true, message: '请输入最迟还款日' }]} tooltip="超过这天就算逾期">
                      <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="如：25" />
                    </Form.Item>
                  </Col>
                </Row>
              );
            }}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repaymentType !== cur.repaymentType}>
            {({ getFieldValue }) => {
              const type = getFieldValue('repaymentType');
              if (type !== 'interest_only') return null;
              return (
                <Form.Item name="maturityDate" label="到期日" rules={[{ required: true, message: '请选择到期日' }]} tooltip="先息后本到期时需一次性还本金">
                  <DatePicker style={{ width: '100%' }} placeholder="选择到期日" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 还款扣减 Modal */}
      <Modal
        title="还款扣减"
        open={repayModal.visible}
        onOk={handleRepaySubmit}
        onCancel={() => setRepayModal({ ...repayModal, visible: false })}
        okText="确认还款"
        cancelText="取消"
        width={460}
        maskClosable={false}
      >
        <div style={{ marginBottom: SPACING.lg }}>
          <div style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary, marginBottom: SPACING.sm }}>
            债务：{repayModal.debtName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, background: COLORS.bgLight, borderRadius: 6 }}>
            <span style={{ fontSize: FONT.bodySmall, color: COLORS.textSecondary }}>当前剩余金额</span>
            <span style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.danger }}>¥{formatMoney(repayModal.remaining)}</span>
          </div>
        </div>
        <Form layout="vertical">
          <Form.Item label="本次还款金额（元）" required>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              value={repayAmount}
              onChange={(v) => setRepayAmount(v ?? 0)}
              placeholder="输入还款总额（含利息）"
            />
          </Form.Item>
          <Form.Item label={
            <span>其中利息部分（元）</span>
          } tooltip="输入本次还款中利息部分，系统会自动建议月利息金额，可手动修改">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={repayAmount}
              value={repayInterest}
              onChange={(v) => setRepayInterest(v ?? 0)}
              placeholder="利息金额"
            />
          </Form.Item>
          <Space>
            <Button size="small" onClick={() => setRepayAmount(repayModal.remaining)}>全额还清</Button>
            <Button size="small" onClick={() => setRepayAmount(Math.round(repayModal.remaining * 0.1 * 100) / 100)}>还最低（10%）</Button>
            <Button size="small" onClick={() => setRepayAmount(Math.round(repayModal.remaining * 0.5 * 100) / 100)}>还一半</Button>
          </Space>
          {repayAmount > 0 && (
            <div style={{ marginTop: SPACING.md, padding: SPACING.md, background: COLORS.bgPrimaryLight, borderRadius: 6, fontSize: FONT.bodySmall }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>利息部分：</span>
                <span style={{ color: COLORS.warning, fontWeight: 500 }}>¥{formatMoney(repayInterest)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>本金部分：</span>
                <span style={{ color: COLORS.success, fontWeight: 500 }}>¥{formatMoney(repayAmount - repayInterest)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${COLORS.border}` }}>
                <span>还款后剩余：</span>
                <strong style={{ color: COLORS.primary, fontSize: FONT.body }}>¥{formatMoney(repayModal.remaining - (repayAmount - repayInterest))}</strong>
              </div>
              {repayModal.remaining - (repayAmount - repayInterest) === 0 && <span style={{ marginLeft: SPACING.sm, color: COLORS.success, fontWeight: 500 }}>（已还清）</span>}
            </div>
          )}
        </Form>
      </Modal>

      {/* 还款记录 Drawer */}
      <Drawer
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 6, color: COLORS.primary }} />
            「{drawerDebt?.name}」还款记录
          </span>
        }
        open={!!drawerDebt}
        onClose={closePaymentDrawer}
        width={screens.md ? 720 : '100%'}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openNewPayment}>补录还款</Button>
        }
      >
        {drawerDebt && (
          <>
            <div style={{ display: 'flex', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgPrimaryLight }}>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计还款总额</div>
                <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.primary, marginTop: 2 }}>¥{formatMoney(repaySummary.total)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgSuccessLight }}>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计本金（{repaySummary.count}次）</div>
                <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.success, marginTop: 2 }}>¥{formatMoney(repaySummary.principal)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgWarningLight }}>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>累计利息支出</div>
                <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.warning, marginTop: 2 }}>¥{formatMoney(repaySummary.interest)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 140, padding: SPACING.md, borderRadius: 8, background: COLORS.bgDangerLight }}>
                <div style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>当前剩余金额</div>
                <div style={{ fontSize: FONT.h2, fontWeight: 600, color: COLORS.danger, marginTop: 2 }}>¥{formatMoney(debts.find(d => d.id === drawerDebt.id)?.remainingAmount ?? drawerDebt.remaining)}</div>
              </div>
            </div>
            <Divider style={{ margin: '8px 0 12px' }} />
            {debtRepayTxs.length === 0 ? (
              <EmptyState description="暂无还款记录，点击右上角「补录还款」可以手动补录历史还款。" />
            ) : (
              <PaginatedTable
                size="small"
                dataSource={debtRepayTxs}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: '还款时间',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    width: 170,
                    render: (v: string) => <span style={{ fontSize: FONT.tableCell }}>{v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'}</span>
                  },
                  {
                    title: '还款总额',
                    dataIndex: 'amount',
                    key: 'amount',
                    width: 110,
                    align: 'right',
                    render: (v: number) => <span style={{ fontSize: FONT.tableCell, fontWeight: 500, color: COLORS.primary }}>¥{formatMoney(v)}</span>
                  },
                  {
                    title: '本金',
                    dataIndex: 'principal_portion',
                    key: 'principal_portion',
                    width: 100,
                    align: 'right',
                    render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.success }}>¥{formatMoney(v)}</span>
                  },
                  {
                    title: '利息',
                    dataIndex: 'interest_portion',
                    key: 'interest_portion',
                    width: 100,
                    align: 'right',
                    render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.warning }}>¥{formatMoney(v)}</span>
                  },
                  {
                    title: '还款后剩余',
                    dataIndex: 'remaining_after',
                    key: 'remaining_after',
                    width: 110,
                    align: 'right',
                    render: (v: number) => <span style={{ fontSize: FONT.tableCell, color: COLORS.textSecondary }}>¥{formatMoney(v)}</span>
                  },
                  {
                    title: '备注',
                    dataIndex: 'note',
                    key: 'note',
                    ellipsis: true,
                    render: (v: string) => <span title={v || ''} style={{ fontSize: FONT.caption, color: COLORS.textTertiary }}>{v || '-'}</span>
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    fixed: 'right' as const,
                    render: (_: any, r: any) => (
                      <Space size={0} wrap={false}>
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditPayment(r)}>编辑</Button>
                        <Popconfirm title="删除这条还款记录？系统会把本金自动加回债务剩余金额。" onConfirm={() => handlePaymentDelete(r)} okText="确定删除" cancelText="取消">
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
              />
            )}
          </>
        )}
      </Drawer>

      {/* 补录/编辑还款 Modal */}
      <Modal
        title={paymentEditingTx ? '编辑还款记录' : '补录还款记录'}
        open={paymentModalOpen}
        onOk={handlePaymentSubmit}
        onCancel={() => setPaymentModalOpen(false)}
        okText={paymentEditingTx ? '保存修改' : '确认补录'}
        destroyOnClose
      >
        <Form form={paymentForm} layout="vertical" preserve={false}>
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
            <Input.TextArea rows={2} placeholder="选填，如：提前还款、违约金等" />
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
